"""
Auth Matrix Router — Grid matrix of permissions per Group x Menu.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_permission
from app.models.auth_matrix import AuthMatrix
from app.models.group import Group
from app.models.menu import Menu
from app.models.user import User
from app.schemas.auth_matrix import (
    AuthMatrixBulkUpdate,
    AuthMatrixCell,
    GroupMatrixRow,
)

router = APIRouter(prefix="/api/auth-matrix", tags=["Auth Matrix"])


@router.get("", response_model=list[GroupMatrixRow])
async def get_matrix_grid(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/auth-matrix", "view"))],
):
    """
    Get full Auth Matrix grid: Groups (rows) x Menus (columns).
    Returns list of rows, each containing a group ID, name, and permissions for all menus.
    """
    groups_stmt = select(Group).where(Group.is_active == True).order_by(Group.id.asc())
    groups = (await db.execute(groups_stmt)).scalars().all()

    # Query actionable menus with path, ordered logically: Top-level first, then Admin sub-menus
    menus_stmt = (
        select(Menu)
        .where(Menu.is_active == True, Menu.path.is_not(None))
        .order_by(Menu.parent_id.asc().nullsfirst(), Menu.sort_order.asc(), Menu.id.asc())
    )
    menus = (await db.execute(menus_stmt)).scalars().all()

    matrix_stmt = select(AuthMatrix)
    matrix_entries = (await db.execute(matrix_stmt)).scalars().all()

    # Index matrix entries by (group_id, menu_id)
    entry_map: dict[tuple[int, int], AuthMatrix] = {
        (entry.group_id, entry.menu_id): entry for entry in matrix_entries
    }

    rows: list[GroupMatrixRow] = []
    for g in groups:
        cells: list[AuthMatrixCell] = []
        is_admin_group = g.name.lower() == "admin"

        for m in menus:
            entry = entry_map.get((g.id, m.id))
            cells.append(
                AuthMatrixCell(
                    menu_id=m.id,
                    menu_name=m.name,
                    menu_path=m.path,
                    parent_id=m.parent_id,
                    can_view=True if is_admin_group else (entry.can_view if entry else False),
                    can_create=True if is_admin_group else (entry.can_create if entry else False),
                    can_edit=True if is_admin_group else (entry.can_edit if entry else False),
                    can_delete=True if is_admin_group else (entry.can_delete if entry else False),
                )
            )
        rows.append(GroupMatrixRow(group_id=g.id, group_name=g.name, permissions=cells))

    return rows


@router.put("", status_code=status.HTTP_200_OK)
async def bulk_update_matrix(
    data: AuthMatrixBulkUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/auth-matrix", "edit"))],
):
    """Bulk update permission matrix entries."""
    for item in data.entries:
        stmt = select(AuthMatrix).where(
            AuthMatrix.group_id == item.group_id,
            AuthMatrix.menu_id == item.menu_id,
        )
        result = await db.execute(stmt)
        entry = result.scalar_one_or_none()

        if entry:
            entry.can_view = item.can_view
            entry.can_create = item.can_create
            entry.can_edit = item.can_edit
            entry.can_delete = item.can_delete
        else:
            entry = AuthMatrix(
                group_id=item.group_id,
                menu_id=item.menu_id,
                can_view=item.can_view,
                can_create=item.can_create,
                can_edit=item.can_edit,
                can_delete=item.can_delete,
            )
            db.add(entry)

    await db.commit()
    return {"message": f"Successfully updated {len(data.entries)} auth matrix entries"}
