"""
Auth Router — Login, Token Refresh, and Me endpoints.
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.auth_matrix import AuthMatrix
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
from app.services.ad_service import verify_ad_credentials
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
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

    stmt = select(User).where(User.username == username_clean)

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
        print(f"❌ Login attempt failed: User '{username_clean}' not found in DB")
        # Record failed logon log
        try:
            db.add(
                TransactionLog(
                    category="user_auth",
                    action="login_unknown",
                    status="failed",
                    message=f"เข้าสู่ระบบล้มเหลว: ไม่พบบัญชีผู้ใช้ '{username_clean}'",
                    details=json.dumps({"username": username_clean, "ip": client_ip}, ensure_ascii=False),
                    triggered_by=f"user:{username_clean}",
                )
            )
            await db.commit()
        except Exception:
            await db.rollback()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user.is_active:
        print(f"❌ Login attempt failed: User '{username_clean}' is deactivated")
        try:
            db.add(
                TransactionLog(
                    category="user_auth",
                    action="login_deactivated",
                    status="failed",
                    message=f"เข้าสู่ระบบล้มเหลว: บัญชีผู้ใช้ '{username_clean}' ถูกระงับการใช้งาน",
                    details=json.dumps(
                        {"username": username_clean, "department": user.department, "ip": client_ip},
                        ensure_ascii=False,
                    ),
                    triggered_by=f"user:{username_clean}",
                )
            )
            await db.commit()
        except Exception:
            await db.rollback()

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
                db.add(
                    TransactionLog(
                        category="user_auth",
                        action="login_ad",
                        status="failed",
                        message=f"เข้าสู่ระบบผ่าน Active Directory (AD) ล้มเหลว: {ad_message}",
                        details=json.dumps(
                            {
                                "username": username_clean,
                                "auth_method": "AD",
                                "department": user.department,
                                "ip": client_ip,
                                "error": ad_message,
                            },
                            ensure_ascii=False,
                        ),
                        triggered_by=f"user:{username_clean}",
                    )
                )
                await db.commit()
            except Exception:
                await db.rollback()

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"การเข้าสู่ระบบด้วย Active Directory ล้มเหลว: {ad_message}",
            )

        # AD Login Success
        print(f"🔑 AD Login successful for '{username_clean}'")
        try:
            db.add(
                TransactionLog(
                    category="user_auth",
                    action="login_ad",
                    status="success",
                    message=f"เข้าสู่ระบบผ่าน Active Directory (AD) สำเร็จ",
                    details=json.dumps(
                        {
                            "username": username_clean,
                            "auth_method": "AD",
                            "department": user.department,
                            "ip": client_ip,
                        },
                        ensure_ascii=False,
                    ),
                    triggered_by=f"user:{username_clean}",
                )
            )
            await db.commit()
        except Exception:
            await db.rollback()

    else:
        # Authenticate via Local App Password
        if not verify_password(req.password, user.password_hash):
            print(f"❌ Local Password mismatch for user '{username_clean}'")
            try:
                db.add(
                    TransactionLog(
                        category="user_auth",
                        action="login_local",
                        status="failed",
                        message="เข้าสู่ระบบผ่าน Local App Password ล้มเหลว: รหัสผ่านไม่ถูกต้อง",
                        details=json.dumps(
                            {
                                "username": username_clean,
                                "auth_method": "LOCAL",
                                "department": user.department,
                                "ip": client_ip,
                            },
                            ensure_ascii=False,
                        ),
                        triggered_by=f"user:{username_clean}",
                    )
                )
                await db.commit()
            except Exception:
                await db.rollback()

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
            )

        # Local Login Success
        print(f"🔑 Local Login successful for user '{username_clean}'")
        try:
            db.add(
                TransactionLog(
                    category="user_auth",
                    action="login_local",
                    status="success",
                    message="เข้าสู่ระบบผ่าน Local App Password สำเร็จ",
                    details=json.dumps(
                        {
                            "username": username_clean,
                            "auth_method": "LOCAL",
                            "department": user.department,
                            "ip": client_ip,
                        },
                        ensure_ascii=False,
                    ),
                    triggered_by=f"user:{username_clean}",
                )
            )
            await db.commit()
        except Exception:
            await db.rollback()

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

    # Determine effective allowed_item_groups (User specific override, or Group fallback, or "*")
    effective_groups = current_user.allowed_item_groups or (current_user.group.allowed_item_groups if current_user.group else "*") or "*"

    return UserMeResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        email=current_user.email,
        group_id=current_user.group_id,
        group_name=current_user.group.name if current_user.group else None,
        allowed_item_groups=effective_groups,
        permissions=permissions,
    )
