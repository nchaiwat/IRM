"""
History Router — Closed PO history (Status C).
"""

from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.po import POHeader, POItem
from app.models.user import User
from app.schemas.po import POItemResponse

router = APIRouter(prefix="/api/history", tags=["History"])


@router.get("", response_model=list[POItemResponse])
async def list_history_items(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Get all closed PO items (Status 'closed' or POHeader status 'C')."""
    from sqlalchemy import or_
    stmt = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .where(or_(POItem.status == "closed", POHeader.status == "C"))
        .order_by(POItem.closed_at.desc().nullslast(), POHeader.po_number.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    items_response: list[POItemResponse] = []
    for item, header in rows:
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
                status="closed",
                is_new=False,
                closed_at=item.closed_at,
                locked_by=None,
                lock_expires_at=None,
                updated_by_name=item.updated_by_name,
                updated_by_type=item.updated_by_type,
                updated_at=item.updated_at,
                sub_items=item.sub_items,
                audit_logs=item.audit_logs,
            )
        )
    return items_response
