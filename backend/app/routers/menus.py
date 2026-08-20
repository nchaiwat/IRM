"""
Menu Router — Navigation menu tree structure.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
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
    Get navigation menus structured as a tree.
    Top-level items have parent_id=None (e.g. Operation, Calendar, Item Master, Supplier Master, History, Admin).
    Sub-menus appear inside `children` (e.g. Admin -> System Setting, User Management, Auth Matrix).
    """
    stmt = select(Menu).where(Menu.is_active == True).order_by(Menu.sort_order.asc())
    result = await db.execute(stmt)
    all_menus = result.scalars().all()

    # Map menus by ID for easy tree construction
    menu_map: dict[int, MenuResponse] = {}
    top_level_menus: list[MenuResponse] = []

    # First pass: create all response objects
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

    # Second pass: link children to parents
    for m in all_menus:
        node = menu_map[m.id]
        if m.parent_id and m.parent_id in menu_map:
            menu_map[m.parent_id].children.append(node)
        elif not m.parent_id:
            top_level_menus.append(node)

    return top_level_menus
