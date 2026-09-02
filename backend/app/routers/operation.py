"""
Operation Router — Manage open PO items, update estimate date/qty, split sub-items, track audit history, strict remaining_qty validation, and auto-population of SupplierMaster and ItemMaster.
"""

from datetime import datetime, timezone, timedelta
from typing import Annotated
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import (
    get_current_user,
    require_permission,
    get_effective_user_allowed_groups,
    is_user_allowed_group,
)
from app.models.po import POHeader, POItem, POItemAuditLog, SubItem
from app.models.master import ItemMaster, SupplierMaster
from app.models.user import User
from app.schemas.po import POItemResponse, POItemUpdate
from app.services.sap_service import sync_sap_open_pos

from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/api/operation", tags=["Operation"])


class SubItemUpdateInput(BaseModel):
    estimate_date: datetime
    quantity: float


@router.get("", response_model=list[POItemResponse])
async def list_open_po_items(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/operation", "view"))],
):
    """
    High-performance endpoint: Get all open PO items for Operation page.
    Uses indexed queries and single-pass serialization without blocking network calls or N+1 queries.
    """
    stmt = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .where(POHeader.status == "O")
        .where(POItem.status != "closed")
        .options(selectinload(POItem.sub_items))
        .order_by(POHeader.po_number.desc(), POItem.id.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    # Fast batch lookup for allow_over_delivery map
    sup_rows = (await db.execute(select(SupplierMaster.supplier_code, SupplierMaster.allow_over_delivery))).all()
    sup_over_map = {row[0]: row[1] for row in sup_rows if row[0]}

    user_allowed = get_effective_user_allowed_groups(current_user)

    items_response: list[POItemResponse] = []
    for item, header in rows:
        grp = item.item_group or "-"
        if not is_user_allowed_group(user_allowed, grp):
            continue

        items_response.append(
            POItemResponse(
                id=item.id,
                po_header_id=header.id,
                line_num=item.line_num or 0,
                po_number=header.po_number,
                po_date=header.po_date,
                supplier_code=header.supplier_code,
                supplier_name=header.supplier_name,
                buyer_name=header.buyer_name,
                item_code=item.item_code,
                item_name=item.item_name,
                quantity=item.quantity,
                unit=item.unit,
                received_qty=item.received_qty,
                remaining_qty=item.remaining_qty,
                due_date=item.due_date,
                item_group=item.item_group or "RM-กระจก",
                estimate_date=item.estimate_date,
                estimate_qty=item.estimate_qty,
                allow_over_delivery=sup_over_map.get(header.supplier_code, False),
                status=item.status,
                is_new=item.is_new,
                closed_at=item.closed_at,
                locked_by=item.locked_by,
                lock_expires_at=item.lock_expires_at,
                updated_by_name=item.updated_by_name,
                updated_by_type=item.updated_by_type,
                updated_at=item.updated_at,
                sub_items=item.sub_items or [],
                audit_logs=[],
            )
        )
    return items_response


@router.post("/sync-sap")
async def manual_sync_sap(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Manually trigger SAP B1 Sync (Runs SQL Query Report 8)."""
    try:
        res = await sync_sap_open_pos(db, triggered_by=current_user.full_name)
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"เกิดข้อผิดพลาดในการเชื่อมต่อ SAP: {str(e)}",
        )



@router.put("/{item_id}", response_model=POItemResponse)
async def update_po_item(
    item_id: int,
    data: POItemUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Update PO Item Estimate Date/Qty or Sub-Items.
    Enforces ownership locking (Supplier Window) and strict quantity validation.
    """
    stmt = (
        select(POItem)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
        .where(POItem.id == item_id)
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PO Item not found")

    now_dt = datetime.now(timezone.utc)

    # 1. OWNERSHIP LOCKING & CONFLICT PREVENTION
    if item.locked_by == "supplier" and item.lock_expires_at and item.lock_expires_at > now_dt:
        if not data.force_override:
            exp_str = item.lock_expires_at.strftime("%d/%m/%Y เวลา %H:%M น.")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"⚠️ รายการนี้กำลังอยู่ในช่วงที่ Supplier กำลังเปิดกรอกข้อมูล (เปิดถึง {exp_str}) หากจำเป็นต้องแก้ไขด่วน โปรดยืนยัน Force Edit",
            )
        else:
            # User chose to force override supplier window
            item.locked_by = "user"
            item.lock_expires_at = None

    # 2. QUANTITY VALIDATION (Bypassed if Supplier is allowed to over-deliver)
    header = (await db.execute(select(POHeader).where(POHeader.id == item.po_header_id))).scalar_one()
    sup_obj = (await db.execute(select(SupplierMaster).where(SupplierMaster.supplier_code == header.supplier_code))).scalar_one_or_none()
    allow_over = sup_obj.allow_over_delivery if sup_obj else False

    if not allow_over:
        if data.sub_items:
            total_sub_qty = sum(sub.quantity for sub in data.sub_items if sub.quantity > 0)
            if total_sub_qty > item.remaining_qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"จำนวนส่งรวมทุกรอบ ({total_sub_qty:,.0f} {item.unit}) เกินกว่าจำนวนสินค้าที่ยังค้างรับ ({item.remaining_qty:,.0f} {item.unit})",
                )
        elif data.estimate_qty is not None:
            if data.estimate_qty > item.remaining_qty:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"จำนวนส่ง ({data.estimate_qty:,.0f} {item.unit}) เกินกว่าจำนวนสินค้าที่ยังค้างรับ ({item.remaining_qty:,.0f} {item.unit})",
                )

    old_date_str = item.estimate_date.strftime("%d/%m/%Y") if item.estimate_date else "None"
    old_qty_str = str(item.estimate_qty) if item.estimate_qty else "None"

    # Update main item date/qty
    if data.sub_items:
        total_sub_qty = sum(sub.quantity for sub in data.sub_items if sub.quantity > 0)
        item.estimate_qty = total_sub_qty
        if data.sub_items[0].estimate_date:
            item.estimate_date = data.sub_items[0].estimate_date
    else:
        if data.estimate_date is not None:
            item.estimate_date = data.estimate_date
        if data.estimate_qty is not None:
            item.estimate_qty = data.estimate_qty

    item.status = "confirmed"
    item.is_new = False
    item.locked_by = None
    item.lock_expires_at = None
    item.updated_by_name = current_user.full_name
    item.updated_by_type = "user"

    # Handle Sub-items
    if data.sub_items is not None:
        item.sub_items.clear()
        for sub in data.sub_items:
            if sub.quantity > 0 and sub.estimate_date:
                new_sub = SubItem(
                    po_item_id=item.id,
                    estimate_date=sub.estimate_date,
                    quantity=sub.quantity,
                    updated_by_name=current_user.full_name,
                    updated_by_type="user",
                )
                item.sub_items.append(new_sub)

    new_date_str = item.estimate_date.strftime("%d/%m/%Y") if item.estimate_date else "None"
    new_qty_str = str(item.estimate_qty) if item.estimate_qty else "None"

    # Create Audit Log
    log_detail = f"Updated by {current_user.full_name}: Date ({old_date_str} -> {new_date_str}), Qty ({old_qty_str} -> {new_qty_str})"
    if data.sub_items:
        log_detail += f", Split into {len(data.sub_items)} Sub-Items"
    if data.force_override:
        log_detail += f" [FORCE OVERRIDE: {data.override_reason or 'No reason specified'}]"

    audit_log = POItemAuditLog(
        po_item_id=item.id,
        action="force_override_user" if data.force_override else "update_user",
        changes_detail=log_detail,
        changed_by_name=current_user.full_name,
        changed_by_type="user",
    )
    db.add(audit_log)

    await db.commit()
    
    stmt_reload = (
        select(POItem)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
        .where(POItem.id == item.id)
    )
    item = (await db.execute(stmt_reload)).scalar_one()

    header = (await db.execute(select(POHeader).where(POHeader.id == item.po_header_id))).scalar_one()
    sup_obj = (await db.execute(select(SupplierMaster).where(SupplierMaster.supplier_code == header.supplier_code))).scalar_one_or_none()
    allow_over = sup_obj.allow_over_delivery if sup_obj else False

    return POItemResponse(
        id=item.id,
        po_header_id=header.id,
        line_num=item.line_num or 0,
        po_number=header.po_number,
        po_date=header.po_date,
        supplier_code=header.supplier_code,
        supplier_name=header.supplier_name,
        buyer_name=header.buyer_name,
        item_code=item.item_code,
        item_name=item.item_name,
        quantity=item.quantity,
        unit=item.unit,
        received_qty=item.received_qty,
        remaining_qty=item.remaining_qty,
        due_date=item.due_date,
        item_group=item.item_group or "RM-กระจก",
        estimate_date=item.estimate_date,
        estimate_qty=item.estimate_qty,
        allow_over_delivery=allow_over,
        status=item.status,
        is_new=item.is_new,
        closed_at=item.closed_at,
        locked_by=item.locked_by,
        lock_expires_at=item.lock_expires_at,
        updated_by_name=item.updated_by_name,
        updated_by_type=item.updated_by_type,
        updated_at=item.updated_at,
        sub_items=item.sub_items,
        audit_logs=item.audit_logs,
    )


