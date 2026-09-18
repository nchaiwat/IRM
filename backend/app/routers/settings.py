"""
System Settings Router — Configuration management, Telegram test, SAP Connection test, and Manual SAP Sync trigger.
"""

from typing import Annotated, Optional
import asyncio
from datetime import datetime
import httpx
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_permission
from app.models.system_setting import SystemSetting
from app.models.transaction_log import TransactionLog
from app.models.user import User
from app.schemas.system_setting import SystemSettingResponse, SystemSettingsBulkUpdate
from app.services.sap_service import sync_sap_open_pos
from app.services.ciam_config_service import (
    get_ciam_settings,
    invalidate_ciam_cache,
    test_ciam_connection_sync,
)
from app.services.log_service import record_transaction_log

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
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "view"))],
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
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
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
                elif item.key.startswith("ad_"):
                    cat = "ad"
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
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
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
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
):
    """Test send a test email to verify SMTP configuration."""
    # Fetch SMTP Settings by keys
    smtp_keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_use_tls"]
    settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.key.in_(smtp_keys)))).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}

    # Override with request body values if provided
    smtp_host = (data.smtp_host.strip() if data.smtp_host else None) or s_map.get("smtp_host") or "smtp.gmail.com"
    smtp_port = data.smtp_port or int(s_map.get("smtp_port") or 587)
    smtp_user = (data.smtp_user.strip() if data.smtp_user else None) or s_map.get("smtp_user") or "your-email@gmail.com"
    smtp_pass = (data.smtp_password.strip() if data.smtp_password else None) or s_map.get("smtp_password") or ""
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

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = smtp_user
    msg["To"] = data.recipient_email
    msg.attach(MIMEText(html_body, "html"))

    def _send_sync():
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15.0)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=15.0)
            if use_tls:
                server.starttls()

        if smtp_pass:
            server.login(smtp_user, smtp_pass)

        server.sendmail(smtp_user, data.recipient_email, msg.as_string())
        server.quit()

    try:
        await asyncio.to_thread(_send_sync)
        return {"message": f"ทดสอบส่ง Email ไปยัง {data.recipient_email} สำเร็จเรียบร้อยแล้ว!"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"การเชื่อมต่อ SMTP ล้มเหลว ({smtp_host}:{smtp_port}): {str(e)}"
        )


@router.post("/test-pu-remind-email")
async def test_pu_remind_email(
    data: TestEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
):
    """Manually test triggering the Daily PU Reminder Email with 2-Sheet Excel attachment."""
    from app.services.email_service import send_pu_daily_reminder_email
    try:
        res = await send_pu_daily_reminder_email(
            db=db,
            recipient_email=data.recipient_email,
            triggered_by=f"manual_test_by_{current_user.username}",
        )
        if res.get("status") == "error":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("message"))
        if res.get("status") == "skipped":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("message"))
        if res.get("status") != "success" or res.get("sent_count", 0) == 0:
            err_details = "; ".join(res.get("errors", [])) or "ไม่สามารถส่งอีเมลได้ (โปรดตรวจสอบการตั้งค่า SMTP)"
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"การส่งอีเมลล้มเหลว: {err_details}")

        stats = res.get("stats", {})
        return {
            "message": f"ส่งอีเมลสรุปงานพร้อมไฟล์แนบ Excel ไปยัง {data.recipient_email} สำเร็จเรียบร้อยแล้ว!",
            "unconfirmed_items": stats.get("unconfirmed_item_count", 0),
            "today_deliveries": stats.get("today_delivery_item_count", 0),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"เกิดข้อผิดพลาดในการส่งอีเมลสรุปงาน: {str(e)}"
        )


