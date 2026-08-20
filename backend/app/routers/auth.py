"""
Auth Router — Login, Token Refresh, and Me endpoints.
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.auth_matrix import AuthMatrix
from app.models.menu import Menu
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PermissionItem,
    RefreshTokenRequest,
    TokenResponse,
    UserMeResponse,
)
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Authenticate user with username and password, returns JWT tokens."""
    username_clean = request.username.strip()
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not verify_password(request.password, user.password_hash):
        print(f"❌ Login attempt failed: Password mismatch for user '{username_clean}'")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    if not user.is_active:
        print(f"❌ Login attempt failed: User '{username_clean}' is deactivated")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )

    print(f"🔑 Login successful for user '{username_clean}'")
    
    # Safely update last_login_at without crashing if DB column is pending
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
    permissions: list[PermissionItem] = []

    if current_user.group_id:
        stmt = (
            select(AuthMatrix, Menu)
            .join(Menu, AuthMatrix.menu_id == Menu.id)
            .where(AuthMatrix.group_id == current_user.group_id, Menu.is_active == True)
        )
        result = await db.execute(stmt)
        rows = result.all()

        is_admin_group = current_user.group and current_user.group.name.lower() == "admin"

        for matrix, menu in rows:
            permissions.append(
                PermissionItem(
                    menu_id=menu.id,
                    menu_name=menu.name,
                    menu_path=menu.path,
                    can_view=True if is_admin_group else matrix.can_view,
                    can_create=True if is_admin_group else matrix.can_create,
                    can_edit=True if is_admin_group else matrix.can_edit,
                    can_delete=True if is_admin_group else matrix.can_delete,
                )
            )
    elif current_user.group and current_user.group.name.lower() == "admin":
        all_menus = (await db.execute(select(Menu).where(Menu.is_active == True))).scalars().all()
        for menu in all_menus:
            permissions.append(
                PermissionItem(
                    menu_id=menu.id,
                    menu_name=menu.name,
                    menu_path=menu.path,
                    can_view=True,
                    can_create=True,
                    can_edit=True,
                    can_delete=True,
                )
            )

    return UserMeResponse(
        id=current_user.id,
        username=current_user.username,
        full_name=current_user.full_name,
        email=current_user.email,
        group_id=current_user.group_id,
        group_name=current_user.group.name if current_user.group else None,
        permissions=permissions,
    )
