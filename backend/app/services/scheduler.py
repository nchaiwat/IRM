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

    scheduler.start()
    logger.info("🚀 [Scheduler] APScheduler started with Mon 08:00, Thu 08:00, and Daily 04:00 jobs.")


def stop_scheduler():
    """Gracefully stop APScheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("🛑 [Scheduler] APScheduler stopped.")
