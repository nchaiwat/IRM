"""
Dashboard Analytics Router — Executive & Operational Procurement KPI Engine.
Computes real-time statistics across 4 dimensions:
1. Supplier Performance & SLA Scorecard (OTIF, Reschedule frequency, Response time)
2. Cost & Risk Management (Critical overdue items, Split delivery overhead)
3. Purchasing Operations & Logistics Load Forecast (14-day Inbound projection, Buyer workload)
4. Digital Adoption & Process Governance (Portal adoption rate, SAP vs Actual variance)
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.po import POHeader, POItem, SubItem, POItemAuditLog
from app.models.master import SupplierMaster, ItemMaster
from app.dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard Analytics"])


@router.get("/analytics")
async def get_dashboard_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    now_dt = datetime.now(timezone(timedelta(hours=7)))
    today_date = now_dt.date()

    # 1. Fetch All PO Items and Headers
    stmt_items = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs))
    )
    all_rows = (await db.execute(stmt_items)).all()

    # 2. Key Metrics Aggregators
    open_items_count = 0
    open_pos_set = set()
    total_open_qty = 0.0
    critical_overdue_count = 0
    next_7d_items = 0
    next_7d_qty = 0.0

    seven_days_later = today_date + timedelta(days=7)
    fourteen_days_later = today_date + timedelta(days=14)

    # Daily Forecast map for next 14 days
    daily_forecast: Dict[str, Dict[str, Any]] = {}
    for i in range(15):
        d = today_date + timedelta(days=i)
        d_str = d.strftime("%d/%m/%Y")
        iso_str = d.isoformat()
        daily_forecast[iso_str] = {
            "date": d_str,
            "iso_date": iso_str,
            "day_name": d.strftime("%a"),
            "total_qty": 0.0,
            "item_count": 0,
            "groups": {},
        }

    # Group Distribution
    group_stats: Dict[str, Dict[str, Any]] = {}

    # Supplier Scorecard map
    supplier_stats: Dict[str, Dict[str, Any]] = {}

    # Buyer Workload map
    buyer_stats: Dict[str, Dict[str, Any]] = {}

    # Process Governance & Audit Analysis
    total_updates = 0
    supplier_portal_updates = 0
    buyer_manual_updates = 0
    items_with_split_rounds = 0
    total_reschedules = 0
    on_time_items = 0
    total_evaluated_items = 0

    for item, header in all_rows:
        is_open = header.status == "O" and (item.remaining_qty or 0) > 0 and item.status != "completed"
        rem_qty = float(item.remaining_qty or 0.0)
        po_qty = float(item.quantity or 0.0)
        est_qty = float(item.estimate_qty or 0.0)
        grp = item.item_group or "RM-กระจก"
        buyer = header.buyer_name or "จัดซื้อส่วนกลาง"
        sup_code = header.supplier_code
        sup_name = header.supplier_name

        # Buyer stats
        if buyer not in buyer_stats:
            buyer_stats[buyer] = {"buyer_name": buyer, "total_items": 0, "completed": 0, "pending": 0, "open_qty": 0.0}
        buyer_stats[buyer]["total_items"] += 1
        if is_open:
            buyer_stats[buyer]["pending"] += 1
            buyer_stats[buyer]["open_qty"] += rem_qty
        else:
            buyer_stats[buyer]["completed"] += 1

        # Supplier stats
        if sup_code not in supplier_stats:
            supplier_stats[sup_code] = {
                "supplier_code": sup_code,
                "supplier_name": sup_name,
                "total_items": 0,
                "open_items": 0,
                "completed_items": 0,
                "total_qty": 0.0,
                "open_qty": 0.0,
                "reschedules": 0,
                "portal_responses": 0,
                "on_time_count": 0,
                "evaluated_count": 0,
            }
        supplier_stats[sup_code]["total_items"] += 1
        supplier_stats[sup_code]["total_qty"] += po_qty

        # Audit logs analysis for Reschedules and Adoption
        has_sup_response = False
        update_count = 0
        if item.audit_logs:
            for log in item.audit_logs:
                total_updates += 1
                if log.changed_by_type == "supplier" or "supplier" in (log.action or "").lower():
                    supplier_portal_updates += 1
                    has_sup_response = True
                elif log.changed_by_type == "user":
                    buyer_manual_updates += 1

                if log.action in ["update_estimate", "update_subitem", "supplier_submit"] and "Date:" in (log.changes_detail or ""):
                    update_count += 1

        if update_count > 1:
            total_reschedules += (update_count - 1)
            supplier_stats[sup_code]["reschedules"] += (update_count - 1)

        if has_sup_response:
            supplier_stats[sup_code]["portal_responses"] += 1

        # Sub items (split rounds)
        if item.sub_items and len(item.sub_items) > 1:
            items_with_split_rounds += 1

        # Open Backlog
        if is_open:
            open_items_count += 1
            open_pos_set.add(header.po_number)
            total_open_qty += rem_qty
            supplier_stats[sup_code]["open_items"] += 1
            supplier_stats[sup_code]["open_qty"] += rem_qty

            # Group distribution
            if grp not in group_stats:
                group_stats[grp] = {"group": grp, "open_items": 0, "open_qty": 0.0}
            group_stats[grp]["open_items"] += 1
            group_stats[grp]["open_qty"] += rem_qty

            # Overdue Check
            due_d = item.due_date.date() if item.due_date else None
            if due_d and due_d < today_date:
                critical_overdue_count += 1

            # Inbound Forecast aggregation
            # Check either SubItems or parent estimate_date
            rounds = []
            if item.sub_items and len(item.sub_items) > 0:
                for sub in item.sub_items:
                    if sub.estimate_date:
                        rounds.append((sub.estimate_date.date(), float(sub.quantity or 0.0)))
            elif item.estimate_date:
                rounds.append((item.estimate_date.date(), est_qty if est_qty > 0 else rem_qty))
            elif item.due_date:
                rounds.append((item.due_date.date(), rem_qty))

            for r_date, r_qty in rounds:
                if today_date <= r_date <= seven_days_later:
                    next_7d_items += 1
                    next_7d_qty += r_qty

                iso_k = r_date.isoformat()
                if iso_k in daily_forecast:
                    daily_forecast[iso_k]["total_qty"] += r_qty
                    daily_forecast[iso_k]["item_count"] += 1
                    daily_forecast[iso_k]["groups"][grp] = daily_forecast[iso_k]["groups"].get(grp, 0.0) + r_qty
        else:
            supplier_stats[sup_code]["completed_items"] += 1

        # Evaluate OTIF (On-Time In-Full)
        if item.estimate_date and item.due_date:
            total_evaluated_items += 1
            supplier_stats[sup_code]["evaluated_count"] += 1
            # If estimate_date <= due_date
            if item.estimate_date.date() <= item.due_date.date():
                on_time_items += 1
                supplier_stats[sup_code]["on_time_count"] += 1

    # 3. Compute Percentages and Scorecards
    otif_rate = round((on_time_items / total_evaluated_items * 100), 1) if total_evaluated_items > 0 else 0.0
    portal_adoption_rate = round((supplier_portal_updates / total_updates * 100), 1) if total_updates > 0 else 0.0
    split_delivery_pct = round((items_with_split_rounds / max(len(all_rows), 1) * 100), 1)

    # Format Group Stats
    group_list = []
    total_group_qty = sum(g["open_qty"] for g in group_stats.values()) or 1.0
    for g_name, g_val in group_stats.items():
        group_list.append({
            "group": g_name,
            "open_items": g_val["open_items"],
            "open_qty": round(g_val["open_qty"], 0),
            "percentage": round((g_val["open_qty"] / total_group_qty * 100), 1),
        })
    group_list.sort(key=lambda x: x["open_qty"], reverse=True)

    # Format Supplier Scorecard
    supplier_list = []
    for s_code, s_val in supplier_stats.items():
        s_eval = s_val["evaluated_count"]
        s_otif = round((s_val["on_time_count"] / s_eval * 100), 1) if s_eval > 0 else 0.0
        s_total = s_val["total_items"] or 1
        s_portal_rate = round((s_val["portal_responses"] / s_total * 100), 1)

        # Grade calculation
        if s_eval == 0:
            grade = "-"
            status_text = "⚪ รอข้อมูลส่งมอบ (No Delivery Yet)"
        elif s_otif >= 95 and s_val["reschedules"] <= 1:
            grade = "A"
            status_text = "🟢 ดีเยี่ยม (SLA Met)"
        elif s_otif >= 85:
            grade = "B"
            status_text = "🟢 ตามมาตรฐาน (Standard)"
        elif s_otif >= 75:
            grade = "C"
            status_text = "🟡 ควรปรับปรุง (Watchlist)"
        else:
            grade = "D"
            status_text = "🔴 วิกฤต / เสี่ยงสูง (Critical)"

        supplier_list.append({
            "supplier_code": s_code,
            "supplier_name": s_val["supplier_name"],
            "total_items": s_val["total_items"],
            "open_items": s_val["open_items"],
            "completed_items": s_val["completed_items"],
            "open_qty": round(s_val["open_qty"], 0),
            "otif_rate": s_otif,
            "reschedules": s_val["reschedules"],
            "portal_adoption_rate": s_portal_rate,
            "grade": grade,
            "sla_status": status_text,
        })
    supplier_list.sort(key=lambda x: (x["open_items"], x["open_qty"]), reverse=True)

    # Format Buyer Workload
    buyer_list = []
    for b_name, b_val in buyer_stats.items():
        b_tot = b_val["total_items"] or 1
        completion_pct = round((b_val["completed"] / b_tot * 100), 1)
        buyer_list.append({
            "buyer_name": b_name,
            "total_items": b_val["total_items"],
            "pending_items": b_val["pending"],
            "completed_items": b_val["completed"],
            "open_qty": round(b_val["open_qty"], 0),
            "completion_rate": completion_pct,
        })
    buyer_list.sort(key=lambda x: x["pending_items"], reverse=True)

    # Format Forecast
    forecast_list = list(daily_forecast.values())

    return {
        "summary": {
            "total_open_pos": len(open_pos_set),
            "total_open_items": open_items_count,
            "total_open_qty": round(total_open_qty, 0),
            "otif_rate": otif_rate,
            "critical_overdue_count": critical_overdue_count,
            "next_7d_items": next_7d_items,
            "next_7d_qty": round(next_7d_qty, 0),
            "total_reschedules": total_reschedules,
            "portal_adoption_rate": portal_adoption_rate,
            "split_delivery_pct": split_delivery_pct,
        },
        "inbound_forecast": forecast_list,
        "item_groups": group_list,
        "supplier_scorecard": supplier_list,
        "buyer_workload": buyer_list,
        "digital_adoption": {
            "portal_self_service_pct": portal_adoption_rate,
            "buyer_manual_override_pct": round(100.0 - portal_adoption_rate, 1),
            "total_audit_events": total_updates,
        }
    }
