"""
Auth Router — Login, Token Refresh, and Me endpoints.
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_effective_user_allowed_groups
from app.models.auth_matrix import AuthMatrix
from app.models.group import Group
from app.models.menu import Menu
from app.models.transaction_log import TransactionLog
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PermissionItem,
    RefreshTokenRequest,
    TokenResponse,
    UserMeResponse,
)
from app.services.ad_service import get_ad_settings, verify_ad_credentials
from app.services.log_service import record_transaction_log
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    req: LoginRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Authenticate user with username and password, supporting Active Directory and Local passwords."""
    username_clean = req.username.strip()
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    stmt = select(User).where(func.lower(User.username) == username_clean.lower())

    try:
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
    except Exception as db_err:
        print(f"❌ DB Query Error during login for '{username_clean}': {db_err}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user:
        # Check if AD authentication is available and enabled for auto-provisioning
        ad_cfg = await get_ad_settings(db)
        if ad_cfg.get("ad_enabled") and ad_cfg.get("ad_gateway_url"):
            ad_success, ad_message, raw_resp = await verify_ad_credentials(
                db=db,
                username=username_clean,
                password=req.password,
            )
            if ad_success:
                target_grp_stmt = select(Group).where(Group.name == "PU User")
                default_grp = (await db.execute(target_grp_stmt)).scalar_one_or_none()

                user_name = ""
                user_email = ""
                user_dept = ""
                if isinstance(raw_resp, dict):
                    user_name = raw_resp.get("name") or raw_resp.get("full_name") or ""
                    user_email = raw_resp.get("email") or ""
                    user_dept = raw_resp.get("department") or ""

                user = User(
                    username=username_clean,
                    password_hash=hash_password("AD_MANAGED_ACCOUNT"),
                    full_name=user_name or username_clean,
                    email=user_email or f"{username_clean.lower()}@windowasia.com",
                    department=user_dept or "Purchasing",
                    group_id=default_grp.id if default_grp else None,
                    use_ad_auth=True,
                    is_active=True,
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)

                try:
                    await record_transaction_log(
                        category="user_auth",
                        action="auto_provision_ad_user",
                        status="success",
                        message=f"สร้างบัญชีผู้ใช้ใหม่อัตโนมัติจาก Active Directory (AD): '{username_clean}'",
                        details={"username": username_clean, "ip": client_ip},
                        triggered_by=f"user:{username_clean}",
                        db=db,
                    )
                except Exception as log_err:
                    print(f"⚠️ Could not write auto_provision_ad_user log: {log_err}")

        if not user:
            print(f"❌ Login attempt failed: User '{username_clean}' not found in DB")
            try:
                await record_transaction_log(
                    category="user_auth",
                    action="login_unknown",
                    status="failed",
                    message=f"เข้าสู่ระบบล้มเหลว: ไม่พบบัญชีผู้ใช้ '{username_clean}'",
                    details={"username": username_clean, "ip": client_ip},
                    triggered_by=f"user:{username_clean}",
                )
            except Exception as log_err:
                print(f"⚠️ Could not write login_unknown log: {log_err}")

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )

    if not user.is_active:
        print(f"❌ Login attempt failed: User '{username_clean}' is deactivated")
        try:
            await record_transaction_log(
                category="user_auth",
                action="login_deactivated",
                status="failed",
                message=f"เข้าสู่ระบบล้มเหลว: บัญชีผู้ใช้ '{username_clean}' ถูกระงับการใช้งาน",
                details={"username": username_clean, "department": user.department, "ip": client_ip},
                triggered_by=f"user:{username_clean}",
            )
        except Exception as log_err:
            print(f"⚠️ Could not write login_deactivated log: {log_err}")

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Check Authentication Mode: Active Directory (AD) vs Local App Password
    # ──────────────────────────────────────────────────────────────────────────
    use_ad = getattr(user, "use_ad_auth", False)

    if use_ad:
        # Authenticate via Active Directory Gateway
        ad_success, ad_message, raw_resp = await verify_ad_credentials(
            db=db,
            username=username_clean,
            password=req.password,
        )

        if not ad_success:
            print(f"❌ AD Login failed for '{username_clean}': {ad_message}")
            try:
                await record_transaction_log(
                    category="user_auth",
                    action="login_ad",
                    status="failed",
                    message=f"เข้าสู่ระบบผ่าน Active Directory (AD) ล้มเหลว: {ad_message}",
                    details={
                        "username": username_clean,
                        "auth_method": "AD",
                        "department": user.department,
                        "ip": client_ip,
                        "error": ad_message,
                    },
                    triggered_by=f"user:{username_clean}",
                )
            except Exception as log_err:
                print(f"⚠️ Could not write login_ad fail log: {log_err}")

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"การเข้าสู่ระบบด้วย Active Directory ล้มเหลว: {ad_message}",
            )

        # AD Login Success
        print(f"🔑 AD Login successful for '{username_clean}'")
        try:
            await record_transaction_log(
                category="user_auth",
                action="login_ad",
                status="success",
                message=f"เข้าสู่ระบบผ่าน Active Directory (AD) สำเร็จ",
                details={
                    "username": username_clean,
                    "auth_method": "AD",
                    "department": user.department,
                    "ip": client_ip,
                },
                triggered_by=f"user:{username_clean}",
            )
        except Exception as log_err:
            print(f"⚠️ Could not write login_ad success log: {log_err}")

    else:
        # Authenticate via Local App Password with AD Fallback
        local_matched = verify_password(req.password, user.password_hash)

        if not local_matched:
            # Fallback check against AD if enabled globally
            ad_cfg = await get_ad_settings(db)
            if ad_cfg.get("ad_enabled") and ad_cfg.get("ad_gateway_url"):
                ad_success, ad_message, _ = await verify_ad_credentials(
                    db=db,
                    username=username_clean,
                    password=req.password,
                )
                if ad_success:
                    local_matched = True
                    user.use_ad_auth = True
                    await db.commit()
                    print(f"🔑 AD Fallback Login successful for user '{username_clean}' (switched to AD auth)")

        if not local_matched:
            print(f"❌ Password mismatch for user '{username_clean}'")
            try:
                await record_transaction_log(
                    category="user_auth",
                    action="login_local",
                    status="failed",
                    message="เข้าสู่ระบบล้มเหลว: รหัสผ่านไม่ถูกต้อง",
                    details={
                        "username": username_clean,
                        "auth_method": "LOCAL",
                        "department": user.department,
                        "ip": client_ip,
                    },
                    triggered_by=f"user:{username_clean}",
                )
            except Exception as log_err:
                print(f"⚠️ Could not write login_local fail log: {log_err}")

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )

        # Local Login Success
        print(f"🔑 Local Login successful for user '{username_clean}'")
        try:
            await record_transaction_log(
                category="user_auth",
                action="login_local",
                status="success",
                message="เข้าสู่ระบบผ่าน Local App Password สำเร็จ",
                details={
                    "username": username_clean,
                    "auth_method": "LOCAL",
                    "department": user.department,
                    "ip": client_ip,
                },
                triggered_by=f"user:{username_clean}",
            )
        except Exception as log_err:
            print(f"⚠️ Could not write login_local success log: {log_err}")

    # Safely update last_login_at
    try:
        user.last_login_at = datetime.now(timezone.utc)
        await db.commit()
    except Exception as e:
        print(f"⚠️ Notice: Skipping last_login_at update: {e}")
        await db.rollback()

    access_token = create_access_token(subject=user.username)
    refresh_token = create_refresh_token(subject=user.username)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: RefreshTokenRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generate new access token using valid refresh token."""
    payload = decode_token(request.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    username = payload.get("sub")
    stmt = select(User).where(User.username == username, User.is_active == True)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated",
        )

    new_access_token = create_access_token(subject=user.username)
    new_refresh_token = create_refresh_token(subject=user.username)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
    )


@router.get("/me", response_model=UserMeResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get current user details along with permission list for sidebar & route protection."""
    all_menus_stmt = (
        select(Menu)
        .where(Menu.is_active == True, Menu.path.is_not(None))
        .order_by(Menu.parent_id.asc().nullsfirst(), Menu.sort_order.asc(), Menu.id.asc())
    )
    all_menus = (await db.execute(all_menus_stmt)).scalars().all()

    is_admin_group = bool(
        (current_user.username and current_user.username.lower() == "admin")
        or (current_user.group and current_user.group.name.lower() == "admin")
    )

    matrix_map = {}
    if current_user.group_id:
        stmt = select(AuthMatrix).where(AuthMatrix.group_id == current_user.group_id)
        matrix_rows = (await db.execute(stmt)).scalars().all()
        matrix_map = {row.menu_id: row for row in matrix_rows}

    permissions: list[PermissionItem] = []
    for menu in all_menus:
        entry = matrix_map.get(menu.id)
        permissions.append(
            PermissionItem(
                menu_id=menu.id,
                menu_name=menu.name,
                menu_path=menu.path,
                can_view=True if is_admin_group else (entry.can_view if entry else False),
                can_create=True if is_admin_group else (entry.can_create if entry else False),
                can_edit=True if is_admin_group else (entry.can_edit if entry else False),
                can_delete=True if is_admin_group else (entry.can_delete if entry else False),
            )
        )

    # Determine effective allowed_item_groups (Group restriction with User specific override)
    effective_groups = get_effective_user_allowed_groups(current_user)

    # Determine default landing page from Group
    default_landing = (
        current_user.group.default_page
        if current_user.group and current_user.group.default_page
        else "/dashboard"
    )

    return UserMeResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        email=current_user.email,
        group_id=current_user.group_id,
        group_name=current_user.group.name if current_user.group else None,
        allowed_item_groups=effective_groups,
        default_page=default_landing,
        permissions=permissions,
    )
