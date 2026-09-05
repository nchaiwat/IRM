"""
Centralized Identity Management Router — Standard Account Directory & Remote Status Provisioning.
Allows corporate central identity management services to query account inventories and remotely disable/enable users.
"""

from datetime import datetime
import secrets
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.group import Group
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.services.log_service import record_transaction_log
from app.utils.security import hash_password

router = APIRouter(prefix="/api/v1/directory", tags=["Central Identity Management"])


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────────────────────────────────────

class CreateCentralAccountRequest(BaseModel):
    username: str
    full_name: str
    email: Optional[str] = None
    department: Optional[str] = None
    group_name: Optional[str] = None
    use_ad_auth: bool = True
    created_by: Optional[str] = "Central-IAM-Service"


class CreateCentralAccountResponse(BaseModel):
    success: bool
    id: int
    username: str
    message: str
    group_name: Optional[str] = None
    is_active: bool
    created_at: datetime

class CentralAccountItem(BaseModel):
    id: int
    username: str
    full_name: str
    email: EmailStr
    department: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    group_name: Optional[str] = None
    use_ad_auth: bool
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CentralAccountsResponse(BaseModel):
    application_name: str = "IRM (Incoming Raw Material)"
    total_accounts: int
    active_accounts: int
    inactive_accounts: int
    accounts: list[CentralAccountItem]


class UpdateAccountStatusRequest(BaseModel):
    is_active: bool
    reason: Optional[str] = "Status updated via Central Management API"
    updated_by: Optional[str] = "Central-IAM-Service"


class UpdateAccountStatusResponse(BaseModel):
    username: str
    is_active: bool
    message: str
    updated_at: datetime


# ──────────────────────────────────────────────────────────────────────────────
# Security Dependency: API Key & IP Whitelist
# ──────────────────────────────────────────────────────────────────────────────

async def verify_central_management_access(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_management_api_key: Optional[str] = Header(None, alias="X-Management-API-Key"),
):
    """
    Validate that incoming request contains valid X-Management-API-Key
    and originates from an authorized IP address (if configured).
    """
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    # 1. Fetch Management API Settings
    stmt = select(SystemSetting).where(
        SystemSetting.key.in_(["management_api_key", "management_allowed_ips"])
    )
    res = await db.execute(stmt)
    settings_map = {s.key: (s.value or "").strip() for s in res.scalars().all()}

    api_key_expected = settings_map.get("management_api_key")
    allowed_ips_str = settings_map.get("management_allowed_ips", "")

    # If no API key configured, reject all external calls for safety
    if not api_key_expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Central Management API is disabled or API Key has not been configured in IRM System Settings.",
        )

    # 2. Validate API Key (using constant-time comparison)
    if not x_management_api_key or not secrets.compare_digest(x_management_api_key.strip(), api_key_expected):
        # Audit log unauthorized attempt
        await record_transaction_log(
            category="central_management",
            action="unauthorized_access",
            status="failed",
            message=f"ถูกปฏิเสธการเข้าถึง Central Management API (Invalid or missing API Key) จาก IP: {client_ip}",
            details={"ip": client_ip, "path": str(request.url.path)},
            triggered_by=f"remote_ip:{client_ip}",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Management-API-Key header.",
        )

    # 3. Validate IP Whitelist (if specified)
    if allowed_ips_str and allowed_ips_str != "*":
        allowed_ips = [ip.strip() for ip in allowed_ips_str.split(",") if ip.strip()]
        # Allow localhost loopback as fallback
        allowed_ips.extend(["127.0.0.1", "::1", "localhost"])
        if client_ip not in allowed_ips:
            await record_transaction_log(
                category="central_management",
                action="ip_forbidden",
                status="failed",
                message=f"ถูกปฏิเสธเนื่องจาก IP {client_ip} ไม่อยู่ใน Whitelist ของ Central Management API",
                details={"client_ip": client_ip, "allowed_ips": allowed_ips},
                triggered_by=f"remote_ip:{client_ip}",
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Origin IP '{client_ip}' is not permitted to access this management endpoint.",
            )

    return {"client_ip": client_ip}


