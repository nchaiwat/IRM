"""
Automated Scheduler Service — Background Cron Jobs for Supplier Portal Emails (Mon & Thu 08:00)
and Daily SAP Open PO Ingestion (06:45 AM) using APScheduler.
"""

import logging
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import AsyncSessionLocal
from app.services.email_service import send_batch_portal_emails
from app.services.sap_service import sync_sap_open_pos

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Asia/Bangkok")


async def job_send_portal_emails_round1():
    """Round 1: Triggered Monday at 08:00 AM (Expires Wednesday 23:59:59)"""
    logger.warning("🛡️ [SAFEGUARD] Monday Scheduled Email Job triggered, checking safety lock...")
    try:
        async with AsyncSessionLocal() as session:
            # Check safety setting
            from app.models.system_setting import SystemSetting
            from sqlalchemy import select
            stmt = select(SystemSetting).where(SystemSetting.key == "mail_schedule_enabled")
            setting = (await session.execute(stmt)).scalar_one_or_none()
            if not setting or setting.value.lower() not in ("true", "1", "yes"):
                logger.warning("🛡️ [SAFEGUARD] Scheduled Email Broadcast is LOCKED (mail_schedule_enabled=false). No emails sent to suppliers during Implementation Phase.")
                return

            result = await send_batch_portal_emails(session, max_suppliers=100, round_name="รอบวันจันทร์")
            logger.info(f"✅ [Scheduler] Round 1 (Monday) Broadcast Completed: {result}")
    except Exception as e:
        logger.error(f"❌ [Scheduler] Error during Round 1 Email Broadcast: {e}")


async def job_send_portal_emails_round2():
    """Round 2: Triggered Thursday at 08:00 AM (Expires Sunday 23:59:59)"""
    logger.warning("🛡️ [SAFEGUARD] Thursday Scheduled Email Job triggered, checking safety lock...")
    try:
        async with AsyncSessionLocal() as session:
            # Check safety setting
            from app.models.system_setting import SystemSetting
            from sqlalchemy import select
            stmt = select(SystemSetting).where(SystemSetting.key == "mail_schedule_enabled")
            setting = (await session.execute(stmt)).scalar_one_or_none()
            if not setting or setting.value.lower() not in ("true", "1", "yes"):
                logger.warning("🛡️ [SAFEGUARD] Scheduled Email Broadcast is LOCKED (mail_schedule_enabled=false). No emails sent to suppliers during Implementation Phase.")
                return

            result = await send_batch_portal_emails(session, max_suppliers=100, round_name="รอบวันพฤหัสบดี")
            logger.info(f"✅ [Scheduler] Round 2 (Thursday) Broadcast Completed: {result}")
    except Exception as e:
        logger.error(f"❌ [Scheduler] Error during Round 2 Email Broadcast: {e}")


async def job_sync_sap_daily():
    """Daily SAP Open PO Sync at 06:45 AM"""
    logger.info("⏰ [Scheduler] Executing Daily SAP Open PO Sync (06:45 AM)...")
    try:
        async with AsyncSessionLocal() as session:
            res = await sync_sap_open_pos(session, triggered_by="Daily Scheduler (06:45)")
            logger.info(f"✅ [Scheduler] SAP Sync Completed: {res.get('message')}")
    except Exception as e:
        logger.error(f"❌ [Scheduler] Error during SAP Daily Sync: {e}")


_last_telegram_morning_date: str | None = None
_last_telegram_inbound_dm_date: str | None = None


def _normalize_hm(t_str: str) -> str:
    """Normalizes 'H:M' or 'HH:MM' time string to standard 'HH:MM' format."""
    try:
        parts = t_str.strip().split(":")
        if len(parts) == 2:
            return f"{int(parts[0]):02d}:{int(parts[1]):02d}"
    except Exception:
        pass
    return t_str.strip()


