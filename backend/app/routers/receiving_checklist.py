"""
Receiving Checklist Router — On-site delivery checklist, print layout support, and Item Group permission filtering.
"""

from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy import distinct, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import (
    get_current_user,
    require_permission,
    get_effective_user_allowed_groups,
    is_user_allowed_group,
)
from app.models.master import ItemMaster
from app.models.po import POHeader, POItem, SubItem
from app.models.user import User

router = APIRouter(prefix="/api/receiving-checklist", tags=["Receiving Checklist"])


@router.get("/item-groups")
async def get_unique_item_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/receiving-checklist", "view"))],
):
    """Returns a list of all distinct item groups available in ItemMaster and POItems."""
    stmt_po = select(distinct(POItem.item_group)).where(POItem.item_group.is_not(None), POItem.item_group != "")
    res_po = (await db.execute(stmt_po)).scalars().all()

    stmt_master = select(distinct(ItemMaster.item_group)).where(ItemMaster.item_group.is_not(None), ItemMaster.item_group != "")
    res_master = (await db.execute(stmt_master)).scalars().all()

    groups_set = set(res_po + res_master)
    groups_set.discard("-")
    groups_set.discard("")

    # Filter by user permissions if restricted
    user_allowed = get_effective_user_allowed_groups(current_user)
    if user_allowed != "*":
        groups_set = {g for g in groups_set if is_user_allowed_group(user_allowed, g)}

    return sorted(list(groups_set))


