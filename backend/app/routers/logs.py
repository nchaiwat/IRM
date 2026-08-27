"""
Logs Router — Transaction Log viewer, audit trail, stats, QMS JSON webhook integration, and retention.
"""

from datetime import datetime, timezone, timedelta
from typing import Annotated, Optional
import time
import httpx
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_permission
from app.models.po import POItem, POHeader
from app.models.system_setting import SystemSetting
from app.models.transaction_log import TransactionLog
from app.models.user import User
from app.services.log_service import record_transaction_log

router = APIRouter(prefix="/api/logs", tags=["Transaction Logs"])


class LogItemResponse(BaseModel):
    id: int
    category: str
    action: str
    status: str
    message: str
    details: Optional[str] = None
    records_count: int
    duration_ms: int
    triggered_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class LogsListResponse(BaseModel):
    items: list[LogItemResponse]
    total: int
    page: int
    page_size: int
    categories: list[str]


class LogSummaryStats(BaseModel):
    total_logs: int
    sap_sync_count: int
    email_sent_count: int
    qms_export_count: int
    portal_submits_count: int
    errors_count: int


@router.get("", response_model=LogsListResponse)
async def list_transaction_logs(
    current_user: Annotated[User, Depends(require_permission("/admin/logs", "view"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """
    List transaction logs with robust filtering (category, status, keyword, date range) and pagination.
    """
    query = select(TransactionLog)

    if category and category != "all":
        query = query.where(TransactionLog.category == category)

    if status_filter and status_filter != "all":
        query = query.where(TransactionLog.status == status_filter)

    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            (TransactionLog.message.ilike(s))
            | (TransactionLog.action.ilike(s))
            | (TransactionLog.triggered_by.ilike(s))
            | (TransactionLog.details.ilike(s))
        )

    if date_from:
        try:
            d_from = datetime.fromisoformat(date_from)
            query = query.where(TransactionLog.created_at >= d_from)
        except Exception:
            pass

    if date_to:
        try:
            d_to = datetime.fromisoformat(date_to) + timedelta(days=1)
            query = query.where(TransactionLog.created_at < d_to)
        except Exception:
            pass

    # Count total matching
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Fetch page
    offset = (page - 1) * page_size
    stmt = query.order_by(desc(TransactionLog.created_at)).offset(offset).limit(page_size)
    items = (await db.execute(stmt)).scalars().all()

    # Distinct categories in system
    cats_stmt = select(TransactionLog.category).distinct()
    categories = list((await db.execute(cats_stmt)).scalars().all())

    return LogsListResponse(
        items=[LogItemResponse.model_validate(it) for it in items],
        total=total,
        page=page,
        page_size=page_size,
        categories=categories,
    )


@router.get("/summary", response_model=LogSummaryStats)
async def get_log_summary_stats(
    current_user: Annotated[User, Depends(require_permission("/admin/logs", "view"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Quick dashboard summary for log statistics.
    """
    total_logs = (await db.execute(select(func.count(TransactionLog.id)))).scalar() or 0
    sap_sync = (await db.execute(select(func.count(TransactionLog.id)).where(TransactionLog.category == "sap_sync"))).scalar() or 0
    email_count = (await db.execute(select(func.count(TransactionLog.id)).where(TransactionLog.category == "supplier_email"))).scalar() or 0
    qms_count = (await db.execute(select(func.count(TransactionLog.id)).where(TransactionLog.category == "qms_export"))).scalar() or 0
    portal_count = (await db.execute(select(func.count(TransactionLog.id)).where(TransactionLog.category == "supplier_portal"))).scalar() or 0
    errors = (await db.execute(select(func.count(TransactionLog.id)).where(TransactionLog.status == "failed"))).scalar() or 0

    return LogSummaryStats(
        total_logs=total_logs,
        sap_sync_count=sap_sync,
        email_sent_count=email_count,
        qms_export_count=qms_count,
        portal_submits_count=portal_count,
        errors_count=errors,
    )


@router.get("/{log_id}", response_model=LogItemResponse)
async def get_single_log(
    log_id: int,
    current_user: Annotated[User, Depends(require_permission("/admin/logs", "view"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get single transaction log detail."""
    stmt = select(TransactionLog).where(TransactionLog.id == log_id)
    log_entry = (await db.execute(stmt)).scalar_one_or_none()
    if not log_entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log entry not found")
    return LogItemResponse.model_validate(log_entry)


@router.post("/trigger-qms-export")
async def trigger_qms_export(
    current_user: Annotated[User, Depends(require_permission("/admin/logs", "edit"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Exports latest open POs & delivery schedules as JSON to QMS Webhook/Endpoint and records in Transaction Log.
    """
    start_time = time.time()
    
    # 1. Fetch QMS Endpoint settings
    settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.category == "qms"))).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}
    qms_webhook_url = s_map.get("qms_webhook_url") or "http://qms-api.internal/api/irm/receive-schedule"
    qms_api_key = s_map.get("qms_api_key") or ""

    # 2. Build JSON Payload from active PO items
    stmt = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .where(POHeader.status == "O", POItem.status != "closed")
        .order_by(POHeader.po_number.desc())
    )
    rows = (await db.execute(stmt)).all()

    payload_items = []
    for item, header in rows:
        subs = []
        if item.sub_items:
            for sub in item.sub_items:
                subs.append({
                    "estimate_date": sub.estimate_date.isoformat() if sub.estimate_date else None,
                    "quantity": sub.quantity,
                })

        payload_items.append({
            "po_number": header.po_number,
            "po_date": header.po_date.isoformat() if header.po_date else None,
            "supplier_code": header.supplier_code,
            "supplier_name": header.supplier_name,
            "item_code": item.item_code,
            "item_name": item.item_name,
            "remaining_qty": item.remaining_qty,
            "unit": item.unit,
            "estimate_date": item.estimate_date.isoformat() if item.estimate_date else None,
            "estimate_qty": item.estimate_qty,
            "status": item.status,
            "sub_items": subs,
        })

    full_payload = {
        "source": "IRM_SYSTEM",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "exported_by": current_user.username,
        "total_items": len(payload_items),
        "items": payload_items,
    }

    # 3. Post to QMS or simulate dispatch
    qms_response_status = "simulated_success"
    http_code = 200
    response_body = {"status": "success", "message": f"Simulated QMS ingestion of {len(payload_items)} items"}

    if qms_webhook_url.startswith("http://") or qms_webhook_url.startswith("https://"):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {"Content-Type": "application/json"}
                if qms_api_key:
                    headers["X-API-KEY"] = qms_api_key
                res = await client.post(qms_webhook_url, json=full_payload, headers=headers)
                http_code = res.status_code
                try:
                    response_body = res.json()
                except Exception:
                    response_body = res.text[:500]
                qms_response_status = "success" if res.status_code in (200, 201) else "failed"
        except Exception as ex:
            qms_response_status = "failed"
            http_code = 500
            response_body = {"error": str(ex)}

    duration_ms = int((time.time() - start_time) * 1000)

    # 4. Record Transaction Log
    log_detail = {
        "target_endpoint": qms_webhook_url,
        "http_status_code": http_code,
        "response": response_body,
        "payload_sample": payload_items[:5],  # First 5 items preview
        "total_items_in_payload": len(payload_items),
    }

    await record_transaction_log(
        category="qms_export",
        action="push_qms_json",
        status="success" if qms_response_status in ("success", "simulated_success") else "failed",
        message=f"ส่งข้อมูล JSON ให้ระบบ QMS จำนวน {len(payload_items)} รายการ (HTTP {http_code})",
        details=log_detail,
        records_count=len(payload_items),
        duration_ms=duration_ms,
        triggered_by=f"user:{current_user.username}",
        db=db,
    )

    return {
        "status": qms_response_status,
        "http_code": http_code,
        "total_items": len(payload_items),
        "endpoint": qms_webhook_url,
        "response": response_body,
        "duration_ms": duration_ms,
    }
