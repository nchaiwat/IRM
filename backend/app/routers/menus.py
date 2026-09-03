"""
Menu Router — Navigation menu tree structure.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.auth_matrix import AuthMatrix
from app.models.menu import Menu
from app.models.user import User
from app.schemas.menu import MenuResponse

router = APIRouter(prefix="/api/menus", tags=["Menus"])


@router.get("", response_model=list[MenuResponse])
async def get_menu_tree(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Get navigation menus structured as a tree, filtered by user group permissions.
    - Admin group gets all active menus.
    - Non-admin groups get only menus where `can_view == True` in AuthMatrix.
    - Parent menus (e.g. Admin) are only shown if they contain at least one visible child.
    """
    # 1. Fetch all active menus
    stmt = select(Menu).where(Menu.is_active == True).order_by(Menu.sort_order.asc())
    result = await db.execute(stmt)
    all_menus = result.scalars().all()

    is_admin = bool(current_user.group and current_user.group.name.lower() == "admin")

    # 2. If not admin, determine allowed menu IDs from AuthMatrix
    allowed_menu_ids: set[int] = set()
    if is_admin:
        allowed_menu_ids = {m.id for m in all_menus}
    elif current_user.group_id:
        matrix_stmt = select(AuthMatrix).where(
            AuthMatrix.group_id == current_user.group_id,
            AuthMatrix.can_view == True,
        )
        matrix_rows = (await db.execute(matrix_stmt)).scalars().all()
        allowed_menu_ids = {row.menu_id for row in matrix_rows}
    else:
        return []

    # 3. Build menu map
    menu_map: dict[int, MenuResponse] = {}
    for m in all_menus:
        menu_map[m.id] = MenuResponse(
            id=m.id,
            name=m.name,
            path=m.path,
            icon=m.icon,
            sort_order=m.sort_order,
            parent_id=m.parent_id,
            is_active=m.is_active,
            children=[],
        )

    # 4. Link children to parent menus (only include children that are permitted)
    top_level_menus: list[MenuResponse] = []
    for m in all_menus:
        node = menu_map[m.id]
        if m.parent_id and m.parent_id in menu_map:
            if is_admin or m.id in allowed_menu_ids:
                menu_map[m.parent_id].children.append(node)
        elif not m.parent_id:
            # Top-level item
            top_level_menus.append(node)

    # 5. Filter top-level menus
    final_top_menus: list[MenuResponse] = []
    for m in top_level_menus:
        has_children = len(m.children) > 0
        if is_admin:
            final_top_menus.append(m)
        elif has_children:
            # Parent menu has visible children -> keep it
            final_top_menus.append(m)
        elif m.id in allowed_menu_ids:
            # Top-level standalone menu with permission -> keep it
            final_top_menus.append(m)

    for m in final_top_menus:
        m.children.sort(key=lambda c: c.sort_order)
    final_top_menus.sort(key=lambda m: m.sort_order)

    return final_top_menus