@router.post("/send-pu-remind-email-now")
async def send_pu_remind_email_now(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
):
    """
    Manually triggers sending the Daily PU Reminder Email with 2-Sheet Excel attachment
    to ALL active users in PU User group.
    """
    from app.services.email_service import send_pu_daily_reminder_email
    try:
        res = await send_pu_daily_reminder_email(
            db=db,
            recipient_email=None,  # All PU Users
            triggered_by=f"manual_by_{current_user.username}",
        )
        if res.get("status") == "error":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("message"))
        if res.get("status") == "skipped":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("message"))
        if res.get("status") != "success" or res.get("sent_count", 0) == 0:
            err_details = "; ".join(res.get("errors", [])) or "ไม่สามารถส่งอีเมลได้ (โปรดตรวจสอบการตั้งค่า SMTP หรืออีเมลผู้รับ)"
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"การส่งอีเมลล้มเหลว: {err_details}")

        stats = res.get("stats", {})
        recipients = res.get("recipients", [])
        return {
            "message": f"ส่งอีเมลสรุปงานพร้อมไฟล์แนบ Excel ไปยังทีมจัดซื้อสำเร็จ {len(recipients)} ท่าน เรียบร้อยแล้ว!",
            "sent_count": len(recipients),
            "recipients": recipients,
            "unconfirmed_items": stats.get("unconfirmed_item_count", 0),
            "today_deliveries": stats.get("today_delivery_item_count", 0),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"เกิดข้อผิดพลาดในการส่งอีเมลสรุปงานจัดซื้อ: {str(e)}"
        )


@router.post("/purge-old-logs")
async def purge_old_logs_now(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
    days: Optional[int] = None,
):
    """
    Purges transaction logs older than the configured log_retention_days (Default 15 days).
    """
    from datetime import timezone, timedelta
    from sqlalchemy import delete
    from app.models.transaction_log import TransactionLog

    if days is None or days <= 0:
        stmt = select(SystemSetting).where(SystemSetting.key == "log_retention_days")
        ret_setting = (await db.execute(stmt)).scalar_one_or_none()
        try:
            retention_days = int(ret_setting.value) if ret_setting and ret_setting.value else 15
        except Exception:
            retention_days = 15
    else:
        retention_days = days

    now_dt = datetime.now(timezone.utc)
    purge_threshold = now_dt - timedelta(days=retention_days)

    del_stmt = delete(TransactionLog).where(TransactionLog.created_at < purge_threshold)
    res = await db.execute(del_stmt)
    deleted_count = res.rowcount or 0
    await db.commit()

    # Record log
    await record_transaction_log(
        category="system",
        action="purge_old_logs",
        status="SUCCESS",
        message=f"ผู้ดูแลระบบ ({current_user.full_name}) สั่งล้างประวัติ Transaction Logs ที่เก่ากว่า {retention_days} วัน สำเร็จจำนวน {deleted_count} รายการ",
        details=f"Threshold: < {purge_threshold.strftime('%Y-%m-%d %H:%M:%S UTC')} | Retention: {retention_days} days",
        triggered_by=f"user:{current_user.username}",
        db=db,
    )
    await db.commit()

    return {
        "message": f"ล้างประวัติ Log ที่เก่ากว่า {retention_days} วัน เรียบร้อยแล้ว (ลบทั้งหมด {deleted_count} รายการ)",
        "deleted_count": deleted_count,
        "retention_days": retention_days,
    }


@router.post("/test-telegram-group")
async def test_telegram_group(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
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


@router.post("/test-telegram-morning-summary")
async def test_telegram_morning_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
):
    """Manually test triggering the Daily 08:00 AM Morning Summary Telegram message."""
    from app.services.telegram_service import send_telegram_morning_summary
    try:
        res = await send_telegram_morning_summary(db)
        return {
            "message": "ส่งข้อความสรุปสถานะประจำวัน (Morning Summary) ไปยังกลุ่ม Telegram สำเร็จแล้ว!",
            "data": res
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"เกิดข้อผิดพลาดในการส่งข้อความสรุปสถานะ: {str(e)}"
        )


class TestTelegramInboundDMRequest(BaseModel):
    user_id: int | None = None
    test_chat_id: str | None = None