@router.put("/sub-items/{sub_item_id}", response_model=POItemResponse)
async def update_single_sub_item(
    sub_item_id: int,
    data: SubItemUpdateInput,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Update a single SubItem's Estimate Date and Qty.
    Enforces remaining_qty checks against the sum of all sub-items under the parent PO Item.
    """
    stmt = select(SubItem).where(SubItem.id == sub_item_id)
    sub_item = (await db.execute(stmt)).scalar_one_or_none()
    if not sub_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sub Item not found")

    item = (await db.execute(select(POItem).where(POItem.id == sub_item.po_item_id))).scalar_one()

    # Calculate other subitems sum
    stmt_others = select(SubItem).where(SubItem.po_item_id == item.id).where(SubItem.id != sub_item_id)
    others = (await db.execute(stmt_others)).scalars().all()
    other_qty = sum(o.quantity for o in others)

    header = (await db.execute(select(POHeader).where(POHeader.id == item.po_header_id))).scalar_one()
    sup_obj = (await db.execute(select(SupplierMaster).where(SupplierMaster.supplier_code == header.supplier_code))).scalar_one_or_none()
    allow_over = sup_obj.allow_over_delivery if sup_obj else False

    if not allow_over and (other_qty + data.quantity > item.remaining_qty):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"จำนวนส่งรวมทุกรอบ ({other_qty + data.quantity:,.0f} {item.unit}) เกินกว่าจำนวนสินค้าที่ยังค้างรับ ({item.remaining_qty:,.0f} {item.unit})",
        )

    old_date = sub_item.estimate_date.strftime("%d/%m/%Y")
    old_qty = sub_item.quantity

    sub_item.estimate_date = data.estimate_date
    sub_item.quantity = data.quantity
    sub_item.updated_by_name = current_user.full_name
    sub_item.updated_by_type = "user"

    # Update parent estimate values
    item.estimate_qty = other_qty + data.quantity
    item.estimate_date = data.estimate_date  # Keep main date as the latest edited round
    item.status = "confirmed"

    audit_log = POItemAuditLog(
        po_item_id=item.id,
        action="update_subitem",
        changes_detail=f"Updated Sub-Item Round (Date: {old_date} -> {data.estimate_date.strftime('%d/%m/%Y')}, Qty: {old_qty:,.0f} -> {data.quantity:,.0f}) by {current_user.full_name}",
        changed_by_name=current_user.full_name,
        changed_by_type="user",
    )
    db.add(audit_log)

    await db.commit()
    
    stmt_reload = (
        select(POItem)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
        .where(POItem.id == item.id)
    )
    item = (await db.execute(stmt_reload)).scalar_one()

    header = (await db.execute(select(POHeader).where(POHeader.id == item.po_header_id))).scalar_one()
    sup_obj = (await db.execute(select(SupplierMaster).where(SupplierMaster.supplier_code == header.supplier_code))).scalar_one_or_none()
    allow_over = sup_obj.allow_over_delivery if sup_obj else False

    return POItemResponse(
        id=item.id,
        po_header_id=header.id,
        line_num=item.line_num or 0,
        po_number=header.po_number,
        po_date=header.po_date,
        supplier_code=header.supplier_code,
        supplier_name=header.supplier_name,
        buyer_name=header.buyer_name,
        item_code=item.item_code,
        item_name=item.item_name,
        quantity=item.quantity,
        unit=item.unit,
        received_qty=item.received_qty,
        remaining_qty=item.remaining_qty,
        due_date=item.due_date,
        item_group=item.item_group or "RM-กระจก",
        estimate_date=item.estimate_date,
        estimate_qty=item.estimate_qty,
        allow_over_delivery=allow_over,
        status=item.status,
        is_new=item.is_new,
        closed_at=item.closed_at,
        locked_by=item.locked_by,
        lock_expires_at=item.lock_expires_at,
        updated_by_name=item.updated_by_name,
        updated_by_type=item.updated_by_type,
        updated_at=item.updated_at,
        sub_items=item.sub_items,
        audit_logs=item.audit_logs,
    )


@router.delete("/sub-items/{sub_item_id}", response_model=POItemResponse)
async def delete_single_sub_item(
    sub_item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Delete a single SubItem round. Updates parent estimate totals."""
    stmt = select(SubItem).where(SubItem.id == sub_item_id)
    sub_item = (await db.execute(stmt)).scalar_one_or_none()
    if not sub_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sub Item not found")

    item = (await db.execute(select(POItem).where(POItem.id == sub_item.po_item_id))).scalar_one()

    await db.delete(sub_item)
    await db.flush()

    # Recalculate parent
    stmt_rem = select(SubItem).where(SubItem.po_item_id == item.id)
    rem_subs = (await db.execute(stmt_rem)).scalars().all()
    if rem_subs:
        item.estimate_qty = sum(r.quantity for r in rem_subs)
        item.estimate_date = rem_subs[0].estimate_date
    else:
        item.estimate_qty = None
        item.estimate_date = None
        item.status = "pending"

    audit_log = POItemAuditLog(
        po_item_id=item.id,
        action="delete_subitem",
        changes_detail=f"Deleted Sub-Item round by {current_user.full_name}",
        changed_by_name=current_user.full_name,
        changed_by_type="user",
    )
    db.add(audit_log)

    await db.commit()
    
    stmt_reload = (
        select(POItem)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
        .where(POItem.id == item.id)
    )
    item = (await db.execute(stmt_reload)).scalar_one()

    header = (await db.execute(select(POHeader).where(POHeader.id == item.po_header_id))).scalar_one()
    sup_obj = (await db.execute(select(SupplierMaster).where(SupplierMaster.supplier_code == header.supplier_code))).scalar_one_or_none()
    allow_over = sup_obj.allow_over_delivery if sup_obj else False

    return POItemResponse(
        id=item.id,
        po_header_id=header.id,
        line_num=item.line_num or 0,
        po_number=header.po_number,
        po_date=header.po_date,
        supplier_code=header.supplier_code,
        supplier_name=header.supplier_name,
        buyer_name=header.buyer_name,
        item_code=item.item_code,
        item_name=item.item_name,
        quantity=item.quantity,
        unit=item.unit,
        received_qty=item.received_qty,
        remaining_qty=item.remaining_qty,
        due_date=item.due_date,
        item_group=item.item_group or "RM-กระจก",
        estimate_date=item.estimate_date,
        estimate_qty=item.estimate_qty,
        allow_over_delivery=allow_over,
        status=item.status,
        is_new=item.is_new,
        closed_at=item.closed_at,
        locked_by=item.locked_by,
        lock_expires_at=item.lock_expires_at,
        updated_by_name=item.updated_by_name,
        updated_by_type=item.updated_by_type,
        updated_at=item.updated_at,
        sub_items=item.sub_items,
        audit_logs=item.audit_logs,
    )


@router.post("/{item_id}/accept-supplier", response_model=POItemResponse)
async def accept_supplier_response(
    item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Accept supplier provided Date/Qty.
    Records that user (Patcha/Pinyada) accepted supplier data.
    """
    stmt = (
        select(POItem)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
        .where(POItem.id == item_id)
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PO Item not found")

    item.status = "confirmed"
    item.is_new = False
    item.locked_by = None
    item.lock_expires_at = None
    # Preserve supplier update attribution (do not overwrite with current user/admin)

    audit_log = POItemAuditLog(
        po_item_id=item.id,
        action="accept_supplier",
        changes_detail=f"Accepted Supplier response by {current_user.full_name}",
        changed_by_name=current_user.full_name,
        changed_by_type="user",
    )
    db.add(audit_log)

    await db.commit()
    
    stmt_reload = (
        select(POItem)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
        .where(POItem.id == item.id)
    )
    item = (await db.execute(stmt_reload)).scalar_one()

    header = (await db.execute(select(POHeader).where(POHeader.id == item.po_header_id))).scalar_one()

    return POItemResponse(
        id=item.id,
        po_header_id=header.id,
        line_num=item.line_num or 0,
        po_number=header.po_number,
        po_date=header.po_date,
        supplier_code=header.supplier_code,
        supplier_name=header.supplier_name,
        buyer_name=header.buyer_name,
        item_code=item.item_code,
        item_name=item.item_name,
        quantity=item.quantity,
        unit=item.unit,
        received_qty=item.received_qty,
        remaining_qty=item.remaining_qty,
        due_date=item.due_date,
        item_group=item.item_group or "RM-กระจก",
        estimate_date=item.estimate_date,
        estimate_qty=item.estimate_qty,
        status=item.status,
        is_new=item.is_new,
        closed_at=item.closed_at,
        locked_by=item.locked_by,
        lock_expires_at=item.lock_expires_at,
        updated_by_name=item.updated_by_name,
        updated_by_type=item.updated_by_type,
        updated_at=item.updated_at,
        sub_items=item.sub_items,
        audit_logs=item.audit_logs,
    )


@router.post("/{item_id}/confirm", response_model=POItemResponse)
async def confirm_po_item(
    item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Directly confirm a PO item (e.g. from SAP or default Lead Time date).
    Sets status = 'confirmed', updated_by_name = current_user.full_name, and creates audit log.
    """
    stmt = (
        select(POItem)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
        .where(POItem.id == item_id)
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PO Item not found")

    item.status = "confirmed"
    item.is_new = False
    item.locked_by = None
    item.lock_expires_at = None
    item.updated_by_name = current_user.full_name
    item.updated_by_type = "user"

    audit_log = POItemAuditLog(
        po_item_id=item.id,
        action="confirm_item",
        changes_detail=f"ยืนยันวันส่งมอบโดย {current_user.full_name}",
        changed_by_name=current_user.full_name,
        changed_by_type="user",
    )
    db.add(audit_log)

    await db.commit()

    stmt_reload = (
        select(POItem)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
        .where(POItem.id == item.id)
    )
    item = (await db.execute(stmt_reload)).scalar_one()
    header = (await db.execute(select(POHeader).where(POHeader.id == item.po_header_id))).scalar_one()

    return POItemResponse(
        id=item.id,
        po_header_id=header.id,
        line_num=item.line_num or 0,
        po_number=header.po_number,
        po_date=header.po_date,
        supplier_code=header.supplier_code,
        supplier_name=header.supplier_name,
        buyer_name=header.buyer_name,
        item_code=item.item_code,
        item_name=item.item_name,
        quantity=item.quantity,
        unit=item.unit,
        received_qty=item.received_qty,
        remaining_qty=item.remaining_qty,
        due_date=item.due_date,
        item_group=item.item_group or "RM-กระจก",
        estimate_date=item.estimate_date,
        estimate_qty=item.estimate_qty,
        status=item.status,
        is_new=item.is_new,
        closed_at=item.closed_at,
        locked_by=item.locked_by,
        lock_expires_at=item.lock_expires_at,
        updated_by_name=item.updated_by_name,
        updated_by_type=item.updated_by_type,
        updated_at=item.updated_at,
        sub_items=item.sub_items,
        audit_logs=item.audit_logs,
    )


@router.post("/items/{item_id}/unlock", response_model=POItemResponse)
async def unlock_single_item(
    item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Manually unlock a single item currently locked under Supplier Portal.
    Allows Buyer to override and edit delivery schedules immediately.
    """
    stmt = (
        select(POItem)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
        .where(POItem.id == item_id)
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PO Item not found")

    old_locked_by = item.locked_by
    item.locked_by = None
    item.lock_expires_at = None
    if item.status == "awaiting_supplier":
        item.status = "estimate" if item.estimate_date else "pending"

    audit_log = POItemAuditLog(
        po_item_id=item.id,
        action="manual_unlock",
        changes_detail=f"ปลดล็อคสถานะ Supplier โดย {current_user.full_name} (Manual Override)",
        changed_by_name=current_user.full_name,
        changed_by_type="user",
    )
    db.add(audit_log)
    await db.commit()

    # Record in Transaction Log
    try:
        from app.services.log_service import record_transaction_log
        await record_transaction_log(
            category="supplier_portal",
            action="manual_unlock",
            status="success",
            message=f"ผู้ใช้ {current_user.full_name} ปลดล็อครายการ {item.item_code} จาก Supplier เพื่อแก้ไขเอง",
            details={"item_id": item.id, "item_code": item.item_code, "previous_locked_by": old_locked_by},
            triggered_by=f"user:{current_user.username}",
        )
    except Exception:
        pass

    stmt_reload = (
        select(POItem)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
        .where(POItem.id == item.id)
    )
    item = (await db.execute(stmt_reload)).scalar_one()
    header = (await db.execute(select(POHeader).where(POHeader.id == item.po_header_id))).scalar_one()

    return POItemResponse(
        id=item.id,
        po_header_id=header.id,
        line_num=item.line_num or 0,
        po_number=header.po_number,
        po_date=header.po_date,
        supplier_code=header.supplier_code,
        supplier_name=header.supplier_name,
        buyer_name=header.buyer_name,
        item_code=item.item_code,
        item_name=item.item_name,
        quantity=item.quantity,
        unit=item.unit,
        received_qty=item.received_qty,
        remaining_qty=item.remaining_qty,
        due_date=item.due_date,
        item_group=item.item_group or "RM-กระจก",
        estimate_date=item.estimate_date,
        estimate_qty=item.estimate_qty,
        status=item.status,
        is_new=item.is_new,
        closed_at=item.closed_at,
        locked_by=item.locked_by,
        lock_expires_at=item.lock_expires_at,
        updated_by_name=item.updated_by_name,
        updated_by_type=item.updated_by_type,
        updated_at=item.updated_at,
        sub_items=item.sub_items,
        audit_logs=item.audit_logs,
    )


@router.get("/items/{item_id}/portal-link")
async def get_item_portal_link(
    item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Generate an Instant Encrypted Single-PO Token with a strict 1-Hour Expiration Window.
    Provides instant secure access strictly for this single PO without exposing parameters.
    """
    import secrets
    from datetime import datetime, timezone, timedelta
    from app.models.supplier_token import SupplierPortalToken

    stmt = select(POItem).where(POItem.id == item_id)
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PO Item not found")

    header = (await db.execute(select(POHeader).where(POHeader.id == item.po_header_id))).scalar_one()
    
    # 1. Invalidate / Revoke previous tokens for this PO
    now_dt = datetime.now(timezone(timedelta(hours=7)))
    expires_at = now_dt + timedelta(hours=1)
    
    stmt_revoke = (
        select(SupplierPortalToken)
        .where(SupplierPortalToken.supplier_code == header.supplier_code)
        .where(SupplierPortalToken.po_number == header.po_number)
        .where(SupplierPortalToken.is_submitted == False)
    )
    old_tokens = (await db.execute(stmt_revoke)).scalars().all()
    for old_tok in old_tokens:
        old_tok.expires_at = now_dt - timedelta(seconds=1)
        old_tok.is_submitted = True
        db.add(old_tok)

    token_str = f"tok_po_{secrets.token_hex(16)}"
    token_obj = SupplierPortalToken(
        token=token_str,
        supplier_code=header.supplier_code,
        po_number=header.po_number,
        is_submitted=False,
        expires_at=expires_at,
    )
    stmt_base = select(SystemSetting).where(SystemSetting.key == "app_base_url")
    base_setting = (await db.execute(stmt_base)).scalar_one_or_none()
    base_url = (base_setting.value if base_setting and base_setting.value else (getattr(settings, "FRONTEND_URL", None) or getattr(settings, "APP_BASE_URL", None) or "https://irm.windowasia.com")).strip().rstrip("/")
    if "irm.windowasia.com" in base_url and base_url.startswith("http://"):
        base_url = base_url.replace("http://", "https://")
    elif not base_url.startswith("http"):
        base_url = f"https://{base_url}"

    db.add(token_obj)
    await db.commit()

    portal_url = f"{base_url}/supplier/portal/{token_obj.token}"

    return {
        "supplier_code": header.supplier_code,
        "supplier_name": header.supplier_name,
        "po_number": header.po_number,
        "token": token_obj.token,
        "portal_url": portal_url,
        "expires_at": token_obj.expires_at.isoformat(),
    }



@router.get("/items/{item_id}/audit-logs")
async def get_item_audit_logs(
    item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Lazy load complete audit trail history for a single item when modal is opened.
    """
    stmt = (
        select(POItemAuditLog)
        .where(POItemAuditLog.po_item_id == item_id)
        .order_by(POItemAuditLog.changed_at.desc(), POItemAuditLog.id.desc())
    )
    logs = (await db.execute(stmt)).scalars().all()
    return logs


@router.post("/items/{item_id}/lock", response_model=POItemResponse)
async def lock_single_item_for_supplier(
    item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Relock an item to Supplier Portal mode (awaiting_supplier).
    Allows purchasing to return management ownership back to Supplier.
    """
    stmt = (
        select(POItem)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
        .where(POItem.id == item_id)
    )
    item = (await db.execute(stmt)).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PO Item not found")

    header = (await db.execute(select(POHeader).where(POHeader.id == item.po_header_id))).scalar_one()

    # Get supplier token expiry or set tomorrow midnight
    from app.models.supplier_token import SupplierPortalToken
    stmt_token = (
        select(SupplierPortalToken)
        .where(SupplierPortalToken.supplier_code == header.supplier_code)
        .order_by(SupplierPortalToken.id.desc())
    )
    token_obj = (await db.execute(stmt_token)).scalars().first()

    now_dt = datetime.now(timezone(timedelta(hours=7)))
    lock_expiry = token_obj.expires_at if token_obj else (now_dt + timedelta(days=1))

    item.locked_by = "supplier"
    item.lock_expires_at = lock_expiry
    item.status = "awaiting_supplier"

    audit_log = POItemAuditLog(
        po_item_id=item.id,
        action="manual_lock",
        changes_detail=f"ล็อครายการให้ Supplier กรอกข้อมูล (โดย {current_user.full_name})",
        changed_by_name=current_user.full_name,
        changed_by_type="user",
    )
    db.add(audit_log)
    await db.commit()

    stmt_reload = (
        select(POItem)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
        .where(POItem.id == item.id)
    )
    item = (await db.execute(stmt_reload)).scalar_one()

    return POItemResponse(
        id=item.id,
        po_header_id=header.id,
        line_num=item.line_num or 0,
        po_number=header.po_number,
        po_date=header.po_date,
        supplier_code=header.supplier_code,
        supplier_name=header.supplier_name,
        buyer_name=header.buyer_name,
        item_code=item.item_code,
        item_name=item.item_name,
        quantity=item.quantity,
        unit=item.unit,
        received_qty=item.received_qty,
        remaining_qty=item.remaining_qty,
        due_date=item.due_date,
        item_group=item.item_group or "RM-กระจก",
        estimate_date=item.estimate_date,
        estimate_qty=item.estimate_qty,
        status=item.status,
        is_new=item.is_new,
        closed_at=item.closed_at,
        locked_by=item.locked_by,
        lock_expires_at=item.lock_expires_at,
        updated_by_name=item.updated_by_name,
        updated_by_type=item.updated_by_type,
        updated_at=item.updated_at,
        sub_items=item.sub_items,
        audit_logs=item.audit_logs,
    )