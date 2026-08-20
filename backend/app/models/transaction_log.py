"""
Transaction Log Model — Tracks all background jobs, external syncs, emails, QMS exports, and system events.
"""

from datetime import datetime
from sqlalchemy import DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TransactionLog(Base):
    __tablename__ = "transaction_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(50), index=True, nullable=False)  # 'sap_sync', 'supplier_email', 'qms_export', 'supplier_portal', 'telegram_alert', 'system_audit'
    action: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., 'sync_open_pos', 'send_batch_email', 'push_qms_json', 'supplier_submit'
    status: Mapped[str] = mapped_column(String(20), index=True, default="success")  # 'success', 'failed', 'warning', 'info'
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON or text detail (e.g. error trace, payload, response)
    records_count: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    triggered_by: Mapped[str] = mapped_column(String(100), default="system_cron")  # 'system_cron', 'user:admin', 'supplier:VD-0004'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self) -> str:
        return f"<TransactionLog(id={self.id}, category='{self.category}', action='{self.action}', status='{self.status}')>"
