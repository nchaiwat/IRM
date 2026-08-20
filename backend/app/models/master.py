"""
Item Master and Supplier Master ORM Models with is_new Badge Support.
"""

from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ItemMaster(Base):
    __tablename__ = "item_masters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=60)
    notify_alert_days: Mapped[int] = mapped_column(Integer, default=3)
    item_group: Mapped[str | None] = mapped_column(String(50), nullable=True, default="113")
    is_new: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SupplierMaster(Base):
    __tablename__ = "supplier_masters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    supplier_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    telephone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contact_person: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_new: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_over_delivery: Mapped[bool] = mapped_column(Boolean, default=False)
    last_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

