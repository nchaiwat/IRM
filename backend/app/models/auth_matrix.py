"""
AuthMatrix model — fine-grained permissions per Group and Menu.
"""

from sqlalchemy import Boolean, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AuthMatrix(Base):
    __tablename__ = "auth_matrix"
    __table_args__ = (UniqueConstraint("group_id", "menu_id", name="uq_group_menu"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    menu_id: Mapped[int] = mapped_column(Integer, ForeignKey("menus.id", ondelete="CASCADE"), nullable=False)
    can_view: Mapped[bool] = mapped_column(Boolean, default=False)
    can_create: Mapped[bool] = mapped_column(Boolean, default=False)
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False)
    can_delete: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    group = relationship("Group", back_populates="auth_entries", lazy="selectin")
    menu = relationship("Menu", back_populates="auth_entries", lazy="selectin")

    def __repr__(self) -> str:
        return f"<AuthMatrix(group_id={self.group_id}, menu_id={self.menu_id}, view={self.can_view})>"
