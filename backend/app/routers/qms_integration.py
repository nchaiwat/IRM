"""
QMS Integration Router — Secure API Channel for QMS System to pull Confirmed Inbound Deliveries.
Protected by API Key Authentication (X-API-Key or Bearer token), with full Transaction Audit Logging.
"""

from datetime import datetime, timezone, date
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.po import POHeader, POItem, SubItem
from app.models.system_setting import SystemSetting
from app.services.log_service import record_transaction_log

router = APIRouter(prefix="/api/external/qms", tags=["QMS Integration API"])

DEFAULT_QMS_API_KEY = "irm_qms_secure_key_2026"


async def verify_qms_api_key(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_api_key: Annotated[Optional[str], Header(alias="X-API-Key")] = None,
    authorization: Annotated[Optional[str], Header(alias="Authorization")] = None,
) -> str:
    """Validate QMS Secret API Key from X-API-Key or Bearer Token Header."""
    client_ip = request.client.host if request.client else "unknown"

    # 1. Fetch configured API key from System Settings
    stmt = select(SystemSetting).where(SystemSetting.key == "qms_api_key")
    setting = (await db.execute(stmt)).scalar_one_or_none()

    if not setting:
        # Auto initialize default key if not present
        setting = SystemSetting(
            category="integration",
            key="qms_api_key",
            value=DEFAULT_QMS_API_KEY,
            description="API Key สำหรับระบบ QMS ใช้เชื่อมต่อดึงข้อมูล Confirmed Inbound Deliveries",
        )
        db.add(setting)
        await db.commit()
        await db.refresh(setting)

    valid_key = setting.value.strip()

    # Extract provided key
    provided_key = None
    if x_api_key:
        provided_key = x_api_key.strip()
    elif authorization and authorization.startswith("Bearer "):
        provided_key = authorization[7:].strip()

    if not provided_key or provided_key != valid_key:
        await record_transaction_log(
            category="qms_integration",
            action="qms_auth_failed",
            status="FAILED",
            message=f"QMS API Authentication ล้มเหลวจาก IP: {client_ip}",
            details=f"Header provided: {'Yes' if provided_key else 'None'}, Client IP: {client_ip}",
            db=db,
        )
        try:
            from app.services.telegram_service import send_telegram_qms_pull
            await send_telegram_qms_pull(db, item_count=0, client_ip=client_ip, success=False, error_msg="Invalid or missing API Key")
        except Exception:
            pass

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing X-API-Key header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return valid_key


