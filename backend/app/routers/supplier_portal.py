"""
Supplier Portal Router — Cryptographic Token Validation, One-time Submission Lock, Quantity Validation, and PRD Expiration Window Enforcement.
"""

from datetime import datetime, timezone
from typing import Annotated
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.database import get_db
from app.models.master import SupplierMaster
from app.models.po import POHeader, POItem, POItemAuditLog
from app.models.supplier_token import SupplierPortalToken
from app.models.system_setting import SystemSetting

router = APIRouter(prefix="/api/supplier-portal", tags=["Supplier Portal"])


class SupplierSubmitSubItem(BaseModel):
    estimate_date: datetime
    quantity: float


class SupplierSubmitItem(BaseModel):
    item_id: int
    estimate_date: datetime | None = None
    estimate_qty: float | None = None
    sub_items: list[SupplierSubmitSubItem] = []


class SupplierSubmitRequest(BaseModel):
    items: list[SupplierSubmitItem]
    is_draft: bool = False



@router.get("/token/{token}")
async def get_supplier_po_items(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Validate Cryptographic Token and fetch open PO items.
    Enforces Expiration Window (Wed 24:00 / Sun 24:00) and Submission Lock state.
    """
    now_dt = datetime.now(timezone.utc)

    # 1. Lookup Cryptographic Token with space/format tolerance
    clean_token = token.strip().replace(" ", "_")
    stmt_token = select(SupplierPortalToken).where(
        (SupplierPortalToken.token == token) | (SupplierPortalToken.token == clean_token)
    )
    token_obj = (await db.execute(stmt_token)).scalar_one_or_none()

    if not token_obj:
        # Fallback query by supplier_code for backwards compatibility or dev test
        stmt_fallback = (
            select(POItem, POHeader)
            .join(POHeader, POItem.po_header_id == POHeader.id)
            .where(POHeader.status == "O")
            .where(POHeader.supplier_code == token)
        )
        rows_fallback = (await db.execute(stmt_fallback)).all()
        if not rows_fallback:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ลิงก์ไม่ถูกต้อง หรือถูกยกเลิกแล้ว")

        supplier_code = token
        supplier_name = rows_fallback[0][1].supplier_name
        is_submitted = False
        expires_at_formatted = "ยังไม่ระบุวันหมดอายุ"
    else:
        supplier_code = token_obj.supplier_code
        is_submitted = token_obj.is_submitted
        is_single_po = token_obj.po_number is not None
        expires_at_formatted = token_obj.expires_at.strftime("%d/%m/%Y เวลา %H:%M น.")

        # Check Expiration Window (1-hour for single PO tokens, or midnight for daily broadcast tokens)
        if token_obj.expires_at < now_dt:
            expiry_msg = f"ลิงก์ด่วนเฉพาะ PO นี้หมดอายุแล้ว (อายุ 1 ชั่วโมง - หมดอายุเมื่อ {expires_at_formatted})" if is_single_po else f"ลิงก์นี้หมดอายุการกรอกข้อมูลแล้ว (หมดอายุเมื่อ {expires_at_formatted})"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=expiry_msg,
            )

        stmt_pos = (
            select(POItem, POHeader)
            .join(POHeader, POItem.po_header_id == POHeader.id)
            .where(POHeader.status == "O")
            .where(POHeader.supplier_code == supplier_code)
        )
        # If token is bound to a single PO, strictly enforce that PO only
        if token_obj.po_number:
            stmt_pos = stmt_pos.where(POHeader.po_number == token_obj.po_number)

        stmt_pos = stmt_pos.order_by(POHeader.po_number.desc())
        rows_fallback = (await db.execute(stmt_pos)).all()
        supplier_name = rows_fallback[0][1].supplier_name if rows_fallback else supplier_code

    # Check allow_over_delivery for this supplier
    stmt_sup = select(SupplierMaster).where(SupplierMaster.supplier_code == supplier_code)
    sup_master = (await db.execute(stmt_sup)).scalar_one_or_none()
    allow_over_delivery = bool(sup_master.allow_over_delivery) if sup_master else False

    po_items = []
    for item, header in rows_fallback:
        po_items.append({
            "id": item.id,
            "po_number": header.po_number,
            "po_date": header.po_date,
            "item_code": item.item_code,
            "item_name": item.item_name,
            "quantity": item.quantity,
            "unit": item.unit,
            "received_qty": item.received_qty or 0,
            "remaining_qty": item.remaining_qty if item.remaining_qty is not None else item.quantity,
            "estimate_date": item.estimate_date,
            "estimate_qty": item.estimate_qty if item.estimate_qty is not None else (item.remaining_qty or item.quantity),
            "status": item.status,
            "updated_by_name": item.updated_by_name,
            "updated_at": item.updated_at,
            "sub_items": [{
                "id": sub.id,
                "estimate_date": sub.estimate_date,
                "quantity": sub.quantity,
                "updated_by_name": sub.updated_by_name,
                "updated_by_type": sub.updated_by_type,
                "updated_at": sub.updated_at,
            } for sub in item.sub_items]
        })


    return {
        "supplier_code": supplier_code,
        "supplier_name": supplier_name,
        "allow_over_delivery": allow_over_delivery,
        "is_single_po": token_obj.po_number is not None if token_obj else False,
        "po_number": token_obj.po_number if token_obj else None,
        "is_submitted": is_submitted,
        "expires_at_formatted": expires_at_formatted,
        "items": po_items,
    }


@router.post("/token/{token}/submit")
async def submit_supplier_response(
    token: str,
    data: SupplierSubmitRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Supplier Submits Estimate Date & Qty.
    Enforces One-Time Lock and Strict Quantity Validation.
    """
    now_dt = datetime.now(timezone.utc)

    # 1. Validate Cryptographic Token
    stmt_token = select(SupplierPortalToken).where(SupplierPortalToken.token == token)
    token_obj = (await db.execute(stmt_token)).scalar_one_or_none()

    if token_obj:
        if token_obj.expires_at < now_dt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ลิงก์นี้หมดอายุการกรอกข้อมูลแล้ว ไม่สามารถบันทึกได้",
            )
        if token_obj.is_submitted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ลิงก์นี้ถูกบันทึกข้อมูลไปแล้ว ไม่สามารถแก้ไขซ้ำได้อีก",
            )

    if not data.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No items submitted")

    # Strict Quantity Validation Step (Bypassed if supplier is allowed to over-deliver)
    supplier_code = token_obj.supplier_code if token_obj else token
    stmt_sup = select(SupplierMaster).where(SupplierMaster.supplier_code == supplier_code)
    sup_master = (await db.execute(stmt_sup)).scalar_one_or_none()
    allow_over = bool(sup_master.allow_over_delivery) if sup_master else False

    if not allow_over:
        for item_data in data.items:
            stmt_chk = select(POItem).where(POItem.id == item_data.item_id)
            po_item_obj = (await db.execute(stmt_chk)).scalar_one_or_none()
            if po_item_obj:
                if item_data.sub_items:
                    total_qty = sum(sub.quantity for sub in item_data.sub_items if sub.quantity > 0)
                else:
                    total_qty = item_data.estimate_qty or 0

                if total_qty > po_item_obj.remaining_qty:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"จำนวนส่งรวม ({total_qty:,.0f} {po_item_obj.unit}) ของสินค้า {po_item_obj.item_code} เกินกว่าจำนวนที่ยังค้างรับ ({po_item_obj.remaining_qty:,.0f} {po_item_obj.unit})",
                    )

    updated_count = 0
    supplier_name = ""

    from app.models.po import SubItem

    for item_data in data.items:
        stmt = (
            select(POItem, POHeader)
            .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
            .join(POHeader, POItem.po_header_id == POHeader.id)
            .where(POItem.id == item_data.item_id)
        )
        res = await db.execute(stmt)
        row = res.first()
        if not row:
            continue

        item, header = row
        supplier_name = header.supplier_name

        # If already submitted, skip locking again
        if item.status == "supplier_responded" and token_obj and token_obj.is_submitted:
            continue

        if item_data.sub_items:
            # Recreate sub-items from supplier input
            item.sub_items.clear()
            total_sub_qty = 0
            first_date = None
            for sub in item_data.sub_items:
                if sub.quantity > 0:
                    new_sub = SubItem(
                        po_item_id=item.id,
                        estimate_date=sub.estimate_date,
                        quantity=sub.quantity,
                        updated_by_name=f"{supplier_name} (Supplier)",
                        updated_by_type="supplier",
                    )
                    item.sub_items.append(new_sub)
                    total_sub_qty += sub.quantity
                    if first_date is None:
                        first_date = sub.estimate_date

            item.estimate_qty = total_sub_qty
            if first_date:
                item.estimate_date = first_date

            changes_txt = f"Supplier submitted (Split into {len(item.sub_items)} rounds): Total Qty ({total_sub_qty})"
        else:
            item.estimate_date = item_data.estimate_date
            item.estimate_qty = item_data.estimate_qty
            date_str = item_data.estimate_date.strftime('%d/%m/%Y') if item_data.estimate_date else 'N/A'
            changes_txt = f"Supplier submitted: Date ({date_str}), Qty ({item_data.estimate_qty})"

        item.status = "supplier_responded"
        item.updated_by_name = f"{supplier_name} (Supplier)"
        item.updated_by_type = "supplier"

        if not data.is_draft:
            item.locked_by = "user"
            item.lock_expires_at = None

        audit_log = POItemAuditLog(
            po_item_id=item.id,
            action="supplier_draft" if data.is_draft else "supplier_response",
            changes_detail=f"[{'DRAFT' if data.is_draft else 'FINAL'}] " + changes_txt,
            changed_by_name=supplier_name,
            changed_by_type="supplier",
        )
        db.add(audit_log)
        updated_count += 1


    # Record Transaction Log
    try:
        from app.services.log_service import record_transaction_log
        await record_transaction_log(
            category="supplier_portal",
            action="save_draft" if data.is_draft else "submit_response",
            status="success",
            message=f"Supplier {supplier_name} {'บันทึกร่างข้อมูล (Draft)' if data.is_draft else 'ส่งข้อมูลวันส่งมอบ (Final)'} จำนวน {updated_count} รายการ",
            details={
                "supplier_name": supplier_name,
                "token": token,
                "is_draft": data.is_draft,
                "updated_count": updated_count,
            },
            records_count=updated_count,
            triggered_by=f"supplier:{supplier_name}",
            db=db,
        )
        await db.commit()
    except Exception:
        pass

    if data.is_draft:
        return {"status": "success", "message": f"บันทึกร่างข้อมูลเรียบร้อยแล้ว ({updated_count} รายการ)", "is_draft": True}

    # Trigger Telegram Group Notification using standard centralized header
    try:
        from app.services.telegram_service import send_telegram_supplier_response
        supplier_code_val = token_obj.supplier_code if token_obj else token
        po_num_val = token_obj.po_number if token_obj else None
        await send_telegram_supplier_response(
            db=db,
            supplier_code=supplier_code_val,
            supplier_name=supplier_name,
            po_number=po_num_val,
            item_count=updated_count,
        )
    except Exception as e:
        print(f"Telegram notification error: {e}")

    return {"message": f"บันทึกข้อมูลตอบกลับจาก Supplier สำเร็จเรียบร้อยแล้ว ({updated_count} รายการ)"}
