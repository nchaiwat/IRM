"""
IRM In-App AI Copilot Router (Enterprise Standard v2.8.0)
Provides:
- GET  /api/settings/ai      (Dynamic AI config & widget visibility check, API Key masked)
- PUT  /api/settings/ai      (Admin-only real-time update of AI Copilot settings + Audit Log)
- POST /api/settings/ai/test (Admin-only API Key connectivity & latency test)
- POST /api/ai/chat          (RBAC-scoped Read-Only & Zero-Training AI Copilot chat endpoint)
"""

from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_permission
from app.models.system_setting import SystemSetting
from app.models.user import User
from app.services.ai_copilot_service import (
    DEFAULT_SYSTEM_PROMPT,
    build_rbac_context_for_query,
    call_external_llm_provider,
    detect_mutation_intent,
    generate_local_readonly_response,
    get_ai_copilot_settings,
    invalidate_ai_cache,
    is_admin_user,
    mask_ai_api_key,
    sanitize_context_for_privacy,
    test_ai_provider_connection,
)
from app.services.log_service import record_transaction_log

router = APIRouter(prefix="/api", tags=["AI Copilot"])


class AISettingsUpdateRequest(BaseModel):
    ai_copilot_enabled: Optional[bool] = None
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_api_key: Optional[str] = None
    clear_api_key: Optional[bool] = False
    ai_base_url: Optional[str] = None
    ai_system_prompt: Optional[str] = None
    ai_allow_mcp_tools: Optional[bool] = None


class AITestConnectionRequest(BaseModel):
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_api_key: Optional[str] = None
    ai_base_url: Optional[str] = None


class AIChatMessage(BaseModel):
    role: str  # 'user', 'assistant', 'system'
    content: str


class AIChatRequest(BaseModel):
    messages: List[AIChatMessage]