async def job_daily_morning_telegram_summary():
    """Checks every minute if current time matches telegram_morning_summary_time and dispatches Morning Briefing."""
    global _last_telegram_morning_date
    try:
        from zoneinfo import ZoneInfo
        now_bkk = datetime.now(ZoneInfo("Asia/Bangkok"))
        current_hm = now_bkk.strftime("%H:%M")
        today_date_str = now_bkk.strftime("%Y-%m-%d")

        async with AsyncSessionLocal() as session:
            from app.models.system_setting import SystemSetting
            from sqlalchemy import select
            stmt = select(SystemSetting).where(
                SystemSetting.key.in_(["telegram_morning_summary_enabled", "telegram_morning_summary_time"])
            )
            rows = (await session.execute(stmt)).scalars().all()
            s_map = {s.key: s.value for s in rows}

            is_enabled = s_map.get("telegram_morning_summary_enabled", "true").strip().lower() in ("true", "1", "yes")
            target_time = _normalize_hm(s_map.get("telegram_morning_summary_time", "08:00"))

            if is_enabled and current_hm == target_time:
                if _last_telegram_morning_date == today_date_str:
                    return  # Already dispatched today
                logger.info(f"⏰ [Scheduler] Triggering Daily Telegram Morning Summary at {current_hm}...")
                from app.services.telegram_service import send_telegram_morning_summary
                res = await send_telegram_morning_summary(session)
                await session.commit()
                _last_telegram_morning_date = today_date_str
                logger.info(f"✅ [Scheduler] Daily Telegram Morning Summary Sent: {res}")
    except Exception as e:
        logger.error(f"❌ [Scheduler] Error during Daily Telegram Morning Summary: {e}")


async def job_daily_inbound_telegram_dm():
    """Checks every minute if current time matches telegram_inbound_dm_time and dispatches Inbound DMs."""
    global _last_telegram_inbound_dm_date
    try:
        from zoneinfo import ZoneInfo
        now_bkk = datetime.now(ZoneInfo("Asia/Bangkok"))
        current_hm = now_bkk.strftime("%H:%M")
        today_date_str = now_bkk.strftime("%Y-%m-%d")

        async with AsyncSessionLocal() as session:
            from app.models.system_setting import SystemSetting
            from sqlalchemy import select
            stmt = select(SystemSetting).where(
                SystemSetting.key.in_(["telegram_inbound_dm_enabled", "telegram_inbound_dm_time"])
            )
            rows = (await session.execute(stmt)).scalars().all()
            s_map = {s.key: s.value for s in rows}

            is_enabled = s_map.get("telegram_inbound_dm_enabled", "false").strip().lower() in ("true", "1", "yes")
            target_time = _normalize_hm(s_map.get("telegram_inbound_dm_time", "07:30"))

            if is_enabled and current_hm == target_time:
                if _last_telegram_inbound_dm_date == today_date_str:
                    return  # Already dispatched today
                logger.info(f"⏰ [Scheduler] Triggering Daily Inbound Telegram DMs at {current_hm}...")
                from app.services.telegram_service import send_batch_inbound_daily_dms
                res = await send_batch_inbound_daily_dms(session)
                await session.commit()
                _last_telegram_inbound_dm_date = today_date_str
                logger.info(f"✅ [Scheduler] Daily Inbound Telegram DMs Dispatched: {res}")
    except Exception as e:
        logger.error(f"❌ [Scheduler] Error during Daily Inbound Telegram DM dispatch: {e}")


_last_pu_remind_date: str = ""


async def job_daily_pu_remind_email():
    """Checks every minute if current time matches pu_remind_mail_time and dispatches PU remind email."""
    global _last_pu_remind_date
    try:
        from zoneinfo import ZoneInfo
        now_bkk = datetime.now(ZoneInfo("Asia/Bangkok"))
        today_date_str = now_bkk.strftime("%Y-%m-%d")
        current_hm = now_bkk.strftime("%H:%M")

        async with AsyncSessionLocal() as session:
            from app.models.system_setting import SystemSetting
            from sqlalchemy import select
            stmt = select(SystemSetting).where(SystemSetting.key.in_(["pu_remind_mail_enabled", "pu_remind_mail_time"]))
            rows = (await session.execute(stmt)).scalars().all()
            s_map = {s.key: s.value for s in rows}

            is_enabled = s_map.get("pu_remind_mail_enabled", "false").strip().lower() in ("true", "1", "yes")
            target_time = _normalize_hm(s_map.get("pu_remind_mail_time", "08:30"))

            if is_enabled and current_hm == target_time:
                if _last_pu_remind_date == today_date_str:
                    return  # Already dispatched today
                logger.info(f"⏰ [Scheduler] Triggering Daily PU Reminder Email at {current_hm} (target: {target_time})...")
                from app.services.email_service import send_pu_daily_reminder_email
                res = await send_pu_daily_reminder_email(session, triggered_by="scheduler")
                await session.commit()
                _last_pu_remind_date = today_date_str
                logger.info(f"✅ [Scheduler] Daily PU Reminder Email Dispatched: {res}")
    except Exception as e:
        logger.error(f"❌ [Scheduler] Error checking/dispatching PU Reminder Email: {e}")


