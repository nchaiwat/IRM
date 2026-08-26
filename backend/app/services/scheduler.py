"""
Automated Scheduler Service — Background Cron Jobs for Supplier Portal Emails (Mon & Thu 08:00)
and Daily SAP Open PO Ingestion (04:00 AM) using APScheduler.
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

            result = await send_batch_portal_emails(session, max_suppliers=100)
            logger.info(f"✅ [Scheduler] Round 1 Broadcast Completed: {result}")
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

            result = await send_batch_portal_emails(session, max_suppliers=100)
            logger.info(f"✅ [Scheduler] Round 2 Broadcast Completed: {result}")
    except Exception as e:
        logger.error(f"❌ [Scheduler] Error during Round 2 Email Broadcast: {e}")


async def job_sync_sap_daily():
    """Daily SAP Open PO Sync at 04:00 AM"""
    logger.info("⏰ [Scheduler] Executing Daily SAP Open PO Sync (04:00 AM)...")
    try:
        async with AsyncSessionLocal() as session:
            res = await sync_sap_open_pos(session, triggered_by="Daily Scheduler (04:00)")
            logger.info(f"✅ [Scheduler] SAP Sync Completed: {res.get('message')}")
    except Exception as e:
        logger.error(f"❌ [Scheduler] Error during SAP Daily Sync: {e}")


async def job_daily_morning_telegram_summary():
    """Daily Morning Briefing to Telegram at 08:00 AM"""
    logger.info("⏰ [Scheduler] Executing Daily Telegram Morning Summary (08:00 AM)...")
    try:
        async with AsyncSessionLocal() as session:
            from app.services.telegram_service import send_telegram_morning_summary
            res = await send_telegram_morning_summary(session)
            logger.info(f"✅ [Scheduler] Daily Telegram Morning Summary Sent: {res}")
    except Exception as e:
        logger.error(f"❌ [Scheduler] Error during Daily Telegram Morning Summary: {e}")


async def job_daily_pu_remind_email():
    """Checks every minute if current time matches pu_remind_mail_time and dispatches PU remind email."""
    try:
        from zoneinfo import ZoneInfo
        now_bkk = datetime.now(ZoneInfo("Asia/Bangkok"))
        current_hm = now_bkk.strftime("%H:%M")

        async with AsyncSessionLocal() as session:
            from app.models.system_setting import SystemSetting
            from sqlalchemy import select
            stmt = select(SystemSetting).where(SystemSetting.key.in_(["pu_remind_mail_enabled", "pu_remind_mail_time"]))
            rows = (await session.execute(stmt)).scalars().all()
            s_map = {s.key: s.value for s in rows}

            is_enabled = s_map.get("pu_remind_mail_enabled", "false").strip().lower() in ("true", "1", "yes")
            target_time = s_map.get("pu_remind_mail_time", "08:30").strip()

            if is_enabled and current_hm == target_time:
                logger.info(f"⏰ [Scheduler] Triggering Daily PU Reminder Email at {current_hm}...")
                from app.services.email_service import send_pu_daily_reminder_email
                res = await send_pu_daily_reminder_email(session, triggered_by="scheduler")
                logger.info(f"✅ [Scheduler] Daily PU Reminder Email Dispatched: {res}")
    except Exception as e:
        logger.error(f"❌ [Scheduler] Error checking/dispatching PU Reminder Email: {e}")


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

    # Job 3: Daily 04:00 AM SAP Sync
    scheduler.add_job(
        job_sync_sap_daily,
        trigger=CronTrigger(hour=4, minute=0, timezone="Asia/Bangkok"),
        id="sap_sync_daily_0400",
        name="Daily 04:00 AM SAP Open PO Sync",
        replace_existing=True,
    )

    # Job 4: Daily 08:00 AM Telegram Morning Briefing
    scheduler.add_job(
        job_daily_morning_telegram_summary,
        trigger=CronTrigger(hour=8, minute=0, timezone="Asia/Bangkok"),
        id="telegram_morning_summary_daily_0800",
        name="Daily 08:00 AM Telegram Morning Summary Briefing",
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

    scheduler.start()
    logger.info("🚀 [Scheduler] APScheduler started with Mon/Thu Supplier Broadcast, Daily 04:00 SAP Sync, Daily 08:00 Telegram Summary, and PU Reminder Dispatcher.")


def stop_scheduler():
    """Gracefully stop APScheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("🛑 [Scheduler] APScheduler stopped.")