@router.get("")
async def get_receiving_checklist(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/receiving-checklist", "view"))],
    date_from: str | None = Query(None, description="Start date YYYY-MM-DD"),
    date_to: str | None = Query(None, description="End date YYYY-MM-DD"),
    item_group: str | None = Query(None, description="Filter by Item Group (HW, RM-กระจก, etc.)"),
    status_mode: str = Query("all", description="all, confirmed, estimate, overdue"),
    buyer_name: str | None = Query(None, description="Filter by Buyer Name"),
    supplier_code: str | None = Query(None, description="Filter by Supplier Code"),
):
    """
    Fetch deliveries structured for daily receiving checklist with on-site inspection checkboxes and print sheets.
    """
    user_allowed = get_effective_user_allowed_groups(current_user)

    stmt = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .options(selectinload(POItem.sub_items))
        .where(POHeader.status == "O")
        .where(POItem.status != "closed")
    )

    if buyer_name and buyer_name != "all":
        stmt = stmt.where(POHeader.buyer_name == buyer_name)
    if supplier_code and supplier_code != "all":
        stmt = stmt.where(POHeader.supplier_code == supplier_code)

    rows = (await db.execute(stmt)).all()

    now_dt = datetime.now(timezone.utc)
    today_str = now_dt.strftime("%Y-%m-%d")

    # Date parsing
    d_from = None
    d_to = None
    if date_from:
        try:
            d_from = datetime.strptime(date_from, "%Y-%m-%d").date()
        except ValueError:
            pass
    if date_to:
        try:
            d_to = datetime.strptime(date_to, "%Y-%m-%d").date()
        except ValueError:
            pass

    checklist_items = []
    total_qty = 0.0
    confirmed_count = 0
    estimate_count = 0
    overdue_count = 0
    unique_pos = set()
    unique_sups = set()

    for item, header in rows:
        grp = item.item_group or "-"
        # Enforce user role group restriction
        if not is_user_allowed_group(user_allowed, grp):
            continue
        # Apply specific item_group filter if selected
        if item_group and item_group != "all" and grp.strip().lower() != item_group.strip().lower():
            continue

        is_confirmed = (item.status == "confirmed")

        # Case A: Item has Sub-Items
        if item.sub_items:
            for sub in item.sub_items:
                target_dt = sub.estimate_date or item.estimate_date or item.due_date
                if not target_dt:
                    continue
                target_date = target_dt.date() if isinstance(target_dt, datetime) else target_dt
                target_date_str = target_date.strftime("%Y-%m-%d")

                # Date Range Filter
                if d_from and target_date < d_from:
                    continue
                if d_to and target_date > d_to:
                    continue

                is_overdue = not is_confirmed and target_date_str < today_str

                # Status Mode Filter
                if status_mode == "confirmed" and not is_confirmed:
                    continue
                if status_mode == "estimate" and is_confirmed:
                    continue
                if status_mode == "overdue" and not is_overdue:
                    continue

                qty = sub.quantity
                total_qty += qty
                if is_confirmed:
                    confirmed_count += 1
                else:
                    estimate_count += 1
                if is_overdue:
                    overdue_count += 1

                unique_pos.add(header.po_number)
                unique_sups.add(header.supplier_code)

                checklist_items.append({
                    "id": f"{item.id}-{sub.id}",
                    "po_id": header.id,
                    "po_number": header.po_number,
                    "po_date": header.po_date.strftime("%Y-%m-%d") if header.po_date else None,
                    "line_num": item.line_num or 0,
                    "item_code": f"↳ {item.item_code}",
                    "item_name": item.item_name,
                    "item_group": grp,
                    "quantity": qty,
                    "unit": item.unit,
                    "delivery_date": target_date_str,
                    "status": "confirmed" if is_confirmed else "estimate",
                    "is_confirmed": is_confirmed,
                    "is_overdue": is_overdue,
                    "supplier_code": header.supplier_code,
                    "supplier_name": header.supplier_name,
                    "buyer_name": header.buyer_name or "-",
                    "updated_by": sub.updated_by_name or item.updated_by_name or "-",
                    "is_sub_item": True,
                })
        else:
            # Case B: Main Item without Sub-Items
            target_dt = item.estimate_date or item.due_date
            if not target_dt:
                continue
            target_date = target_dt.date() if isinstance(target_dt, datetime) else target_dt
            target_date_str = target_date.strftime("%Y-%m-%d")

            # Date Range Filter
            if d_from and target_date < d_from:
                continue
            if d_to and target_date > d_to:
                continue

            is_overdue = not is_confirmed and target_date_str < today_str

            # Status Mode Filter
            if status_mode == "confirmed" and not is_confirmed:
                continue
            if status_mode == "estimate" and is_confirmed:
                continue
            if status_mode == "overdue" and not is_overdue:
                continue

            qty = item.estimate_qty or item.remaining_qty or item.quantity
            total_qty += qty
            if is_confirmed:
                confirmed_count += 1
            else:
                estimate_count += 1
            if is_overdue:
                overdue_count += 1

            unique_pos.add(header.po_number)
            unique_sups.add(header.supplier_code)

            checklist_items.append({
                "id": str(item.id),
                "po_id": header.id,
                "po_number": header.po_number,
                "po_date": header.po_date.strftime("%Y-%m-%d") if header.po_date else None,
                "line_num": item.line_num or 0,
                "item_code": item.item_code,
                "item_name": item.item_name,
                "item_group": grp,
                "quantity": qty,
                "unit": item.unit,
                "delivery_date": target_date_str,
                "status": "confirmed" if is_confirmed else "estimate",
                "is_confirmed": is_confirmed,
                "is_overdue": is_overdue,
                "supplier_code": header.supplier_code,
                "supplier_name": header.supplier_name,
                "buyer_name": header.buyer_name or "-",
                "updated_by": item.updated_by_name or "-",
                "is_sub_item": False,
            })

    # Sort checklist items chronologically by delivery_date, then po_number, then line_num
    checklist_items.sort(key=lambda x: (x["delivery_date"], x["po_number"], x["line_num"]))

    return {
        "items": checklist_items,
        "summary": {
            "total_items": len(checklist_items),
            "total_pos": len(unique_pos),
            "total_suppliers": len(unique_sups),
            "total_quantity": total_qty,
            "confirmed_count": confirmed_count,
            "estimate_count": estimate_count,
            "overdue_count": overdue_count,
        },
        "filters_applied": {
            "date_from": date_from,
            "date_to": date_to,
            "item_group": item_group or "all",
            "status_mode": status_mode,
            "user_allowed_groups": user_allowed,
        }
    }
