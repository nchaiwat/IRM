"""
System Settings Router — Configuration management, Telegram test, SAP Connection test, and Manual SAP Sync trigger.
"""

from typing import Annotated
from datetime import datetime
import httpx
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.schemas.system_setting import SystemSettingResponse, SystemSettingsBulkUpdate
from app.services.sap_service import sync_sap_open_pos

router = APIRouter(prefix="/api/settings", tags=["System Settings"])


class TestEmailRequest(BaseModel):
    recipient_email: str
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None




@router.get("", response_model=list[SystemSettingResponse])
async def get_all_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get all system settings."""
    stmt = select(SystemSetting).order_by(SystemSetting.category.asc(), SystemSetting.id.asc())
    result = await db.execute(stmt)
    settings = result.scalars().all()
    return settings


@router.put("", status_code=status.HTTP_200_OK)
async def bulk_update_settings(
    data: SystemSettingsBulkUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Bulk update system settings by key."""
    updated_count = 0
    for item in data.settings:
        stmt = select(SystemSetting).where(SystemSetting.key == item.key)
        result = await db.execute(stmt)
        setting = result.scalar_one_or_none()

        if setting:
            setting.value = item.value
            if item.description is not None:
                setting.description = item.description
            if item.category is not None:
                setting.category = item.category
            if item.data_type is not None:
                setting.data_type = item.data_type
            updated_count += 1
        else:
            cat = item.category
            if not cat:
                if item.key.startswith("smtp_"):
                    cat = "smtp"
                elif item.key.startswith("sap_"):
                    cat = "sap"
                elif item.key.startswith("telegram_"):
                    cat = "telegram"
                else:
                    cat = "general"

            setting = SystemSetting(
                key=item.key,
                value=item.value,
                description=item.description,
                category=cat,
                data_type=item.data_type or "string",
            )
            db.add(setting)
            updated_count += 1

    await db.commit()
    return {"message": f"Successfully updated {updated_count} settings"}


@router.post("/sync-sap")
async def manual_sync_sap_from_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Manually trigger SAP B1 Open PO Sync (Runs SQL Query Report 8). Hosted in System Settings."""
    try:
        res = await sync_sap_open_pos(db, triggered_by=f"Manual Trigger ({current_user.full_name})")
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"เกิดข้อผิดพลาดในการเชื่อมต่อ SAP: {str(e)}",
        )



@router.post("/test-email")
async def test_email_sending(
    data: TestEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Test send a test email to verify SMTP configuration."""
    # Fetch SMTP Settings by keys
    smtp_keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_use_tls"]
    settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.key.in_(smtp_keys)))).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}

    # Override with request body values if provided
    smtp_host = data.smtp_host or s_map.get("smtp_host") or "smtp.gmail.com"
    smtp_port = data.smtp_port or int(s_map.get("smtp_port") or 587)
    smtp_user = data.smtp_user or s_map.get("smtp_user") or "your-email@gmail.com"
    smtp_pass = data.smtp_password if data.smtp_password is not None else (s_map.get("smtp_password") or "")
    use_tls = s_map.get("smtp_use_tls", "true").lower() == "true"

    if not smtp_user or smtp_user == "your-email@gmail.com":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="กรุณาระบุ SMTP Username / Sender Email ก่อนทำการทดสอบ"
        )

    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    subject = "IRM System — Test Email Connection"
    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <h2 style="color: #0284c7;">ระบบ IRM (Incoming Raw Material)</h2>
        <p>เรียนผู้ใช้งาน,</p>
        <p>นี่คืออีเมลทดสอบความถูกต้องของการเชื่อมต่อ SMTP Server ของคุณ</p>
        <p>หากคุณได้รับข้อความนี้ แสดงว่าการตั้งค่า SMTP ถูกต้องและสามารถใช้ส่งอีเมลหา Supplier ได้แล้ว!</p>
        <hr style="border: none; border-top: 1px solid #eee; margin-top: 20px;">
        <p style="font-size: 11px; color: #999;">ทดสอบส่งเมื่อ: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}</p>
      </body>
    </html>
    """

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_user
        msg["To"] = data.recipient_email
        msg.attach(MIMEText(html_body, "html"))

        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10.0)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=10.0)
            if use_tls:
                server.starttls()

        if smtp_pass:
            server.login(smtp_user, smtp_pass)

        server.sendmail(smtp_user, data.recipient_email, msg.as_string())
        server.quit()
        return {"message": f"ทดสอบส่ง Email ไปยัง {data.recipient_email} สำเร็จเรียบร้อยแล้ว!"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"การเชื่อมต่อ SMTP ล้มเหลว ({smtp_host}:{smtp_port}): {str(e)}"
        )



@router.post("/test-telegram-group")
async def test_telegram_group(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Send a test message to the configured Telegram Group."""
    settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.category == "telegram"))).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}

    bot_token = s_map.get("telegram_bot_token") or "8231754616:AAHcITgZR6_Gc8XJx-6Fxj-Cyy5bZZQG2hw"
    group_id = s_map.get("telegram_group_id") or "-5394050672"
    api_url = s_map.get("telegram_api_url") or "https://api.telegram.org"

    from app.services.telegram_service import format_telegram_header

    msg = (
        f"{format_telegram_header('📢 <b>ทดสอบการส่งข้อความเข้ากลุ่ม (Group Broadcast)</b>')}\n\n"
        f"• 👥 <b>กลุ่มเป้าหมาย:</b> IRM Notification Group\n"
        f"• 🆔 <b>Telegram Group ID:</b> <code>{group_id}</code>\n"
        f"• 👤 <b>ผู้ทดสอบ:</b> คุณ{current_user.full_name}\n"
        f"• ⚡ <b>สถานะ:</b> ระบบพร้อมจัดส่งการแจ้งเตือนงานจัดซื้อและ SAP Real-time ทั้งหมด"
    )

    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{api_url}/bot{bot_token}/sendMessage",
                json={
                    "chat_id": group_id,
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
            return {"message": "ส่งข้อความทดสอบไปยังกลุ่ม Telegram สำเร็จแล้ว!"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to send Telegram group message: {str(e)}")


@router.post("/test-sap-connection")
async def test_sap_connection(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Test SQL connection to SAP B1 Server (wa-dbs2.wa.net)."""
    settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.category == "sap"))).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}

    host = s_map.get("sap_host") or "wa-dbs2.wa.net"
    port_str = s_map.get("sap_port") or "1433"
    database = s_map.get("sap_database") or "SBO_COMPANY_DB"
    user = s_map.get("sap_user") or "irm_readonly"
    password = s_map.get("sap_password") or ""

    try:
        port = int(port_str)
    except ValueError:
        port = 1433

    try:
        import pymssql
        conn = pymssql.connect(
            server=host,
            port=port,
            user=user,
            password=password,
            database=database,
            charset='UTF-8',
            login_timeout=10,
            timeout=15,
        )
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) 
            FROM POR1 T0 
            LEFT OUTER JOIN OITM T5 ON T5.ItemCode = T0.ItemCode 
            WHERE T0.LineStatus = 'O' AND T5.ItmsGrpCod IN (113, 115)
        """)
        row_count = cursor.fetchone()[0]
        conn.close()
        return {
            "message": f"✅ ทดสอบเชื่อมต่อ SAP SQL Server ({host}:{port}) สำเร็จ! พบรายการสั่งซื้อเปิดค้างอยู่ทั้งหมด {row_count} รายการ"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"❌ ไม่สามารถเชื่อมต่อ SAP SQL Server ({host}:{port}) ได้: {str(e)}"
        )
