"""
Item Master Router — CRUD, Accept New Record, Lead Time / Notify Alert Management, and Fail-Safe Auto-Seeding.
"""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.master import ItemMaster
from app.models.user import User
from app.schemas.master import ItemMasterCreate, ItemMasterResponse, ItemMasterUpdate

router = APIRouter(prefix="/api/items", tags=["Item Master"])


@router.get("", response_model=list[ItemMasterResponse])
async def list_items(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """List all item masters."""
    stmt = select(ItemMaster).order_by(ItemMaster.item_code.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ItemMasterResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    data: ItemMasterCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Create a new item master."""
    existing = await db.execute(select(ItemMaster).where(ItemMaster.item_code == data.item_code))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Item Code already exists")

    item = ItemMaster(
        item_code=data.item_code,
        description=data.description,
        lead_time_days=data.lead_time_days,
        notify_alert_days=data.notify_alert_days,
        item_group=data.item_group or "113",
        is_new=True,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{item_id}", response_model=ItemMasterResponse)
async def update_item(
    item_id: int,
    data: ItemMasterUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Update item master (Lead Time, Notify Alert Days, Description, Item Group, is_new)."""
    stmt = select(ItemMaster).where(ItemMaster.id == item_id)
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    if data.description is not None:
        item.description = data.description
    if data.lead_time_days is not None:
        item.lead_time_days = data.lead_time_days
    if data.notify_alert_days is not None:
        item.notify_alert_days = data.notify_alert_days
    if data.item_group is not None:
        item.item_group = data.item_group
    if data.is_new is not None:
        item.is_new = data.is_new

    await db.commit()
    await db.refresh(item)
    return item


@router.post("/{item_id}/accept", response_model=ItemMasterResponse)
async def accept_new_item(
    item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Accept a new Item Master record, clearing the 'is_new' badge."""
    stmt = select(ItemMaster).where(ItemMaster.id == item_id)
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    item.is_new = False
    await db.commit()
    await db.refresh(item)
    return item


from pydantic import BaseModel

class ItemBulkItem(BaseModel):
    item_code: str
    description: str | None = None
    item_group: str | None = None
    lead_time_days: int | None = None
    notify_alert_days: int | None = None

class ItemBulkUpdateRequest(BaseModel):
    items: list[ItemBulkItem]


@router.post("/bulk-update")
async def bulk_update_items(
    data: ItemBulkUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Bulk update item master records by item_code."""
    updated_count = 0
    for item in data.items:
        if not item.item_code:
            continue
        stmt = select(ItemMaster).where(ItemMaster.item_code == item.item_code.strip())
        itm = (await db.execute(stmt)).scalar_one_or_none()
        if itm:
            if item.description:
                itm.description = item.description.strip()
            if item.item_group:
                itm.item_group = item.item_group.strip()
            if item.lead_time_days is not None:
                itm.lead_time_days = item.lead_time_days
            if item.notify_alert_days is not None:
                itm.notify_alert_days = item.notify_alert_days
            updated_count += 1

    await db.commit()
    return {"message": f"อัปเดตข้อมูล Item Master สำเร็จ {updated_count} รายการ", "updated_count": updated_count}