async def job_daily_purge_old_logs():
    """Daily Transaction Log Purge: Removes logs older than log_retention_days (Default 15 days)."""
    logger.info("🧹 [Scheduler] Executing Daily Transaction Log Purge...")
    try:
        async with AsyncSessionLocal() as session:
            from app.models.system_setting import SystemSetting
            from app.models.transaction_log import TransactionLog
            from sqlalchemy import select, delete
            from datetime import timedelta
            from app.services.log_service import record_transaction_log

            stmt = select(SystemSetting).where(SystemSetting.key == "log_retention_days")
            ret_setting = (await session.execute(stmt)).scalar_one_or_none()
            try:
                retention_days = int(ret_setting.value) if ret_setting and ret_setting.value else 15
            except Exception:
                retention_days = 15

            now_dt = datetime.now(timezone.utc)
            purge_threshold = now_dt - timedelta(days=retention_days)

            del_stmt = delete(TransactionLog).where(TransactionLog.created_at < purge_threshold)
            res = await session.execute(del_stmt)
            deleted_count = res.rowcount or 0
            await session.commit()

            if deleted_count > 0:
                logger.info(f"✅ [Scheduler] Purged {deleted_count} logs older than {retention_days} days.")
                await record_transaction_log(
                    category="system",
                    action="purge_old_logs",
                    status="SUCCESS",
                    message=f"ล้างประวัติ Transaction Logs ที่เก่ากว่า {retention_days} วัน สำเร็จจำนวน {deleted_count} รายการ",
                    details=f"Threshold: < {purge_threshold.strftime('%Y-%m-%d %H:%M:%S UTC')} | Retention: {retention_days} days",
                    triggered_by="system_cron",
                    db=session,
                )
                await session.commit()
    except Exception as e:
        logger.error(f"❌ [Scheduler] Error during daily log purge: {e}")


def start_scheduler():
    """Start APScheduler with defined cron jobs."""
    if scheduler.running:
        return

    # Job 1: Monday 08:00 AM (Round 1)
    scheduler.add_job(
        job_send_portal_emails_round1,
        trigger=CronTrigger(day_of_week="mon", hour=8, minute=0, timezone="Asia/Bangkok"),
        id="supplier_email_mon_0800",
        name="Monday 08:00 AM Supplier Email Broadcast",
        replace_existing=True,
    )

    # Job 2: Thursday 08:00 AM (Round 2)
    scheduler.add_job(
        job_send_portal_emails_round2,
        trigger=CronTrigger(day_of_week="thu", hour=8, minute=0, timezone="Asia/Bangkok"),
        id="supplier_email_thu_0800",
        name="Thursday 08:00 AM Supplier Email Broadcast",
        replace_existing=True,
    )

    # Job 3: Daily 06:45 AM SAP Sync
    scheduler.add_job(
        job_sync_sap_daily,
        trigger=CronTrigger(hour=6, minute=45, timezone="Asia/Bangkok"),
        id="sap_sync_daily_0645",
        name="Daily 06:45 AM SAP Open PO Sync",
        replace_existing=True,
    )

    # Job 4: Daily Telegram Morning Briefing (Minute-Checker with dynamic time)
    scheduler.add_job(
        job_daily_morning_telegram_summary,
        trigger=CronTrigger(second=0, timezone="Asia/Bangkok"),
        id="telegram_morning_summary_minute_checker",
        name="Daily Telegram Morning Summary Dispatcher",
        replace_existing=True,
    )

    # Job 5: Daily PU Reminder Email with Excel (Minute-Checker)
    scheduler.add_job(
        job_daily_pu_remind_email,
        trigger=CronTrigger(second=0, timezone="Asia/Bangkok"),
        id="pu_remind_email_minute_checker",
        name="Daily PU Reminder Email Dispatcher",
        replace_existing=True,
    )

    # Job 6: Daily Inbound Telegram DM for Non-PU (Minute-Checker)
    scheduler.add_job(
        job_daily_inbound_telegram_dm,
        trigger=CronTrigger(second=0, timezone="Asia/Bangkok"),
        id="telegram_inbound_dm_minute_checker",
        name="Daily Inbound Telegram DM Dispatcher",
        replace_existing=True,
    )

    # Job 7: Daily 00:30 AM Transaction Log Purge (Log Retention)
    scheduler.add_job(
        job_daily_purge_old_logs,
        trigger=CronTrigger(hour=0, minute=30, timezone="Asia/Bangkok"),
        id="transaction_log_daily_purge",
        name="Daily 00:30 AM Transaction Log Purge",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("🚀 [Scheduler] APScheduler started with Supplier Broadcast, Daily SAP Sync, Morning Summary, Inbound DM, PU Reminder, and Log Purge.")


def stop_scheduler():
    """Gracefully stop APScheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("🛑 [Scheduler] APScheduler stopped.")

