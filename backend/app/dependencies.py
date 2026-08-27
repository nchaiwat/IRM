"""
FastAPI Dependencies — Auth, DB, and Authorization checks.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.auth_matrix import AuthMatrix
from app.models.user import User
from app.utils.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Validate JWT token and return the current User model."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise credentials_exception
    
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.username == username, User.is_active == True))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    return user


def require_permission(menu_path: str, action: str = "view"):
    """
    Dependency factory to check if the current user has permission for a specific menu and action.
    Action can be: 'view', 'create', 'edit', 'delete'.
    """
    async def permission_checker(
        current_user: Annotated[User, Depends(get_current_user)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        # Admin bypass if user is 'admin' or belongs to 'Admin' group
        if (current_user.username and current_user.username.lower() == "admin") or (
            current_user.group and current_user.group.name.lower() == "admin"
        ):
            return current_user

        if not current_user.group_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no assigned group",
            )

        # Find menu by path and check auth_matrix
        from app.models.menu import Menu
        stmt = (
            select(AuthMatrix)
            .join(Menu, AuthMatrix.menu_id == Menu.id)
            .where(
                AuthMatrix.group_id == current_user.group_id,
                Menu.path == menu_path,
            )
        )
        result = await db.execute(stmt)
        matrix = result.scalar_one_or_none()

        if not matrix:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied for route {menu_path}",
            )

        has_perm = False
        if action == "view":
            has_perm = matrix.can_view
        elif action == "create":
            has_perm = matrix.can_create
        elif action == "edit":
            has_perm = matrix.can_edit
        elif action == "delete":
            has_perm = matrix.can_delete

        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{action}' denied for route {menu_path}",
            )

        return current_user

    return permission_checker