@router.get("/settings/ai")
async def get_ai_settings_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Retrieve AI Copilot configuration.
    - Enforces Section 11.2 Rule 1: `widget_enabled` is True ONLY when `ai_copilot_enabled` is True AND API Key / Endpoint is configured.
    - Masks `ai_api_key` so the full key is never exposed.
    """
    cfg = await get_ai_copilot_settings(db, force_refresh=True)
    widget_ready = bool(cfg["ai_copilot_enabled"] and cfg["has_valid_credentials"])

    # Non-admin users only need widget visibility and basic model metadata
    if not is_admin_user(current_user):
        return {
            "status": "success",
            "enabled": widget_ready,
            "ai_copilot_enabled": cfg["ai_copilot_enabled"],
            "has_api_key": cfg["has_api_key"],
            "provider": cfg["ai_provider"],
            "model": cfg["ai_model"],
            "allow_mcp_tools": cfg["ai_allow_mcp_tools"],
        }

    return {
        "status": "success",
        "enabled": widget_ready,
        "ai_copilot_enabled": cfg["ai_copilot_enabled"],
        "provider": cfg["ai_provider"],
        "model": cfg["ai_model"],
        "has_api_key": cfg["has_api_key"],
        "api_key_masked": cfg["ai_api_key_masked"],
        "base_url": cfg["ai_base_url"],
        "system_prompt": cfg["ai_system_prompt"],
        "allow_mcp_tools": cfg["ai_allow_mcp_tools"],
        "updated_at": cfg["updated_at"],
    }


@router.put("/settings/ai")
async def update_ai_settings_endpoint(
    body: AISettingsUpdateRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "edit"))],
):
    """
    Update AI Copilot settings dynamically in `system_settings` (Zero .env dependency).
    Preserves existing `ai_api_key` if masked or empty unless `clear_api_key=True`.
    """
    client_ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    updates: dict[str, str] = {}
    if body.ai_copilot_enabled is not None:
        updates["ai_copilot_enabled"] = "true" if body.ai_copilot_enabled else "false"
    if body.ai_provider is not None:
        updates["ai_provider"] = body.ai_provider.strip().lower()
    if body.ai_model is not None:
        updates["ai_model"] = body.ai_model.strip()
    if body.ai_base_url is not None:
        updates["ai_base_url"] = body.ai_base_url.strip()
    if body.ai_system_prompt is not None:
        updates["ai_system_prompt"] = body.ai_system_prompt.strip() or DEFAULT_SYSTEM_PROMPT
    if body.ai_allow_mcp_tools is not None:
        updates["ai_allow_mcp_tools"] = "true" if body.ai_allow_mcp_tools else "false"

    if body.clear_api_key:
        updates["ai_api_key"] = ""
    elif body.ai_api_key is not None:
        val = body.ai_api_key.strip()
        if val and "..." not in val and "****" not in val:
            updates["ai_api_key"] = val

    changed_fields = []
    for key, str_val in updates.items():
        stmt = select(SystemSetting).where(SystemSetting.key == key)
        row = (await db.execute(stmt)).scalar_one_or_none()
        if row:
            if row.value != str_val:
                row.value = str_val
                changed_fields.append(key)
        else:
            dtype = (
                "encrypted"
                if key == "ai_api_key"
                else ("boolean" if key in ("ai_copilot_enabled", "ai_allow_mcp_tools") else "string")
            )
            new_row = SystemSetting(
                key=key,
                value=str_val,
                category="ai_copilot",
                data_type=dtype,
                description=f"AI Copilot: {key}",
            )
            db.add(new_row)
            changed_fields.append(key)

    await db.commit()
    invalidate_ai_cache()

    if changed_fields:
        await record_transaction_log(
            category="system_setting",
            action="update_ai_settings",
            status="success",
            message="แก้ไขการตั้งค่าระบบ In-App AI Copilot & MCP Tools",
            details={"changed_fields": changed_fields, "ip": client_ip},
            triggered_by=f"user:{current_user.username}",
            db=db,
        )

    refreshed = await get_ai_copilot_settings(db, force_refresh=True)
    widget_ready = bool(refreshed["ai_copilot_enabled"] and refreshed["has_valid_credentials"])
    return {
        "status": "success",
        "message": "บันทึกการตั้งค่า AI Copilot สำเร็จเรียบร้อยแล้ว",
        "changed_fields": changed_fields,
        "settings": {
            "enabled": widget_ready,
            "ai_copilot_enabled": refreshed["ai_copilot_enabled"],
            "provider": refreshed["ai_provider"],
            "model": refreshed["ai_model"],
            "has_api_key": refreshed["has_api_key"],
            "api_key_masked": refreshed["ai_api_key_masked"],
            "base_url": refreshed["ai_base_url"],
            "system_prompt": refreshed["ai_system_prompt"],
            "allow_mcp_tools": refreshed["ai_allow_mcp_tools"],
            "updated_at": refreshed["updated_at"],
        },
    }


@router.post("/settings/ai/test")
async def test_ai_connection_endpoint(
    body: Optional[AITestConnectionRequest],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_permission("/admin/settings", "view"))],
):
    """
    Test connectivity and API Key validity with the selected AI Provider.
    Uses stored API Key from database if not overridden in request body.
    """
    cfg = await get_ai_copilot_settings(db, force_refresh=True)
    provider = (body.ai_provider if (body and body.ai_provider) else cfg["ai_provider"]).strip().lower()
    model = (body.ai_model if (body and body.ai_model) else cfg["ai_model"]).strip()
    base_url = (body.ai_base_url if (body and body.ai_base_url is not None) else cfg["ai_base_url"]).strip()

    api_key = cfg["ai_api_key"]
    if body and body.ai_api_key:
        candidate = body.ai_api_key.strip()
        if candidate and "..." not in candidate and "****" not in candidate:
            api_key = candidate

    result = await test_ai_provider_connection(
        provider=provider,
        model=model,
        api_key=api_key,
        base_url=base_url,
    )
    return result


@router.post("/ai/chat")
async def chat_with_copilot_endpoint(
    req: AIChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Process user chat message with IRM AI Copilot:
    1. Checks `ai_copilot_enabled` switch.
    2. Enforces Strict Read-Only / Zero-Mutation Guard.
    3. Executes Read-Only Analytical Tools scoped strictly by `current_user` RBAC & Item Groups.
    4. Scrubs secrets via DLP Scrubber and calls LLM with ZERO_TRAINING_PRIVACY_HEADERS.
    """
    cfg = await get_ai_copilot_settings(db)
    if not cfg["ai_copilot_enabled"]:
        return {
            "message": {
                "role": "assistant",
                "content": "⚠️ ระบบ AI Copilot ถูกปิดใช้งานอยู่ กรุณาติดต่อผู้ดูแลระบบเพื่อเปิดใช้งานในหน้า System Settings",
            }
        }

    if not req.messages:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Messages list cannot be empty")

    raw_user_text = req.messages[-1].content or ""
    user_query = sanitize_context_for_privacy(raw_user_text)

    # 1. Check for Mutation Intent (Strict Read-Only Policy)
    mutation_info = detect_mutation_intent(user_query)

    # 2. Gather Ephemeral Read-Only Context from IRM Database (Scoped to current_user RBAC)
    context_data = await build_rbac_context_for_query(db, current_user, user_query)

    # If user explicitly asked to mutate data, return immediate polite Read-Only refusal + live preview
    if mutation_info:
        refusal_text = generate_local_readonly_response(user_query, context_data, mutation_info=mutation_info)
        return {
            "message": {
                "role": "assistant",
                "content": refusal_text,
            },
            "governance": {
                "read_only_enforced": True,
                "zero_training": True,
                "mutation_blocked": True,
            },
        }

    # 3. Call External LLM Provider if API Key / Valid Endpoint is configured
    if cfg["has_valid_credentials"]:
        msg_dicts = [{"role": m.role, "content": m.content} for m in req.messages]
        ok, llm_answer = await call_external_llm_provider(
            cfg=cfg,
            messages=msg_dicts,
            context_data=context_data,
            mutation_info=None,
        )
        if ok and llm_answer.strip():
            return {
                "message": {
                    "role": "assistant",
                    "content": llm_answer.strip(),
                },
                "governance": {
                    "read_only_enforced": True,
                    "zero_training": True,
                    "provider": cfg["ai_provider"],
                    "model": cfg["ai_model"],
                },
            }

    # 4. Zero-Cost Local Rule-Based Read-Only Assistant Fallback
    local_answer = generate_local_readonly_response(user_query, context_data, mutation_info=None)
    return {
        "message": {
            "role": "assistant",
            "content": local_answer,
        },
        "governance": {
            "read_only_enforced": True,
            "zero_training": True,
            "provider": "local_readonly_engine",
        },
    }