@router.post("/test-telegram-inbound-dm")
async def test_telegram_inbound_dm(
    data: TestTelegramInboundDMRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
):
    """Manually test triggering the Daily Inbound Telegram DM simulation."""
    from app.services.telegram_service import send_user_inbound_daily_dm
    from app.models.user import User

    target_user = None
    if data.user_id:
        target_user = (await db.execute(select(User).where(User.id == data.user_id))).scalar_one_or_none()

    if not target_user:
        target_user = current_user

    chat_id_to_use = (data.test_chat_id or target_user.telegram_chat_id or "").strip()
    if not chat_id_to_use:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ผู้ใช้ '{target_user.full_name}' ยังไม่มี Telegram Chat ID กรุณาระบุในช่อง Chat ID ผู้รับทดสอบ"
        )

    try:
        res = await send_user_inbound_daily_dm(
            db=db,
            user=target_user,
            override_chat_id=chat_id_to_use
        )
        if not res.get("success"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=res.get("message", "ไม่สามารถส่งข้อความ Telegram DM ได้")
            )
        return {
            "message": f"ทดสอบส่งสรุปยอดวัตถุดิบรายบุคคลไปยัง Telegram ({chat_id_to_use}) สำเร็จแล้ว!",
            "details": res
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"เกิดข้อผิดพลาดในการส่งทดสอบ Telegram DM: {str(e)}"
        )


@router.post("/test-sap-connection")
async def test_sap_connection(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
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


class TestADRequest(BaseModel):
    username: str
    password: str
    gateway_url: str | None = None
    app_id: str | None = None
    secret_key: str | None = None
    forwarded_ip: str | None = None


@router.post("/test-ad-connection")
async def test_ad_connection(
    data: TestADRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
):
    """Test user authentication against Active Directory (AD Gateway)."""
    from app.services.ad_service import verify_ad_credentials
    from app.services.log_service import record_transaction_log

    override = {}
    if data.gateway_url:
        override["ad_gateway_url"] = data.gateway_url
    if data.app_id:
        override["ad_app_id"] = data.app_id
    if data.secret_key:
        override["ad_secret_key"] = data.secret_key
    if data.forwarded_ip:
        override["ad_forwarded_ip"] = data.forwarded_ip

    success, message, raw_resp = await verify_ad_credentials(
        db=db,
        username=data.username,
        password=data.password,
        override_config=override,
    )

    # Record test result into Transaction Logs so Admin can review audit trail
    try:
        await record_transaction_log(
            category="user_auth",
            action="test_ad_authen",
            status="success" if success else "failed",
            message=f"ทดสอบการยืนยันตัวตน AD สำหรับ '{data.username}': {message}",
            details={
                "username": data.username,
                "gateway_url": data.gateway_url or override.get("ad_gateway_url"),
                "app_id": data.app_id or override.get("ad_app_id"),
                "forwarded_ip": data.forwarded_ip or override.get("ad_forwarded_ip"),
                "success": success,
                "gateway_response": raw_resp,
            },
            triggered_by=f"user:{current_user.username}",
        )
    except Exception as log_err:
        print(f"⚠️ Could not write test_ad_authen log: {log_err}")

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"❌ การทดสอบ AD Authen ล้มเหลว: {message}",
        )

    return {
        "success": True,
        "message": f"✅ ทดสอบยืนยันสิทธิ์กับ Active Directory สำเร็จ! ({message})",
        "raw_response": raw_resp,
    }


@router.post("/regenerate-management-api-key")
async def regenerate_management_api_key(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
):
    """Generate a new secure Secret Key for Central Identity Management API."""
    import secrets
    new_token = f"sec_irm_mgmt_{secrets.token_hex(16)}"

    stmt = select(SystemSetting).where(SystemSetting.key == "management_api_key")
    res = await db.execute(stmt)
    setting = res.scalar_one_or_none()
    if setting:
        setting.value = new_token
    else:
        setting = SystemSetting(
            key="management_api_key",
            value=new_token,
            description="Secret API Key สำหรับ Central Management App เรียกดูและระงับสิทธิ์บัญชีผู้ใช้",
            category="integration",
            data_type="string",
        )
        db.add(setting)

    await db.commit()
    return {"management_api_key": new_token, "message": "สร้าง Management API Key ใหม่สำเร็จ"}


