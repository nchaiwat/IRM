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
    """List all item masters. Guaranteed inline auto-seed if empty."""
    stmt = select(ItemMaster).order_by(ItemMaster.item_code.asc())
    result = await db.execute(stmt)
    items = result.scalars().all()

    if not items:
        items_seed = [
            ("HW-0101-00000", "กรรไกรตัดสีกษณหนาด 60 (180x110)", "113", 60, 3),
            ("HW-0110-00000", "ก้านบานเลื่อนอลูมิเนียม UPVC 800 mm. (PCDQWD22008)", "115", 60, 3),
            ("HW-0118-00000", "ก้านบานเลื่อนอลูมิเนียม UPVC 400 mm. (PCDQWD22004)", "115", 60, 3),
            ("HW-0417-02000", "ตัวล็อกกลางบานหน้าต่าง UPVC สีขาว (PYSL004-WA/PG1111)", "115", 60, 3),
            ("HW-0418-02000", "ตัวล็อกกลางบานหน้าต่าง UPVC สีขาว (PYSL004/F)", "115", 60, 3),
            ("HW-0419-00000", "ตัวแป้นล็อคกลางบานหน้าต่าง UPVC (PSG003)", "115", 60, 3),
            ("HW-0420-00000", "ตัวแป้นล็อคกลางบานหน้าต่าง UPVC (PSG006)", "115", 60, 3),
            ("HW-2110-00000", "หัวล็อกประตู UPVC (PSK206)", "115", 60, 3),
            ("HW-2115-00000", "หัวล็อกบานเลื่อน UPVC (PSK20109)", "115", 60, 3),
            ("HW-3307-02039", "มือจับบานกระทุ้ง R สีขาว (NQ03-R / White PG1111)", "113", 60, 3),
            ("HW-3307-04039", "มือจับบานกระทุ้ง R (NQ03-R / Black)", "113", 60, 3),
            ("HW-3602-15043", "ดันบานเลื่อน สำหรับประตู", "113", 60, 3),
            ("HW-3638-02034", "ล๊อคกลางบานหน้าต่าง-ตัวเรือน ALU10 สีดำ ด้านข้าง", "113", 60, 3),
            ("HW-3638-04039", "ล๊อคกลางบานหน้าต่าง-ตัวเรือน ALU10 สีดำ ด้านข้าง", "113", 60, 3),
            ("HW-3639-02034", "ล๊อคกลางบานหน้าต่าง-ตัวเรือน ALU10 สีขาว ด้านข้าง", "113", 60, 3),
            ("HW-4078-03000", "สลักเกลียว ALU ECO-PLUS เส้นหนา 4.8x12 mm.", "113", 60, 3),
            ("RB2-001-0772-0950", "RB F10 กระจกใส เข็มใส 772x950", "113", 60, 3),
            ("RBU-019-0429-0890", "RB F10 กระจกใส เข็มใส 4 mm. 429x890", "113", 60, 3),
            ("RB2-001-0542-0990", "RB F10 กระจกใส เข็มใส 4 mm. 542x990", "113", 60, 3),
            ("RB2-001-0679-0990", "RB F10 กระจกใส เข็มใส 4 mm. 679x990", "113", 60, 3),
            ("RB2-001-0937-0674", "RB F8 กระจกใส เข็มใส 937x674", "113", 60, 3),
            ("RB2-001-1137-0674", "RB F8 กระจกใส เข็มใส 1137x674", "113", 60, 3),
            ("RB2-001-1537-0674", "RB F8 กระจกใส เข็มใส 1537x674", "113", 60, 3),
            ("RB2-001-1737-0674", "RB F8 กระจกใส เข็มใส 1737x674", "113", 60, 3),
            ("RBU-001-0487-1317", "RB F8 กระจกใส เข็มใส 487x1317", "113", 60, 3),
            ("RBU-001-0517-1355", "RB F8 กระจกใส เข็มใส 517x1355", "113", 60, 3),
            ("RBA-014-0424-0840", "RB F8 กระจกใส เข็มใส 424x840", "113", 60, 3),
            ("RBA-014-0486-0960", "RB F8 กระจกใส เข็มใส 48x96 นิ้ว", "113", 60, 3),
            ("RBU-001-0401-0930", "RB U กระจกใส เข็มใส 401x930", "113", 60, 3),
            ("RBU-001-0832-0915", "RB U กระจกใส เข็มใส 832x915", "113", 60, 3),
            ("RBU-001-0914-0628", "RB U กระจกใส เข็มใส 914x628", "113", 60, 3),
            ("RBU-001-1910-0628", "RB U กระจกใส เข็มใส 1910x628", "113", 60, 3),
            ("RB2-002-0665-1027", "RB U กระจกใส เข็มใส 665x1027", "113", 60, 3),
            ("RBU-019-0503-0936", "RB U กระจกใส เข็มใส 4 mm. 503x936", "113", 60, 3),
        ]
        for icode, desc, grp, lt, na in items_seed:
            db.add(ItemMaster(
                item_code=icode,
                description=desc,
                item_group=grp,
                lead_time_days=lt,
                notify_alert_days=na,
                is_new=True,
            ))
        await db.commit()
        result = await db.execute(stmt)
        items = result.scalars().all()

    return items


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