@router.get("/inbound-deliveries")
async def get_confirmed_inbound_deliveries_for_qms(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    api_key: Annotated[str, Depends(verify_qms_api_key)],
    date_from: Annotated[Optional[str], Query(description="Start delivery date filter (YYYY-MM-DD)")] = None,
    date_to: Annotated[Optional[str], Query(description="End delivery date filter (YYYY-MM-DD)")] = None,
    po_number: Annotated[Optional[str], Query(description="Filter by specific PO Number")] = None,
    item_code: Annotated[Optional[str], Query(description="Filter by specific Item Code")] = None,
):
    """
    API Channel สำหรับระบบ QMS:
    ดึงข้อมูลกำหนดการส่งมอบวัตถุดิบที่ได้รับการยืนยันแล้ว (Confirmed Only)
    
    Headers required:
      - X-API-Key: <SECRET_KEY> (หรือ Authorization: Bearer <SECRET_KEY>)

    Filters supported:
      - date_from: วันที่เริ่มส่งมอบ (YYYY-MM-DD)
      - date_to: วันที่สิ้นสุดส่งมอบ (YYYY-MM-DD)
      - po_number: เลขที่ PO
      - item_code: รหัสสินค้า
    """
    client_ip = request.client.host if request.client else "unknown"

    # Query only Open POs and Confirmed Items
    stmt = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .options(selectinload(POItem.sub_items))
        .where(POHeader.status == "O")
        .where(POItem.status == "confirmed")
    )

    if po_number:
        stmt = stmt.where(POHeader.po_number == po_number.strip())
    if item_code:
        stmt = stmt.where(POItem.item_code == item_code.strip())

    stmt = stmt.order_by(POHeader.po_number.desc(), POItem.id.asc())
    rows = (await db.execute(stmt)).all()

    # Parse date filters if provided
    d_from: Optional[date] = None
    d_to: Optional[date] = None
    try:
        if date_from:
            d_from = datetime.strptime(date_from.strip(), "%Y-%m-%d").date()
        if date_to:
            d_to = datetime.strptime(date_to.strip(), "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date format for date_from or date_to. Use YYYY-MM-DD format (e.g. 2026-08-26)",
        )

    deliveries = []
    for item, header in rows:
        buyer = header.buyer_name or "-"
        sup_code = header.supplier_code or "-"
        sup_name = header.supplier_name or "-"
        po_num = header.po_number
        po_dt = header.po_date.strftime("%Y-%m-%d") if header.po_date else None
        item_c = item.item_code
        item_desc = item.item_name or ""
        unit = item.unit or ""
        group = item.item_group or "-"
        confirmed_at_str = item.updated_at.isoformat() if item.updated_at else None

        if item.sub_items:
            sub_count = len(item.sub_items)
            for idx, sub in enumerate(item.sub_items, start=1):
                if not sub.estimate_date:
                    continue
                del_date = sub.estimate_date.date()
                if d_from and del_date < d_from:
                    continue
                if d_to and del_date > d_to:
                    continue

                deliveries.append({
                    "po_number": po_num,
                    "po_date": po_dt,
                    "item_code": item_c,
                    "description": item_desc,
                    "delivery_date": del_date.strftime("%Y-%m-%d"),
                    "quantity": float(sub.quantity or 0),
                    "unit": unit,
                    "buyer": buyer,
                    "supplier_code": sup_code,
                    "supplier_name": sup_name,
                    "item_group": group,
                    "is_split_round": True,
                    "round_no": idx,
                    "total_rounds": sub_count,
                    "status": "confirmed",
                    "confirmed_at": confirmed_at_str,
                })
        elif item.estimate_date:
            del_date = item.estimate_date.date()
            if d_from and del_date < d_from:
                continue
            if d_to and del_date > d_to:
                continue

            deliveries.append({
                "po_number": po_num,
                "po_date": po_dt,
                "item_code": item_c,
                "description": item_desc,
                "delivery_date": del_date.strftime("%Y-%m-%d"),
                "quantity": float(item.estimate_qty if item.estimate_qty is not None else item.remaining_qty),
                "unit": unit,
                "buyer": buyer,
                "supplier_code": sup_code,
                "supplier_name": sup_name,
                "item_group": group,
                "is_split_round": False,
                "round_no": 1,
                "total_rounds": 1,
                "status": "confirmed",
                "confirmed_at": confirmed_at_str,
            })

    # Sort deliveries by delivery_date ASC, then po_number ASC
    deliveries.sort(key=lambda d: (d["delivery_date"], d["po_number"], d["item_code"]))

    # Audit log this API access
    now_utc = datetime.now(timezone.utc)
    await record_transaction_log(
        category="qms_integration",
        action="qms_pull_deliveries",
        status="SUCCESS",
        message=f"ระบบ QMS ดึงข้อมูลส่งมอบ Confirmed สำเร็จ {len(deliveries):,} รายการ (IP: {client_ip})",
        details=f"Filters: date_from={date_from}, date_to={date_to}, po={po_number}, item={item_code} | Total returned: {len(deliveries)}",
        db=db,
    )

    try:
        from app.services.telegram_service import send_telegram_qms_pull
        await send_telegram_qms_pull(
            db,
            item_count=len(deliveries),
            client_ip=client_ip,
            date_from=date_from,
            date_to=date_to,
            success=True,
        )
    except Exception:
        pass

    return {
        "status": "success",
        "timestamp": now_utc.isoformat(),
        "total_records": len(deliveries),
        "data": deliveries,
    }