# ──────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/accounts", response_model=CentralAccountsResponse)
async def list_accounts_for_central_management(
    db: Annotated[AsyncSession, Depends(get_db)],
    access_info: Annotated[dict, Depends(verify_central_management_access)],
    status_filter: Optional[str] = Query("all", enum=["all", "active", "inactive"]),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """
    List all user accounts in IRM application for centralized user inventory and reconciliation.
    Passwords and sensitive business data are completely omitted.
    """
    stmt = select(User).order_by(User.id.asc())

    if status_filter == "active":
        stmt = stmt.where(User.is_active == True)
    elif status_filter == "inactive":
        stmt = stmt.where(User.is_active == False)

    if department:
        stmt = stmt.where(User.department.ilike(f"%{department.strip()}%"))

    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where(
            (User.username.ilike(s)) | (User.full_name.ilike(s)) | (User.email.ilike(s))
        )

    res = await db.execute(stmt)
    users = res.scalars().all()

    account_items = []
    active_count = 0
    inactive_count = 0

    for u in users:
        if u.is_active:
            active_count += 1
        else:
            inactive_count += 1

        account_items.append(
            CentralAccountItem(
                id=u.id,
                username=u.username,
                full_name=u.full_name,
                email=u.email,
                department=u.department,
                telegram_chat_id=u.telegram_chat_id,
                group_name=u.group.name if u.group else None,
                use_ad_auth=getattr(u, "use_ad_auth", False),
                is_active=u.is_active,
                last_login_at=u.last_login_at,
                created_at=u.created_at,
                updated_at=u.updated_at,
            )
        )

    client_ip = access_info.get("client_ip", "unknown")
    await record_transaction_log(
        category="central_management",
        action="list_accounts",
        status="success",
        message=f"Central Management ร้องขอตรวจสอบรายชื่อผู้ใช้ทั้งหมด (พบ {len(account_items)} บัญชี)",
        details={
            "client_ip": client_ip,
            "status_filter": status_filter,
            "returned_count": len(account_items),
        },
        records_count=len(account_items),
        triggered_by="central_service",
    )

    return CentralAccountsResponse(
        total_accounts=len(account_items),
        active_accounts=active_count,
        inactive_accounts=inactive_count,
        accounts=account_items,
    )


@router.post("/accounts", response_model=CreateCentralAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account_for_central_management(
    payload: CreateCentralAccountRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    access_info: Annotated[dict, Depends(verify_central_management_access)],
):
    """
    Provision a new user account remotely from Central Identity Management service.
    """
    username_clean = payload.username.strip()
    full_name_clean = payload.full_name.strip()

    if not username_clean or not full_name_clean:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Validation error: username and full_name are required.",
        )

    # 1. Check if user already exists
    stmt = select(User).where(func.lower(User.username) == username_clean.lower())
    res = await db.execute(stmt)
    existing_user = res.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User account already exists.",
        )

    # 2. Resolve Group
    group_id = None
    assigned_group_name = None
    if payload.group_name and payload.group_name.strip():
        g_stmt = select(Group).where(func.lower(Group.name) == payload.group_name.strip().lower())
        g_res = await db.execute(g_stmt)
        matched_group = g_res.scalar_one_or_none()
        if matched_group:
            group_id = matched_group.id
            assigned_group_name = matched_group.name

    if not group_id:
        # Fallback to default/first active group
        g_stmt = select(Group).where(Group.is_active == True).order_by(Group.id.asc()).limit(1)
        g_res = await db.execute(g_stmt)
        default_group = g_res.scalar_one_or_none()
        if default_group:
            group_id = default_group.id
            assigned_group_name = default_group.name

    # 3. Secure dummy password hash for AD auth
    dummy_secret = secrets.token_urlsafe(32)
    pwd_hash = hash_password(dummy_secret)

    email_val = (
        payload.email.strip()
        if payload.email and payload.email.strip()
        else f"{username_clean.lower()}@windowasia.com"
    )

    new_user = User(
        username=username_clean,
        password_hash=pwd_hash,
        full_name=full_name_clean,
        email=email_val,
        department=payload.department.strip() if payload.department else None,
        group_id=group_id,
        allowed_item_groups="*",
        use_ad_auth=payload.use_ad_auth,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    client_ip = access_info.get("client_ip", "unknown")
    await record_transaction_log(
        category="central_management",
        action="create_account",
        status="success",
        message=f"Central Management สั่งสร้างบัญชีผู้ใช้ใหม่ '{new_user.username}' (กลุ่มสิทธิ์: {assigned_group_name or 'Default'})",
        details={
            "username": new_user.username,
            "full_name": new_user.full_name,
            "email": new_user.email,
            "department": new_user.department,
            "group_name": assigned_group_name,
            "use_ad_auth": new_user.use_ad_auth,
            "created_by": payload.created_by,
            "client_ip": client_ip,
        },
        triggered_by=f"central_service:{payload.created_by}",
    )

    return CreateCentralAccountResponse(
        success=True,
        id=new_user.id,
        username=new_user.username,
        message=f"Account '{new_user.username}' created successfully.",
        group_name=assigned_group_name,
        is_active=new_user.is_active,
        created_at=new_user.created_at or datetime.now(),
    )


@router.patch("/accounts/{username}/status", response_model=UpdateAccountStatusResponse)
async def update_account_status(
    username: str,
    payload: UpdateAccountStatusRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    access_info: Annotated[dict, Depends(verify_central_management_access)],
):
    """
    Remotely enable or disable (deactivate) an account.
    Typically called during corporate offboarding or employee status change.
    """
    username_clean = username.strip()
    stmt = select(User).where(User.username == username_clean)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User account '{username_clean}' does not exist on IRM application.",
        )

    previous_status = user.is_active
    user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)

    action_text = "เปิดใช้งาน (Activate)" if payload.is_active else "ระงับการใช้งาน (Deactivate / Disable)"
    client_ip = access_info.get("client_ip", "unknown")

    await record_transaction_log(
        category="central_management",
        action="update_account_status",
        status="success",
        message=f"Central Management สั่ง {action_text} บัญชี '{username_clean}' (เหตุผล: {payload.reason})",
        details={
            "username": username_clean,
            "previous_status": previous_status,
            "new_status": user.is_active,
            "reason": payload.reason,
            "updated_by": payload.updated_by,
            "client_ip": client_ip,
        },
        triggered_by=f"central_service:{payload.updated_by}",
    )

    return UpdateAccountStatusResponse(
        username=user.username,
        is_active=user.is_active,
        message=f"Account '{user.username}' status has been successfully updated to {'ACTIVE' if user.is_active else 'INACTIVE'}.",
        updated_at=user.updated_at or datetime.now(),
    )
