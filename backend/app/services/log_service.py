"""
Log Service — Asynchronous logging of background tasks, syncs, emails, QMS webhooks, and system operations.
"""

import json
import logging
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.models.transaction_log import TransactionLog

logger = logging.getLogger(__name__)


async def record_transaction_log(
    category: str,
    action: str,
    status: str,
    message: str,
    details: Any = None,
    records_count: int = 0,
    duration_ms: int = 0,
    triggered_by: str = "system_cron",
    db: AsyncSession | None = None,
) -> TransactionLog | None:
    """
    Records a new transaction log entry into the database.
    Can be used with an existing session or will spawn a standalone session.
    """
    details_str = None
    if details is not None:
        if isinstance(details, (dict, list)):
            try:
                details_str = json.dumps(details, ensure_ascii=False, indent=2, default=str)
            except Exception:
                details_str = str(details)
        else:
            details_str = str(details)

    log_entry = TransactionLog(
        category=category,
        action=action,
        status=status,
        message=message[:500],
        details=details_str,
        records_count=records_count,
        duration_ms=duration_ms,
        triggered_by=triggered_by,
    )

    try:
        if db is not None:
            db.add(log_entry)
            await db.commit()
        else:
            async with AsyncSessionLocal() as session:
                session.add(log_entry)
                await session.commit()
                await session.refresh(log_entry)
        return log_entry
    except Exception as e:
        logger.error(f"Failed to write transaction log: {e}", exc_info=True)
        return None