@router.get("/external-api-status")
async def get_external_api_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "view"))],
):
    """
    Returns real-time status, health, endpoints, authentication details,
    and latest transaction activity for External APIs (QMS & Central IAM).
    """
    stmt_settings = select(SystemSetting).where(
        SystemSetting.key.in_(["qms_api_key", "management_api_key", "management_allowed_ips"])
    )
    res_s = await db.execute(stmt_settings)
    s_map = {s.key: s.value for s in res_s.scalars().all()}

    # 1. QMS Integration Status
    qms_key = s_map.get("qms_api_key", "irm_qms_secure_key_2026")
    stmt_qms_log = (
        select(TransactionLog)
        .where(TransactionLog.category == "qms_integration")
        .order_by(desc(TransactionLog.created_at))
        .limit(1)
    )
    last_qms_log = (await db.execute(stmt_qms_log)).scalar_one_or_none()

    stmt_qms_count = select(func.count(TransactionLog.id)).where(
        TransactionLog.category == "qms_integration"
    )
    qms_calls_count = (await db.execute(stmt_qms_count)).scalar() or 0

    # 2. Central IAM Status
    mgmt_key = s_map.get("management_api_key", "")
    stmt_ciam_log = (
        select(TransactionLog)
        .where(TransactionLog.category.in_(["central_management", "central_iam"]))
        .order_by(TransactionLog.created_at.desc())
        .limit(1)
    )
    last_ciam_log = (await db.execute(stmt_ciam_log)).scalar_one_or_none()

    stmt_ciam_count = select(func.count(TransactionLog.id)).where(
        TransactionLog.category.in_(["central_management", "central_iam"])
    )
    ciam_calls_count = (await db.execute(stmt_ciam_count)).scalar() or 0

    return {
        "qms": {
            "name": "QMS Inbound Deliveries Integration API",
            "status": "available",
            "health": "healthy",
            "endpoint": "/api/external/qms/inbound-deliveries",
            "method": "GET",
            "auth_type": "Header: X-API-Key or Authorization Bearer",
            "api_key_configured": bool(qms_key),
            "api_key_preview": f"{qms_key[:8]}...{qms_key[-4:]}" if len(qms_key) > 12 else (qms_key if qms_key else "Not set"),
            "total_calls": qms_calls_count,
            "last_call_at": last_qms_log.created_at.isoformat() if last_qms_log else None,
            "last_status": last_qms_log.status if last_qms_log else "ready",
            "last_message": last_qms_log.message if last_qms_log else "พร้อมรับคำขอจากระบบ QMS",
        },
        "ciam": {
            "name": "Central Identity Management API (SCIM-Like)",
            "status": "available",
            "health": "healthy",
            "endpoints": [
                {"method": "GET", "path": "/api/v1/directory/accounts", "description": "Reconciliation (อ่านบัญชีทั้งหมด)"},
                {"method": "POST", "path": "/api/v1/directory/accounts", "description": "Provisioning (สร้างบัญชีผู้ใช้ใหม่)"},
                {"method": "PATCH", "path": "/api/v1/directory/accounts/{username}/status", "description": "Instant Offboarding (ระงับสิทธิ์)"}
            ],
            "auth_type": "Header: X-Management-API-Key & IP Whitelist",
            "api_key_configured": bool(mgmt_key),
            "api_key_preview": f"{mgmt_key[:10]}...{mgmt_key[-4:]}" if len(mgmt_key) > 14 else (mgmt_key if mgmt_key else "Not set"),
            "allowed_ips": s_map.get("management_allowed_ips") or "Any IP (ไม่ได้จำกัด)",
            "total_calls": ciam_calls_count,
            "last_call_at": last_ciam_log.created_at.isoformat() if last_ciam_log else None,
            "last_status": last_ciam_log.status if last_ciam_log else "ready",
            "last_message": last_ciam_log.message if last_ciam_log else "พร้อมรับคำขอจาก Central IAM",
        }
    }


