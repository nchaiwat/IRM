"""
Supplier Portal Token model — Cryptographic One-Time Access Tokens with PRD Expiration Rules.
"""

from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SupplierPortalToken(Base):
    __tablename__ = "supplier_portal_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    supplier_code: Mapped[str] = mapped_column(String(50), nullable=False)
    po_number: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)
    is_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self) -> str:
        return f"<SupplierPortalToken(id={self.id}, supplier_code='{self.supplier_code}', is_submitted={self.is_submitted})>"
