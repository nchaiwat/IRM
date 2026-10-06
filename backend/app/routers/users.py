from datetime import datetime, timezone, timedelta
import secrets
from typing import Annotated
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_permission
from app.models.system_setting import SystemSetting
from app.models.telegram_bind_token import TelegramBindToken
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
        department=data.department,
        use_ad_auth=data.use_ad_auth,
        telegram_chat_id=data.telegram_chat_id,
        telegram_inbound_notify=data.telegram_inbound_notify,
        group_id=data.group_id,
        allowed_item_groups=data.allowed_item_groups or "*",
        is_active=data.is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _generate_bind_token(db: AsyncSession, user_id: int) -> dict:
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.category == "telegram"))).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}
    bot_username = (s_map.get("telegram_bot_username") or "PRORGBOT").strip().lstrip("@")

    # Generate cryptographically secure token
    raw_token = f"bind_{secrets.token_hex(16)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    bind_record = TelegramBindToken(
        token=raw_token,
        user_id=user.id,
        is_used=False,
        expires_at=expires_at,
    )
    db.add(bind_record)
    await db.commit()

    deep_link = f"https://t.me/{bot_username}?start={raw_token}"
    return {
        "token": raw_token,
        "bot_username": bot_username,
        "deep_link": deep_link,
        "user_id": user.id,
        "full_name": user.full_name,
        "username": user.username,
        "expires_at": expires_at.isoformat(),
        "expires_in_seconds": 900,
    }


@router.post("/me/telegram-bind-token")
async def create_my_telegram_bind_token(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Generate a temporary one-time Telegram Deep Link bind token for the currently logged-in user."""
    return await _generate_bind_token(db, current_user.id)


@router.get("/telegram-bind-status")
async def get_telegram_bind_status(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Poll status of a Telegram Deep Link bind token."""
    now = datetime.now(timezone.utc)
    stmt = select(TelegramBindToken).where(TelegramBindToken.token == token)
    res = await db.execute(stmt)
    bind_record = res.scalar_one_or_none()
    if not bind_record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found")

    is_admin = getattr(current_user.group, "name", "") == "Admin"
    if bind_record.user_id != current_user.id and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if bind_record.is_used:
        return {
            "status": "completed",
            "telegram_chat_id": bind_record.telegram_chat_id,
            "user_id": bind_record.user_id,
            "full_name": bind_record.user.full_name if bind_record.user else "",
        }
    elif bind_record.expires_at < now:
        return {
            "status": "expired",
            "telegram_chat_id": None,
            "user_id": bind_record.user_id,
        }
    else:
        return {
            "status": "pending",
            "telegram_chat_id": None,
            "user_id": bind_record.user_id,
        }


async def _send_user_telegram_test(db: AsyncSession, target_user: User) -> dict:
    if not target_user.telegram_chat_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ผู้ใช้ยังไม่ได้ระบุหรือผูก Telegram Chat ID ในระบบ",
        )

    from app.services.telegram_service import format_telegram_header, send_telegram_message_detailed

    msg = (
        f"{format_telegram_header('🔔 <b>ทดสอบการส่งข้อความส่วนตัว (Direct Message)</b>')}\n\n"
        f"• 👤 <b>ผู้รับ:</b> คุณ{target_user.full_name} (@{target_user.username})\n"
        f"• 🆔 <b>Telegram Chat ID:</b> <code>{target_user.telegram_chat_id}</code>\n"
        f"• ⚡ <b>สถานะ:</b> บัญชี Telegram พร้อมใช้งานและสามารถรับการแจ้งเตือนจากระบบ IRM ได้เรียบร้อยแล้ว"
    )

    success, detail_msg = await send_telegram_message_detailed(
        db=db,
        message_text=msg,
        category="user_management",
        chat_id=target_user.telegram_chat_id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail_msg,
        )
    return {"message": f"ส่งข้อความ Telegram DM หาคุณ {target_user.full_name} สำเร็จแล้ว"}


@router.post("/me/test-telegram")
async def test_my_telegram(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Send a test Direct Message (DM) to verify the currently logged-in user's Telegram connection."""
    return await _send_user_telegram_test(db, current_user)


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

    old_username = user.username
    if data.username is not None:
        new_username = data.username.strip()
        if not new_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username / User ID ไม่สามารถเป็นค่าว่างได้",
            )
        if new_username != user.username:
            existing = await db.execute(
                select(User).where(User.username == new_username, User.id != user_id)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Username '{new_username}' ถูกใช้งานแล้วโดยผู้ใช้อื่น",
                )
            if user.username.lower() == "admin" and new_username.lower() != "admin":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="ไม่อนุญาตให้เปลี่ยน Username ของผู้ดูแลระบบหลัก (admin)",
                )
            user.username = new_username

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.email is not None:
        user.email = data.email
    if data.department is not None:
        user.department = data.department
    if data.use_ad_auth is not None:
        user.use_ad_auth = data.use_ad_auth
    if data.telegram_chat_id is not None:
        user.telegram_chat_id = data.telegram_chat_id
    if data.telegram_inbound_notify is not None:
        user.telegram_inbound_notify = data.telegram_inbound_notify
    if data.group_id is not None:
        user.group_id = data.group_id
    if data.allowed_item_groups is not None:
        user.allowed_item_groups = data.allowed_item_groups
    if data.is_active is not None:
        user.is_active = data.is_active

    await db.commit()
    await db.refresh(user)

    if data.username is not None and old_username != user.username:
        try:
            from app.services.log_service import record_transaction_log
            await record_transaction_log(
                category="user_management",
                action="update_username",
                status="success",
                message=f"แก้ไข User ID จาก '{old_username}' เป็น '{user.username}'",
                details={
                    "user_id": user.id,
                    "old_username": old_username,
                    "new_username": user.username,
                },
                triggered_by=f"user:{current_user.username}",
            )
        except Exception as log_err:
            print(f"⚠️ Could not write update_username audit log: {log_err}")

    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/users", "delete"))],
):
    """Delete an unneeded or inactive user account."""
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถลบบัญชีผู้ใช้งานที่คุณกำลังเข้าสู่ระบบอยู่ได้",
        )

    if user.username.lower() == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ไม่สามารถลบบัญชีผู้ดูแลระบบหลัก (admin) ได้",
        )

    username_deleted = user.username
    full_name_deleted = user.full_name

    await db.delete(user)
    await db.commit()

    # Record audit trail in transaction logs
    try:
        from app.services.log_service import record_transaction_log
        await record_transaction_log(
            category="user_management",
            action="delete_user",
            status="success",
            message=f"ลบบัญชีผู้ใช้งาน '{username_deleted}' ({full_name_deleted}) ออกจากระบบ",
            details={
                "user_id": user_id,
                "username": username_deleted,
                "full_name": full_name_deleted,
            },
            triggered_by=f"user:{current_user.username}",
        )
    except Exception as log_err:
        print(f"⚠️ Could not write delete_user audit log: {log_err}")

    return {"message": f"ลบบัญชีผู้ใช้งาน '{username_deleted}' สำเร็จเรียบร้อยแล้ว"}


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
    return await _send_user_telegram_test(db, user)


@router.post("/{user_id}/telegram-bind-token")
async def create_user_telegram_bind_token(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/users", "edit"))],
):
    """Generate a temporary one-time Telegram Deep Link bind token for a target user (Admin only)."""
    return await _generate_bind_token(db, user_id)
