"""
Telegram Router — Webhook Receiver, Webhook Management, and Deep Linking Handlers.
"""

from datetime import datetime, timezone
from typing import Annotated, Any
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_permission
from app.models.system_setting import SystemSetting
from app.models.telegram_bind_token import TelegramBindToken
from app.models.user import User
from app.services.log_service import record_transaction_log
from app.services.telegram_service import format_telegram_header, send_telegram_message_detailed

router = APIRouter(prefix="/api/telegram", tags=["Telegram"])


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Telegram Bot API Webhook Endpoint.
    Handles incoming messages, specifically /start with deep link binding tokens.
    """
    try:
        payload = await request.json()
    except Exception:
        return {"ok": True}

    message = payload.get("message") or payload.get("edited_message")
    if not message:
        return {"ok": True}

    chat = message.get("chat") or {}
    chat_id = chat.get("id")
    from_user = message.get("from") or {}
    text = (message.get("text") or "").strip()

    if not chat_id or not text:
        return {"ok": True}

    # Only process private 1-on-1 chats for binding
    if chat.get("type") != "private":
        return {"ok": True}

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        param = parts[1].strip() if len(parts) > 1 else ""

        if param.startswith("bind_"):
            now = datetime.now(timezone.utc)
            stmt = select(TelegramBindToken).where(
                TelegramBindToken.token == param,
                TelegramBindToken.is_used == False,
                TelegramBindToken.expires_at > now,
            )
            bind_record = (await db.execute(stmt)).scalar_one_or_none()

            if bind_record:
                bind_record.is_used = True
                bind_record.telegram_chat_id = str(chat_id)

                user = (await db.execute(select(User).where(User.id == bind_record.user_id))).scalar_one_or_none()
                if user:
                    user.telegram_chat_id = str(chat_id)
                    user.telegram_inbound_notify = True
                    await db.commit()

                    reply_msg = (
                        f"{format_telegram_header('✅ <b>เชื่อมต่อการแจ้งเตือน IRM สำเร็จ</b>')}\n\n"
                        f"• 👤 <b>ผู้ใช้งาน:</b> คุณ{user.full_name} (@{user.username})\n"
                        f"• 🆔 <b>Telegram Chat ID:</b> <code>{chat_id}</code>\n"
                        f"• ⚡ <b>สถานะ:</b> ผูกบัญชีกับระบบ IRM เรียบร้อยแล้ว\n\n"
                        f"📦 ระบบจะจัดส่งสรุปยอดวัตถุดิบขาเข้าประจำวันให้คุณทุกเช้าเวลา 07:30 น."
                    )
                    await send_telegram_message_detailed(
                        db=db,
                        message_text=reply_msg,
                        category="telegram_inbound_dm",
                        chat_id=str(chat_id),
                    )

                    await record_transaction_log(
                        category="telegram_inbound_dm",
                        action="telegram_dm",
                        status="SUCCESS",
                        message="เชื่อมต่อ Telegram อัตโนมัติสำเร็จ (Deep Link)",
                        details=f"User: {user.username} | Chat ID: {chat_id} | Token: {param}",
                        db=None,
                    )
                    return {"ok": True}
            else:
                err_reply = (
                    f"{format_telegram_header('⚠️ <b>ลิงก์เชื่อมต่อหมดอายุหรือไม่ถูกต้อง</b>')}\n\n"
                    f"ลิงก์เชื่อมต่อนี้หมดอายุหรือถูกใช้งานไปแล้ว\n"
                    f"กรุณากลับไปที่ระบบ IRM แล้วกดปุ่ม <b>\"เชื่อมต่อ Telegram\"</b> เพื่อรับ QR Code ใหม่อีกครั้งครับ"
                )
                await send_telegram_message_detailed(
                    db=db,
                    message_text=err_reply,
                    category="telegram_alert",
                    chat_id=str(chat_id),
                )
                return {"ok": True}
        else:
            first_name = from_user.get("first_name", "ผู้ใช้งาน")
            welcome_msg = (
                f"{format_telegram_header('📦 <b>IRM Notification Bot</b>')}\n\n"
                f"สวัสดีครับ คุณ{first_name} 👋\n\n"
                f"• 🆔 <b>Telegram Chat ID ของคุณคือ:</b> <code>{chat_id}</code>\n\n"
                f"หากต้องการรับการแจ้งเตือนยอดวัตถุดิบประจำวัน กรุณาเข้าสู่ระบบ <b>IRM</b> ผ่านเว็บเบราว์เซอร์ "
                f"แล้วคลิกปุ่ม <b>\"เชื่อมต่อ Telegram\"</b> ที่แถบด้านบนเพื่อสแกน QR Code ประจำตัวของคุณครับ"
            )
            await send_telegram_message_detailed(
                db=db,
                message_text=welcome_msg,
                category="telegram_alert",
                chat_id=str(chat_id),
            )
            return {"ok": True}

    return {"ok": True}


@router.get("/webhook-info")
async def get_webhook_info(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "view"))],
):
    """Query current Telegram Webhook info from Telegram Bot API."""
    settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.category == "telegram"))).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}

    bot_token = s_map.get("telegram_bot_token") or "8231754616:AAHcITgZR6_Gc8XJx-6Fxj-Cyy5bZZQG2hw"
    api_url = s_map.get("telegram_api_url") or "https://api.telegram.org"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(f"{api_url}/bot{bot_token}/getWebhookInfo")
            data = res.json()
            return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch Telegram Webhook Info: {str(e)}",
        )


@router.post("/register-webhook")
async def register_webhook(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
):
    """Register or refresh the Telegram Webhook pointing to IRM production URL."""
    settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.category == "telegram"))).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}

    bot_token = s_map.get("telegram_bot_token") or "8231754616:AAHcITgZR6_Gc8XJx-6Fxj-Cyy5bZZQG2hw"
    api_url = s_map.get("telegram_api_url") or "https://api.telegram.org"
    webhook_target = "https://irm.windowasia.com/api/telegram/webhook"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                f"{api_url}/bot{bot_token}/setWebhook",
                json={
                    "url": webhook_target,
                    "drop_pending_updates": False,
                },
            )
            data = res.json()
            if not data.get("ok"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Telegram API Error: {data.get('description', 'Unknown error')}",
                )

            await record_transaction_log(
                category="system_setting",
                action="register_telegram_webhook",
                status="SUCCESS",
                message="ลงทะเบียน Telegram Webhook สำเร็จ",
                details=f"URL: {webhook_target}",
                db=None,
            )
            return {"message": "ลงทะเบียน Telegram Webhook ไปยัง https://irm.windowasia.com เรียบร้อยแล้ว", "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register Telegram Webhook: {str(e)}",
        )


@router.post("/delete-webhook")
async def delete_webhook(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
):
    """Delete Telegram Webhook."""
    settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.category == "telegram"))).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}

    bot_token = s_map.get("telegram_bot_token") or "8231754616:AAHcITgZR6_Gc8XJx-6Fxj-Cyy5bZZQG2hw"
    api_url = s_map.get("telegram_api_url") or "https://api.telegram.org"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(f"{api_url}/bot{bot_token}/deleteWebhook")
            data = res.json()
            return {"message": "ยกเลิก Telegram Webhook เรียบร้อยแล้ว", "data": data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete Telegram Webhook: {str(e)}",
        )