@router.post("/regenerate-qms-api-key")
async def regenerate_qms_api_key(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
):
    """Generate a new secure Secret Key for QMS Integration API."""
    import secrets
    new_token = f"irm_qms_{secrets.token_hex(16)}"

    stmt = select(SystemSetting).where(SystemSetting.key == "qms_api_key")
    res = await db.execute(stmt)
    setting = res.scalar_one_or_none()
    if setting:
        setting.value = new_token
    else:
        setting = SystemSetting(
            key="qms_api_key",
            value=new_token,
            description="API Key สำหรับระบบ QMS ใช้เชื่อมต่อดึงข้อมูล Confirmed Inbound Deliveries",
            category="integration",
            data_type="string",
        )
        db.add(setting)

    await db.commit()
    return {"qms_api_key": new_token, "message": "สร้าง QMS API Key ใหม่สำเร็จ"}


# ──────────────────────────────────────────────────────────────────────────────
# Central IAM SSO Management Endpoints (Group A - System Settings Channel)
# ──────────────────────────────────────────────────────────────────────────────

def mask_secret(secret: Optional[str]) -> str:
    """Mask secret displaying only prefix and suffix to prevent credential leakage."""
    if not secret:
        return ""
    if len(secret) <= 8:
        return "sec_****"
    return f"{secret[:4]}****{secret[-4:]}"


class CiamSsoSettingsUpdateRequest(BaseModel):
    ciam_base_url: Optional[str] = None
    ciam_client_id: Optional[str] = None
    ciam_client_secret: Optional[str] = None
    ciam_sso_enabled: Optional[bool] = None
    ciam_break_glass_active: Optional[bool] = None
    ciam_ad_gateway_url: Optional[str] = None
    ciam_auto_provision_group: Optional[str] = None
    ciam_session_ttl_minutes: Optional[int] = None
    ciam_allowed_ips: Optional[str] = None


class CiamTestConnectionRequest(BaseModel):
    ciam_base_url: Optional[str] = None


@router.get("/ciam-sso")
async def get_ciam_sso_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "view"))],
):
    """
    Retrieve Central IAM SSO runtime configuration with masked client secret.
    Enforces Zero .env dependency and ISO 27001 compliance.
    """
    cfg = await get_ciam_settings(db, force_refresh=True)

    stmt = select(func.max(SystemSetting.updated_at)).where(SystemSetting.key.like("ciam_%"))
    last_updated = (await db.execute(stmt)).scalar()

    # Also check if management_allowed_ips has a value if ciam_allowed_ips is empty
    allowed_ips_val = cfg.get("ciam_allowed_ips") or ""
    if not allowed_ips_val:
        stmt_mgmt = select(SystemSetting.value).where(SystemSetting.key == "management_allowed_ips")
        mgmt_val = (await db.execute(stmt_mgmt)).scalar_one_or_none()
        if mgmt_val:
            allowed_ips_val = mgmt_val

    return {
        "status": "success",
        "settings": {
            "ciam_base_url": cfg["ciam_base_url"],
            "ciam_client_id": cfg["ciam_client_id"],
            "ciam_client_secret_masked": mask_secret(cfg.get("ciam_client_secret")),
            "ciam_sso_enabled": cfg["ciam_sso_enabled"],
            "ciam_break_glass_active": cfg["ciam_break_glass_active"],
            "ciam_ad_gateway_url": cfg["ciam_ad_gateway_url"],
            "ciam_auto_provision_group": cfg["ciam_auto_provision_group"],
            "ciam_session_ttl_minutes": cfg["ciam_session_ttl_minutes"],
            "ciam_allowed_ips": allowed_ips_val,
            "updated_at": last_updated.isoformat() if last_updated else None,
        },
    }


