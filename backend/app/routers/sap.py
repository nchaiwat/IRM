"""
SAP Router — Inbound Data Push Endpoint, Script Generator, and Ingest Token Management.
"""

import secrets
from typing import Annotated, Any, Dict, List
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.services.sap_service import (
    generate_onprem_sync_script,
    ingest_pushed_sap_records,
    sync_sap_open_pos,
)

router = APIRouter(prefix="/api/sap", tags=["SAP Integration"])


class InboundPushPayload(BaseModel):
    records: List[Dict[str, Any]]
    pushed_at: str | None = None
    source_host: str | None = None


@router.post("/inbound-push")
async def receive_inbound_sap_push(
    payload: InboundPushPayload | List[Dict[str, Any]],
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    x_irm_ingest_key: Annotated[str | None, Header()] = None,
):
    """
    Inbound Data Push Endpoint for On-Premise Python Agent.
    Validates X-IRM-Ingest-Key against the secret token stored in System Settings.
    Ingests Open POs, updates Masters, detects closed POs, and triggers Telegram alerts.
    """
    # 1. Verify Ingest Token
    stmt = select(SystemSetting).where(SystemSetting.key == "sap_ingest_token")
    token_setting = (await db.execute(stmt)).scalar_one_or_none()
    configured_token = token_setting.value if token_setting and token_setting.value else "tok_irm_ingest_sec_8a39f029b4c12e87"

    provided_key = x_irm_ingest_key
    if not provided_key:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            provided_key = auth_header[7:].strip()

    if not provided_key or provided_key.strip() != configured_token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-IRM-Ingest-Key authentication header.",
        )

    # 2. Extract Records
    if isinstance(payload, list):
        raw_records = payload
        source_info = "On-Premise Agent (Raw List)"
    else:
        raw_records = payload.records
        source_info = f"On-Premise Agent ({payload.source_host or 'Host'})"

    if not raw_records:
        return {
            "status": "success",
            "message": "Push received with 0 records.",
            "total_records": 0,
            "closed_count": 0,
            "purged_count": 0,
        }

    # 3. Process and Save
    result = await ingest_pushed_sap_records(db, raw_records, triggered_by=source_info)
    return result


@router.get("/generate-agent-script")
async def download_or_view_agent_script(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    download: bool = False,
):
    """
    Dynamically generates the complete On-Premise Python Agent script (irm_agent_sync_vX.py).
    If download=true, increments the version number, logs the download audit trail, and returns a file download.
    """
    # Determine base URL from request host
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "irm.windowasia.com"
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    if "irm.windowasia.com" in host:
        proto = "https"
    base_url = f"{proto}://{host}"

    script_content, filename, version_num = await generate_onprem_sync_script(
        db,
        app_base_url=base_url,
        increment_version=download,
        downloaded_by=current_user.full_name,
    )

    if download:
        return Response(
            content=script_content,
            media_type="text/x-python",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    stmt = select(SystemSetting).where(SystemSetting.key == "sap_ingest_token")
    token_setting = (await db.execute(stmt)).scalar_one_or_none()
    ingest_token = token_setting.value if token_setting else "tok_irm_ingest_sec_8a39f029b4c12e87"

    return {
        "script": script_content,
        "filename": filename,
        "version": f"v{version_num}",
        "version_num": version_num,
        "ingest_url": f"{base_url}/api/sap/inbound-push",
        "ingest_token": ingest_token,
    }


@router.post("/regenerate-ingest-token")
async def regenerate_ingest_token(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Generate a new secure Ingest Token for the On-Premise Python Agent."""
    new_token = f"tok_irm_ingest_sec_{secrets.token_hex(16)}"
    stmt = select(SystemSetting).where(SystemSetting.key == "sap_ingest_token")
    token_setting = (await db.execute(stmt)).scalar_one_or_none()

    if token_setting:
        token_setting.value = new_token
    else:
        token_setting = SystemSetting(
            key="sap_ingest_token",
            value=new_token,
            description="Secret Token for On-Premise Python Agent Ingestion",
            category="sap",
            data_type="string",
        )
        db.add(token_setting)

    await db.commit()
    return {"ingest_token": new_token, "message": "สร้าง Ingest Secret Token ใหม่สำเร็จ"}


@router.post("/sync-now")
async def trigger_manual_sap_sync(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Manually trigger SAP Sync."""
    result = await sync_sap_open_pos(db, triggered_by=f"Manual Admin ({current_user.full_name})")
    return result
