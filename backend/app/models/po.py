"""
PO Models — PO Header, PO Items, Sub Items, and Audit Logs.
"""

from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class POHeader(Base):
    __tablename__ = "po_headers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    po_number: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    po_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    supplier_code: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    supplier_name: Mapped[str] = mapped_column(String(150), nullable=False)
    buyer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="O")  # O = Open, C = Closed

    items = relationship("POItem", back_populates="header", cascade="all, delete-orphan", lazy="selectin")


class POItem(Base):
    __tablename__ = "po_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    po_header_id: Mapped[int] = mapped_column(Integer, ForeignKey("po_headers.id", ondelete="CASCADE"), nullable=False)
    line_num: Mapped[int] = mapped_column(Integer, default=0, nullable=True)
    item_code: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    item_name: Mapped[str] = mapped_column(String(250), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)  # Original PO Qty
    unit: Mapped[str] = mapped_column(String(20), default="แผ่น")
    received_qty: Mapped[float] = mapped_column(Float, default=0.0)
    remaining_qty: Mapped[float] = mapped_column(Float, nullable=False)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    item_group: Mapped[str | None] = mapped_column(String(50), nullable=True, default="RM-กระจก")
    
    # Estimate Planning Data
    estimate_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    estimate_qty: Mapped[float | None] = mapped_column(Float, nullable=True)
    
    # Status: 'pending', 'estimate', 'supplier_responded', 'confirmed', 'delay', 'closed'
    status: Mapped[str] = mapped_column(String(30), default="pending")
    is_new: Mapped[bool] = mapped_column(Boolean, default=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Ownership Lock & Conflict Management ('user' | 'supplier' | None)
    locked_by: Mapped[str | None] = mapped_column(String(20), nullable=True)
    lock_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Audit Trail (ใครเป็นคนอัปเดตล่าสุด)
    updated_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)  # เช่น "Patcha", "Pinyada", "ABC Comp."
    updated_by_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 'user' หรือ 'supplier'
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    header = relationship("POHeader", back_populates="items", lazy="selectin")
    sub_items = relationship("SubItem", back_populates="parent_item", cascade="all, delete-orphan", lazy="selectin")
    audit_logs = relationship("POItemAuditLog", back_populates="po_item", cascade="all, delete-orphan", lazy="selectin")


class SubItem(Base):
    __tablename__ = "sub_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    po_item_id: Mapped[int] = mapped_column(Integer, ForeignKey("po_items.id", ondelete="CASCADE"), nullable=False)
    estimate_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    
    # Audit Trail per sub-item
    updated_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    updated_by_type: Mapped[str | None] = mapped_column(String(20), nullable=True, default="user")  # 'user' หรือ 'supplier'
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    parent_item = relationship("POItem", back_populates="sub_items", lazy="selectin")


class POItemAuditLog(Base):
    __tablename__ = "po_item_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    po_item_id: Mapped[int] = mapped_column(Integer, ForeignKey("po_items.id", ondelete="CASCADE"), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # 'create', 'update_estimate', 'accept_supplier', 'split_subitem'
    changes_detail: Mapped[str] = mapped_column(Text, nullable=False)  # JSON or text string of changes
    changed_by_name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "Patcha", "Supplier ABC"
    changed_by_type: Mapped[str] = mapped_column(String(20), default="user")
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    po_item = relationship("POItem", back_populates="audit_logs", lazy="selectin")
