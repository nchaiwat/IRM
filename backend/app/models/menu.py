"""
Menu model — application navigation items (supports hierarchy for Admin sub-menus).
"""

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Menu(Base):
    __tablename__ = "menus"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    path: Mapped[str | None] = mapped_column(String(100), nullable=True)  # Null if it's a parent header like "Admin"
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    parent_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("menus.id", ondelete="CASCADE"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Self-referential relationships
    parent = relationship("Menu", remote_side=[id], back_populates="children", lazy="selectin")
    children = relationship("Menu", back_populates="parent", cascade="all, delete-orphan", lazy="selectin", order_by="Menu.sort_order")

    # Relationships
    auth_entries = relationship("AuthMatrix", back_populates="menu", cascade="all, delete-orphan", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Menu(id={self.id}, name='{self.name}', parent_id={self.parent_id})>"
