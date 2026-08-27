"""
User Management Router.
"""

from typing import Annotated
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_permission
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.schemas.user import PasswordReset, UserCreate, UserResponse, UserUpdate
from app.utils.security import hash_password

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("", response_model=list[UserResponse])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/users", "view"))],
):
    """List all users."""
    stmt = select(User).order_by(User.id.asc())
    result = await db.execute(stmt)
    users = result.scalars().all()
    return users


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/users", "create"))],
):
    """Create a new user."""
    existing = await db.execute(select(User).where(User.username == data.username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists",
        )

    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        email=data.email,
        telegram_chat_id=data.telegram_chat_id,
        group_id=data.group_id,
        is_active=data.is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/users", "view"))],
):
    """Get user by ID."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/users", "edit"))],
):
    """Update user information."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        user.email = data.email
    if data.telegram_chat_id is not None:
        user.telegram_chat_id = data.telegram_chat_id
    if data.group_id is not None:
        user.group_id = data.group_id
    if data.is_active is not None:
        user.is_active = data.is_active

    await db.commit()
    await db.refresh(user)
    return user


@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: int,
    data: PasswordReset,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/users", "edit"))],
):
    """Reset a user's password."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"message": f"Password reset successfully for user '{user.username}'"}


@router.post("/{user_id}/test-telegram")
async def test_telegram_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/users", "edit"))],
):
    """Send a test Direct Message (DM) to the target user via Telegram Bot API."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if not user.telegram_chat_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User does not have a Telegram Chat ID")

    # Fetch Telegram Settings
    settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.category == "telegram"))).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}

    bot_token = s_map.get("telegram_bot_token") or "8231754616:AAHcITgZR6_Gc8XJx-6Fxj-Cyy5bZZQG2hw"
    api_url = s_map.get("telegram_api_url") or "https://api.telegram.org"

    from app.services.telegram_service import format_telegram_header

    msg = (
        f"{format_telegram_header('🔔 <b>ทดสอบการส่งข้อความส่วนตัว (Direct Message)</b>')}\n\n"
        f"• 👤 <b>ผู้รับ:</b> คุณ{user.full_name} (@{user.username})\n"
        f"• 🆔 <b>Telegram Chat ID:</b> <code>{user.telegram_chat_id}</code>\n"
        f"• ⚡ <b>สถานะ:</b> เชื่อมต่อการแจ้งเตือนส่วนบุคคลกับระบบ IRM สำเร็จเรียบร้อยแล้ว"
    )

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{api_url}/bot{bot_token}/sendMessage",
                json={
                    "chat_id": user.telegram_chat_id,
                    "text": msg,
                    "parse_mode": "HTML",
                },
                timeout=10.0,
            )
            data = res.json()
            if not data.get("ok"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Telegram API Error: {data.get('description', 'Unknown error')}",
                )
            return {"message": f"ส่งข้อความ Telegram DM หาคุณ {user.full_name} สำเร็จแล้ว"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send Telegram message: {str(e)}")
