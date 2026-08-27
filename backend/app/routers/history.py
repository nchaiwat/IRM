"""
History Router — Closed PO history (Status C).
"""

from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_permission
from app.models.po import POHeader, POItem, POItemAuditLog
from app.models.user import User
from app.schemas.po import POItemResponse

router = APIRouter(prefix="/api/history", tags=["History"])


@router.get("", response_model=list[POItemResponse])
async def list_history_items(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/history", "view"))],
):
    """Get all closed PO items (Status 'closed' or POHeader status 'C') with eager loaded sub-items."""
    stmt = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .where(or_(POItem.status == "closed", POHeader.status == "C"))
        .options(selectinload(POItem.sub_items))
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
                sub_items=item.sub_items or [],
                audit_logs=[],
            )
        )
    return items_response


@router.get("/items/{item_id}/audit-logs")
async def get_history_item_audit_logs(
    item_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/history", "view"))],
):
    """Lazy load audit logs for a specific closed PO item on modal open."""
    stmt = (
        select(POItemAuditLog)
        .where(POItemAuditLog.po_item_id == item_id)
        .order_by(POItemAuditLog.changed_at.desc())
    )
    logs = (await db.execute(stmt)).scalars().all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "changes_detail": log.changes_detail,
            "changed_by_name": log.changed_by_name,
            "changed_by_type": log.changed_by_type,
            "changed_at": log.changed_at.isoformat() if log.changed_at else None,
        }
        for log in logs
    ]
