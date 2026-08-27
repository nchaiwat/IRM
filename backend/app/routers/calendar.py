"""
Calendar Router — Deliveries grouped by date for Calendar view. Supports both Main Items and Sub-Items.
"""

from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_permission
from app.models.po import POHeader, POItem, SubItem
from app.models.user import User

router = APIRouter(prefix="/api/calendar", tags=["Calendar"])


@router.get("")
async def get_calendar_events(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/calendar", "view"))],
):
    """Get all delivery events for Calendar view (Support Main Items, Sub-Items, Confirmed & Estimate status, with Buyer Name)."""
    stmt = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .options(selectinload(POItem.sub_items))
        .where(POHeader.status == "O")
        .where(POItem.status != "closed")
    )
    result = await db.execute(stmt)
    rows = result.all()

    events = []
    for item, header in rows:
        is_confirmed = (item.status == "confirmed")
        status_label = "confirmed" if is_confirmed else "estimate"
        buyer = header.buyer_name or "-"

        if item.sub_items:
            for sub in item.sub_items:
                if sub.estimate_date:
                    events.append({
                        "id": f"{item.id}-{sub.id}",
                        "title": f"↳ {item.item_code} - {header.supplier_name}",
                        "item_code": f"↳ {item.item_code}",
                        "item_name": item.item_name,
                        "supplier_code": header.supplier_code,
                        "supplier_name": header.supplier_name,
                        "buyer_name": buyer,
                        "date": sub.estimate_date.strftime("%Y-%m-%d"),
                        "quantity": sub.quantity,
                        "unit": item.unit,
                        "status": status_label,
                        "is_confirmed": is_confirmed,
                        "po_number": header.po_number,
                        "updated_by": sub.updated_by_name or item.updated_by_name or "-",
                    })
        elif item.estimate_date:
            events.append({
                "id": str(item.id),
                "title": f"{item.item_code} - {header.supplier_name}",
                "item_code": item.item_code,
                "item_name": item.item_name,
                "supplier_code": header.supplier_code,
                "supplier_name": header.supplier_name,
                "buyer_name": buyer,
                "date": item.estimate_date.strftime("%Y-%m-%d"),
                "quantity": item.estimate_qty or item.remaining_qty,
                "unit": item.unit,
                "status": status_label,
                "is_confirmed": is_confirmed,
                "po_number": header.po_number,
                "updated_by": item.updated_by_name or "-",
            })
        elif item.due_date:
            events.append({
                "id": str(item.id),
                "title": f"{item.item_code} - {header.supplier_name}",
                "item_code": item.item_code,
                "item_name": item.item_name,
                "supplier_code": header.supplier_code,
                "supplier_name": header.supplier_name,
                "buyer_name": buyer,
                "date": item.due_date.strftime("%Y-%m-%d"),
                "quantity": item.remaining_qty or item.quantity,
                "unit": item.unit,
                "status": status_label,
                "is_confirmed": False,
                "po_number": header.po_number,
                "updated_by": item.updated_by_name or "-",
            })

    return events