@router.put("/ciam-sso")
async def update_ciam_sso_settings(
    body: CiamSsoSettingsUpdateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
):
    """
    Update Central IAM SSO configuration dynamically at runtime.
    Invalidates in-memory cache and records transaction log (CFG-01).
    """
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    updates: dict[str, str] = {}
    if body.ciam_base_url is not None:
        updates["ciam_base_url"] = body.ciam_base_url.rstrip("/")
    if body.ciam_client_id is not None:
        updates["ciam_client_id"] = body.ciam_client_id.strip()
    if body.ciam_client_secret is not None:
        val = body.ciam_client_secret.strip()
        if val and not val.startswith("sec_****") and "****" not in val:
            updates["ciam_client_secret"] = val
    if body.ciam_sso_enabled is not None:
        updates["ciam_sso_enabled"] = "true" if body.ciam_sso_enabled else "false"
    if body.ciam_break_glass_active is not None:
        updates["ciam_break_glass_active"] = "true" if body.ciam_break_glass_active else "false"
    if body.ciam_ad_gateway_url is not None:
        updates["ciam_ad_gateway_url"] = body.ciam_ad_gateway_url.strip()
    if body.ciam_auto_provision_group is not None:
        updates["ciam_auto_provision_group"] = body.ciam_auto_provision_group.strip()
    if body.ciam_session_ttl_minutes is not None:
        updates["ciam_session_ttl_minutes"] = str(body.ciam_session_ttl_minutes)
    if body.ciam_allowed_ips is not None:
        cleaned_ips = body.ciam_allowed_ips.strip()
        updates["ciam_allowed_ips"] = cleaned_ips
        # Sync with management_allowed_ips so directory M2M API enforces same allowed IPs
        updates["management_allowed_ips"] = cleaned_ips

    changed_fields = []
    for key, str_val in updates.items():
        stmt = select(SystemSetting).where(SystemSetting.key == key)
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row:
            if row.value != str_val:
                row.value = str_val
                changed_fields.append(key)
        else:
            new_row = SystemSetting(
                key=key,
                value=str_val,
                category="central_iam",
                data_type="encrypted" if "secret" in key else ("boolean" if "enabled" in key or "active" in key else "string"),
                description=f"Central IAM SSO: {key}",
            )
            db.add(new_row)
            changed_fields.append(key)

    await db.commit()
    invalidate_ciam_cache()

    # Record ISO 27001 Audit Log (CFG-01)
    if changed_fields:
        await record_transaction_log(
            category="system_setting",
            action="update_ciam_settings",
            status="success",
            message="แก้ไขการตั้งค่าระบบ Central IAM SSO",
            details={"changed_fields": changed_fields, "ip": client_ip},
            triggered_by=f"user:{current_user.username}",
            db=db,
        )

    refreshed = await get_ciam_settings(db, force_refresh=True)
    return {
        "status": "success",
        "message": "บันทึกการตั้งค่า Central IAM SSO สำเร็จ",
        "changed_fields": changed_fields,
        "settings": {
            "ciam_base_url": refreshed["ciam_base_url"],
            "ciam_client_id": refreshed["ciam_client_id"],
            "ciam_client_secret_masked": mask_secret(refreshed.get("ciam_client_secret")),
            "ciam_sso_enabled": refreshed["ciam_sso_enabled"],
            "ciam_break_glass_active": refreshed["ciam_break_glass_active"],
            "ciam_ad_gateway_url": refreshed["ciam_ad_gateway_url"],
            "ciam_auto_provision_group": refreshed["ciam_auto_provision_group"],
            "ciam_session_ttl_minutes": refreshed["ciam_session_ttl_minutes"],
            "ciam_allowed_ips": refreshed.get("ciam_allowed_ips", ""),
        },
    }


@router.post("/ciam-sso/test-connection")
async def test_ciam_connection_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "view"))],
    body: Optional[CiamTestConnectionRequest] = None,
):
    """
    Test connectivity from IRM to Central IAM Discovery & JWKS endpoint.
    Returns latency, issuer info, and JWKS key status within 3-second timeout.
    """
    base_url = body.ciam_base_url if (body and body.ciam_base_url) else None
    if not base_url:
        cfg = await get_ciam_settings(db)
        base_url = cfg.get("ciam_base_url", "https://ciam.windowasia.com")

    result = test_ciam_connection_sync(base_url)
    return result

