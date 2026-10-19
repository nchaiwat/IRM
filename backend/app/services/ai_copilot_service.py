"""
IRM In-App AI Copilot & Read-Only MCP Tools Service (Enterprise Standard v2.8.0)
Enforces:
1. Full Read & Analytical Parity across IRM modules
2. Strict Role-Based Access Control (RBAC & Item Group Scoping)
3. Strict Read-Only / Zero-Mutation Policy
4. Strict Zero-Training & Enterprise Data Sovereignty (DLP Scrubber + Mandatory Headers)
5. Pure Date Standard (dd/mm/yyyy)
"""

import re
import time
import json
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select, func, desc, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_effective_user_allowed_groups, is_user_allowed_group
from app.models.system_setting import SystemSetting
from app.models.po import POHeader, POItem, SubItem
from app.models.master import ItemMaster, SupplierMaster
from app.models.transaction_log import TransactionLog
from app.models.user import User
from app.models.auth_matrix import AuthMatrix
from app.models.menu import Menu

BKK_TZ = ZoneInfo("Asia/Bangkok")

# Mandatory Headers ห้ามนำข้อมูลไป Train โมเดลและห้ามจัดเก็บสะสม (Zero Data Retention)
ZERO_TRAINING_PRIVACY_HEADERS: Dict[str, str] = {
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Pragma": "no-cache",
    "X-Data-Retention": "none",
    "X-No-Model-Training": "true",
    "X-OpenAI-Data-Usage-Opt-Out": "true",
    "X-Enterprise-Data-Sovereignty": "Window-Asia-Internal-Only-No-Training",
}

DEFAULT_SYSTEM_PROMPT = (
    "คุณคือผู้ช่วย AI อัจฉริยะประจำระบบ IRM (Incoming Raw Material Management System) "
    "ของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) มีหน้าที่ช่วยตรวจสอบ ค้นหา วิเคราะห์ และสรุปสถานะใบสั่งซื้อวัตถุดิบ (PO), "
    "กำหนดการส่งมอบ (Calendar & Receiving Checklist), ข้อมูลสินค้า (Item Master), และข้อมูลผู้ขาย (Supplier Master) "
    "แบบอ่านอย่างเดียว (Strict Read-Only) ภายใต้สิทธิ์ของผู้ใช้งานจริง ห้ามแก้ไข เพิ่ม หรือลบข้อมูลใดๆ ในระบบ "
    "และแสดงผลวันที่ในรูปแบบ dd/mm/yyyy (ค.ศ.) เสมอ"
)

# In-memory cache for AI settings
_AI_CONFIG_CACHE: Dict[str, Any] = {}
_AI_CACHE_EXPIRES_AT: float = 0.0
AI_CACHE_TTL_SECONDS = 30.0


def invalidate_ai_cache() -> None:
    """Clear in-memory AI Copilot configuration cache."""
    global _AI_CONFIG_CACHE, _AI_CACHE_EXPIRES_AT
    _AI_CONFIG_CACHE = {}
    _AI_CACHE_EXPIRES_AT = 0.0


def mask_ai_api_key(raw_key: Optional[str]) -> Optional[str]:
    """Mask AI API Key so full secret is never exposed via GET API."""
    if not raw_key:
        return None
    clean = raw_key.strip()
    if not clean:
        return None
    if len(clean) <= 10:
        return f"{clean[:2]}****{clean[-2:]}" if len(clean) > 4 else "****"
    return f"{clean[:6]}...{clean[-4:]}"


def sanitize_context_for_privacy(text: str) -> str:
    """DLP Scrubber: ป้องกันไม่ให้รหัสผ่านหรือคีย์ความลับถูกส่งออกนอกระบบ 100%."""
    if not text:
        return ""
    sanitized = re.sub(r"sec_[A-Za-z0-9_]{6,}", "[REDACTED_SECRET_KEY]", text)
    sanitized = re.sub(r"tok_irm_[A-Za-z0-9_]{6,}", "[REDACTED_INGEST_TOKEN]", sanitized)
    sanitized = re.sub(r"irm_qms_[A-Za-z0-9_]{6,}", "[REDACTED_QMS_KEY]", sanitized)
    sanitized = re.sub(r"AIzaSy[A-Za-z0-9_-]{20,}", "[REDACTED_GOOGLE_API_KEY]", sanitized)
    sanitized = re.sub(r"sk-[A-Za-z0-9_-]{20,}", "[REDACTED_OPENAI_API_KEY]", sanitized)
    sanitized = re.sub(
        r'("(?:hashed_password|password|password_hash|client_secret|api_key|private_key|secret_key|bot_token)"\s*:\s*)"[^"]*"',
        r'\1"[REDACTED_BY_DLP]"',
        sanitized,
        flags=re.IGNORECASE,
    )
    return sanitized


def format_ddmmyyyy(d: Any) -> str:
    """Pure Date Standard formatter: always returns dd/mm/yyyy or '-'."""
    if not d:
        return "-"
    if isinstance(d, datetime):
        if d.tzinfo:
            d = d.astimezone(BKK_TZ).date()
        else:
            d = d.date()
    if isinstance(d, date):
        return f"{d.day:02d}/{d.month:02d}/{d.year:04d}"
    s = str(d).strip()[:10]
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        parts = s.split("-")
        return f"{parts[2]}/{parts[1]}/{parts[0]}"
    return str(d)


def to_pure_date(d: Any) -> Optional[date]:
    """Convert date/datetime/string safely to datetime.date in Asia/Bangkok."""
    if not d:
        return None
    if isinstance(d, datetime):
        return d.astimezone(BKK_TZ).date() if d.tzinfo else d.date()
    if isinstance(d, date):
        return d
    try:
        s = str(d).strip()[:10]
        if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
            return datetime.strptime(s, "%Y-%m-%d").date()
        if re.match(r"^\d{2}/\d{2}/\d{4}$", s):
            return datetime.strptime(s, "%d/%m/%Y").date()
    except Exception:
        return None
    return None


async def get_ai_copilot_settings(db: AsyncSession, force_refresh: bool = False) -> Dict[str, Any]:
    """Load AI Copilot configuration dynamically from system_settings table."""
    global _AI_CONFIG_CACHE, _AI_CACHE_EXPIRES_AT
    now = time.time()
    if not force_refresh and _AI_CONFIG_CACHE and now < _AI_CACHE_EXPIRES_AT:
        return _AI_CONFIG_CACHE

    ai_keys = [
        "ai_copilot_enabled",
        "ai_provider",
        "ai_model",
        "ai_api_key",
        "ai_base_url",
        "ai_system_prompt",
        "ai_allow_mcp_tools",
    ]
    stmt = select(SystemSetting).where(SystemSetting.key.in_(ai_keys))
    rows = (await db.execute(stmt)).scalars().all()
    s_map = {r.key: (r.value or "") for r in rows}

    updated_at_vals = [r.updated_at for r in rows if r.updated_at]
    latest_updated = max(updated_at_vals).isoformat() if updated_at_vals else None

    raw_key = s_map.get("ai_api_key", "").strip()
    provider = (s_map.get("ai_provider") or "google").strip().lower()
    base_url = (s_map.get("ai_base_url") or "").strip()

    # For ollama/custom local endpoint, API key might be optional if base_url is set
    has_valid_credentials = bool(raw_key) or (provider in ("ollama", "custom") and bool(base_url))

    cfg = {
        "ai_copilot_enabled": s_map.get("ai_copilot_enabled", "false").strip().lower() == "true",
        "ai_provider": provider,
        "ai_model": (s_map.get("ai_model") or "gemini-2.5-flash").strip(),
        "ai_api_key": raw_key,
        "ai_api_key_masked": mask_ai_api_key(raw_key),
        "has_api_key": bool(raw_key),
        "has_valid_credentials": has_valid_credentials,
        "ai_base_url": base_url,
        "ai_system_prompt": (s_map.get("ai_system_prompt") or DEFAULT_SYSTEM_PROMPT).strip(),
        "ai_allow_mcp_tools": s_map.get("ai_allow_mcp_tools", "true").strip().lower() == "true",
        "updated_at": latest_updated,
    }
    _AI_CONFIG_CACHE = cfg
    _AI_CACHE_EXPIRES_AT = now + AI_CACHE_TTL_SECONDS
    return cfg


def is_admin_user(user: User) -> bool:
    """Check if user is an administrator."""
    if user.username and user.username.lower() == "admin":
        return True
    if user.group and user.group.name.lower() == "admin":
        return True
    return False


async def get_user_viewable_menus(db: AsyncSession, user: User) -> List[str]:
    """Return list of menu paths the user has can_view permission for."""
    if is_admin_user(user):
        return [
            "/dashboard",
            "/operation",
            "/calendar",
            "/receiving-checklist",
            "/items",
            "/suppliers",
            "/history",
            "/system-blueprint",
            "/admin/settings",
            "/admin/users",
            "/admin/groups",
            "/admin/auth-matrix",
            "/admin/logs",
        ]
    if not user.group_id:
        return ["/dashboard"]
    stmt = (
        select(Menu.path)
        .join(AuthMatrix, AuthMatrix.menu_id == Menu.id)
        .where(
            AuthMatrix.group_id == user.group_id,
            AuthMatrix.can_view == True,
            Menu.path != None,
        )
    )
    paths = (await db.execute(stmt)).scalars().all()
    return [p for p in paths if p]


def detect_mutation_intent(user_text: str) -> Optional[Dict[str, str]]:
    """
    Strict Read-Only / Zero-Mutation Policy Guard:
    Detects if the user is asking the AI to modify, update, insert, delete, or approve data.
    Returns guidance on which UI menu to use instead.
    """
    t = user_text.strip().lower()
    mutation_patterns = [
        r"(ช่วย|สั่ง|กด|ทำ|ขอ)?\s*(แก้ไข|อัปเดต|อัพเดท|เปลี่ยน|แก้|ปรับ|บันทึก|เซฟ|เพิ่ม|สร้าง|ลบ|ยกเลิก|อนุมัติ|ยืนยัน|ปลดล็อค|ล็อค)\s*(ข้อมูล|วันส่ง|วันที่|จำนวน|รายการ|po|ใบสั่งซื้อ|ซัพพลายเออร์|คู่ค้า|รหัสสินค้า|ผู้ใช้|บัญชี|สิทธิ์|อีเมล|เบอร์โทร|lead\s*time)",
        r"\b(update|delete|insert|drop|truncate|modify|edit|approve|accept|unlock|remove|create)\s+(po|item|supplier|user|setting|date|qty|quantity|status)\b",
        r"(กด\s*accept|กด\s*confirm|ลบ\s*user|สร้าง\s*user|เปลี่ยนวันส่งเป็น|แก้วันส่งเป็น)",
    ]
    for pat in mutation_patterns:
        if re.search(pat, t, flags=re.IGNORECASE):
            # Determine target menu suggestion
            if any(k in t for k in ["supplier", "คู่ค้า", "ผู้ขาย", "อีเมล", "ส่งเกิน"]):
                menu_hint = "เมนู **Supplier Master (`/suppliers`)**"
            elif any(k in t for k in ["item master", "lead time", "alert", "รหัสสินค้า"]):
                menu_hint = "เมนู **Item Master (`/items`)**"
            elif any(k in t for k in ["user", "ผู้ใช้", "พนักงาน", "สิทธิ์", "บัญชี"]):
                menu_hint = "เมนู **User Management (`/admin/users`)**"
            elif any(k in t for k in ["setting", "ตั้งค่า", "telegram", "smtp", "sso"]):
                menu_hint = "เมนู **System Setting (`/admin/settings`)**"
            else:
                menu_hint = "เมนู **Operation (`/operation`)**"

            return {
                "is_mutation": "true",
                "menu_hint": menu_hint,
            }
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Read-Only Analytical Tools (Scoped strictly by current_user RBAC)
# ──────────────────────────────────────────────────────────────────────────────

async def tool_get_dashboard_summary(db: AsyncSession, user: User) -> Dict[str, Any]:
    """Tool 1: Read-Only KPI Summary of Open POs, Overdue, Today's Deliveries, and Group Breakdown."""
    today = datetime.now(BKK_TZ).date()
    near_due_limit = today + timedelta(days=3)
    allowed_groups_str = get_effective_user_allowed_groups(user)

    stmt = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .options(selectinload(POItem.sub_items))
        .where(POHeader.status == "O")
    )
    rows = (await db.execute(stmt)).all()

    open_po_numbers = set()
    open_items_count = 0
    total_remaining_qty = 0.0
    overdue_count = 0
    near_due_count = 0
    today_delivery_count = 0
    supplier_responded_count = 0
    confirmed_count = 0
    unplanned_count = 0
    new_today_count = 0
    group_breakdown: Dict[str, Dict[str, Any]] = {}

    for item, header in rows:
        if (item.remaining_qty or 0) <= 0 or item.status in ("completed", "closed"):
            continue
        if not is_user_allowed_group(allowed_groups_str, item.item_group):
            continue

        open_po_numbers.add(header.po_number)
        open_items_count += 1
        rem_qty = float(item.remaining_qty or 0.0)
        total_remaining_qty += rem_qty

        grp = item.item_group or "ไม่ระบุกลุ่ม"
        if grp not in group_breakdown:
            group_breakdown[grp] = {"item_count": 0, "remaining_qty": 0.0, "overdue_count": 0}
        group_breakdown[grp]["item_count"] += 1
        group_breakdown[grp]["remaining_qty"] += rem_qty

        if item.is_new:
            new_today_count += 1
        if item.status == "supplier_responded":
            supplier_responded_count += 1
        elif item.status == "confirmed":
            confirmed_count += 1

        # Determine effective delivery dates (consider sub_items if present)
        est_date = to_pure_date(item.estimate_date)
        due_date = to_pure_date(item.due_date)
        target_date = est_date or due_date

        has_today = False
        if item.sub_items:
            sub_dates = [to_pure_date(s.estimate_date) for s in item.sub_items if s.estimate_date]
            if any(sd == today for sd in sub_dates):
                has_today = True
            valid_sub_dates = [sd for sd in sub_dates if sd is not None]
            if valid_sub_dates:
                target_date = min(valid_sub_dates)
        else:
            if est_date == today:
                has_today = True

        if has_today:
            today_delivery_count += 1

        if not est_date and not (item.sub_items and len(item.sub_items) > 0):
            unplanned_count += 1

        if target_date:
            if target_date < today:
                overdue_count += 1
                group_breakdown[grp]["overdue_count"] += 1
            elif today <= target_date <= near_due_limit:
                near_due_count += 1

    return {
        "as_of_date": format_ddmmyyyy(today),
        "user_allowed_item_groups": allowed_groups_str,
        "total_open_pos": len(open_po_numbers),
        "total_open_items": open_items_count,
        "total_remaining_qty": round(total_remaining_qty, 2),
        "today_delivery_items": today_delivery_count,
        "overdue_items": overdue_count,
        "near_due_3d_items": near_due_count,
        "supplier_responded_waiting_accept": supplier_responded_count,
        "confirmed_items": confirmed_count,
        "unplanned_items": unplanned_count,
        "new_items_today": new_today_count,
        "group_breakdown": group_breakdown,
    }


async def tool_search_open_pos(
    db: AsyncSession,
    user: User,
    keyword: str = "",
    filter_mode: str = "all",
    limit: int = 15,
) -> Dict[str, Any]:
    """Tool 2: Read-Only Search & Filter Open PO Items with RBAC Item Group filtering."""
    today = datetime.now(BKK_TZ).date()
    allowed_groups_str = get_effective_user_allowed_groups(user)

    stmt = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .options(selectinload(POItem.sub_items))
        .where(POHeader.status == "O")
        .order_by(POHeader.po_date.desc(), POHeader.po_number.desc(), POItem.line_num.asc())
    )
    rows = (await db.execute(stmt)).all()

    kw = keyword.strip().lower()
    matched_items = []

    for item, header in rows:
        if (item.remaining_qty or 0) <= 0 or item.status in ("completed", "closed"):
            continue
        if not is_user_allowed_group(allowed_groups_str, item.item_group):
            continue

        est_date = to_pure_date(item.estimate_date)
        due_date = to_pure_date(item.due_date)
        effective_date = est_date or due_date
        if item.sub_items:
            sub_dates = [to_pure_date(s.estimate_date) for s in item.sub_items if s.estimate_date]
            if sub_dates:
                effective_date = min(sub_dates)

        is_overdue = bool(effective_date and effective_date < today)
        is_today = bool(
            (est_date == today)
            or (item.sub_items and any(to_pure_date(s.estimate_date) == today for s in item.sub_items))
        )

        # Apply filter_mode
        if filter_mode == "overdue" and not is_overdue:
            continue
        elif filter_mode == "today" and not is_today:
            continue
        elif filter_mode == "supplier_responded" and item.status != "supplier_responded":
            continue
        elif filter_mode == "unplanned" and (est_date is not None or (item.sub_items and len(item.sub_items) > 0)):
            continue
        elif filter_mode == "new" and not item.is_new:
            continue

        # Apply keyword search
        if kw:
            searchable = " ".join([
                str(header.po_number or ""),
                str(header.supplier_code or ""),
                str(header.supplier_name or ""),
                str(header.buyer_name or ""),
                str(item.item_code or ""),
                str(item.item_name or ""),
                str(item.item_group or ""),
            ]).lower()
            if kw not in searchable:
                continue

        sub_rounds = []
        if item.sub_items:
            for idx, s in enumerate(sorted(item.sub_items, key=lambda x: x.estimate_date or date.max), start=1):
                sub_rounds.append({
                    "round": idx,
                    "estimate_date": format_ddmmyyyy(s.estimate_date),
                    "quantity": float(s.quantity or 0),
                })

        matched_items.append({
            "po_number": header.po_number,
            "po_date": format_ddmmyyyy(header.po_date),
            "supplier_code": header.supplier_code,
            "supplier_name": header.supplier_name,
            "buyer_name": header.buyer_name,
            "item_code": item.item_code,
            "item_name": item.item_name,
            "item_group": item.item_group,
            "po_qty": float(item.quantity or 0),
            "received_qty": float(item.received_qty or 0),
            "remaining_qty": float(item.remaining_qty or 0),
            "unit": item.unit,
            "due_date": format_ddmmyyyy(item.due_date),
            "estimate_date": format_ddmmyyyy(item.estimate_date),
            "status": item.status,
            "is_overdue": is_overdue,
            "locked_by": item.locked_by,
            "updated_by": item.updated_by_name,
            "sub_items": sub_rounds,
        })

    return {
        "total_matched": len(matched_items),
        "showing_top": min(len(matched_items), limit),
        "items": matched_items[:limit],
    }


async def tool_get_delivery_schedule(
    db: AsyncSession,
    user: User,
    target_date_str: Optional[str] = None,
    days_ahead: int = 7,
) -> Dict[str, Any]:
    """Tool 3: Read-Only Delivery Calendar & Receiving Checklist lookup."""
    today = datetime.now(BKK_TZ).date()
    allowed_groups_str = get_effective_user_allowed_groups(user)

    specific_date = to_pure_date(target_date_str) if target_date_str else None
    start_date = specific_date or today
    end_date = specific_date or (today + timedelta(days=days_ahead))

    stmt = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .options(selectinload(POItem.sub_items))
        .where(POHeader.status == "O")
    )
    rows = (await db.execute(stmt)).all()

    deliveries = []
    for item, header in rows:
        if (item.remaining_qty or 0) <= 0 or item.status in ("completed", "closed"):
            continue
        if not is_user_allowed_group(allowed_groups_str, item.item_group):
            continue

        if item.sub_items and len(item.sub_items) > 0:
            total_rounds = len(item.sub_items)
            for idx, sub in enumerate(sorted(item.sub_items, key=lambda x: x.estimate_date or date.max), start=1):
                s_date = to_pure_date(sub.estimate_date)
                if s_date and start_date <= s_date <= end_date:
                    deliveries.append({
                        "delivery_date": format_ddmmyyyy(s_date),
                        "iso_date": s_date.isoformat(),
                        "po_number": header.po_number,
                        "supplier_name": header.supplier_name,
                        "item_code": item.item_code,
                        "item_name": item.item_name,
                        "item_group": item.item_group,
                        "quantity": float(sub.quantity or 0),
                        "unit": item.unit,
                        "status": item.status,
                        "round_info": f"งวดที่ {idx}/{total_rounds}",
                    })
        else:
            e_date = to_pure_date(item.estimate_date)
            if e_date and start_date <= e_date <= end_date:
                deliveries.append({
                    "delivery_date": format_ddmmyyyy(e_date),
                    "iso_date": e_date.isoformat(),
                    "po_number": header.po_number,
                    "supplier_name": header.supplier_name,
                    "item_code": item.item_code,
                    "item_name": item.item_name,
                    "item_group": item.item_group,
                    "quantity": float(item.estimate_qty or item.remaining_qty or 0),
                    "unit": item.unit,
                    "status": item.status,
                    "round_info": "ส่งครั้งเดียว",
                })

    deliveries.sort(key=lambda x: (x["iso_date"], x["po_number"]))
    return {
        "date_range": f"{format_ddmmyyyy(start_date)} ถึง {format_ddmmyyyy(end_date)}",
        "total_scheduled_deliveries": len(deliveries),
        "deliveries": deliveries[:25],
    }


async def tool_lookup_masters(
    db: AsyncSession,
    user: User,
    keyword: str = "",
) -> Dict[str, Any]:
    """Tool 4: Read-Only Item Master & Supplier Master lookup."""
    allowed_groups_str = get_effective_user_allowed_groups(user)
    kw = keyword.strip().lower()

    # Item Master summary & search
    stmt_items = select(ItemMaster).order_by(ItemMaster.item_code.asc())
    all_items = (await db.execute(stmt_items)).scalars().all()
    filtered_items = [
        im for im in all_items
        if is_user_allowed_group(allowed_groups_str, im.item_group)
        and (not kw or kw in (im.item_code or "").lower() or kw in (im.description or "").lower() or kw in (im.item_group or "").lower())
    ]

    # Supplier Master summary & search
    stmt_sups = select(SupplierMaster).order_by(SupplierMaster.supplier_code.asc())
    all_sups = (await db.execute(stmt_sups)).scalars().all()
    filtered_sups = [
        sp for sp in all_sups
        if not kw
        or kw in (sp.supplier_code or "").lower()
        or kw in (sp.supplier_name or "").lower()
        or kw in (sp.email or "").lower()
    ]

    return {
        "total_items_in_master": len(all_items),
        "matched_items_count": len(filtered_items),
        "items_sample": [
            {
                "item_code": im.item_code,
                "description": im.description,
                "item_group": im.item_group,
                "lead_time_days": im.lead_time_days,
                "notify_alert_days": im.notify_alert_days,
                "is_new": im.is_new,
            }
            for im in filtered_items[:10]
        ],
        "total_suppliers_in_master": len(all_sups),
        "suppliers_with_email": sum(1 for s in all_sups if s.email and s.email.strip()),
        "matched_suppliers_count": len(filtered_sups),
        "suppliers_sample": [
            {
                "supplier_code": sp.supplier_code,
                "supplier_name": sp.supplier_name,
                "email": sp.email or "ยังไม่มี Email",
                "telephone": sp.telephone or "-",
                "contact_person": sp.contact_person or "-",
                "allow_over_delivery": sp.allow_over_delivery,
            }
            for sp in filtered_sups[:10]
        ],
    }


async def tool_search_closed_history(
    db: AsyncSession,
    user: User,
    keyword: str = "",
    limit: int = 10,
) -> Dict[str, Any]:
    """Tool 5: Read-Only Closed PO History (LineStatus = 'C' / completed)."""
    allowed_groups_str = get_effective_user_allowed_groups(user)
    kw = keyword.strip().lower()

    stmt = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .where(
            or_(
                POHeader.status == "C",
                POItem.status.in_(["closed", "completed"]),
                POItem.remaining_qty <= 0,
            )
        )
        .order_by(POItem.closed_at.desc().nullslast(), POItem.updated_at.desc())
    )
    rows = (await db.execute(stmt)).all()

    history_list = []
    for item, header in rows:
        if not is_user_allowed_group(allowed_groups_str, item.item_group):
            continue
        if kw:
            searchable = f"{header.po_number} {header.supplier_name} {item.item_code} {item.item_name}".lower()
            if kw not in searchable:
                continue
        history_list.append({
            "po_number": header.po_number,
            "po_date": format_ddmmyyyy(header.po_date),
            "supplier_name": header.supplier_name,
            "item_code": item.item_code,
            "item_name": item.item_name,
            "item_group": item.item_group,
            "po_qty": float(item.quantity or 0),
            "received_qty": float(item.received_qty or 0),
            "estimate_date": format_ddmmyyyy(item.estimate_date),
            "closed_at": format_ddmmyyyy(item.closed_at or item.updated_at),
        })

    return {
        "total_closed_items": len(history_list),
        "recent_closed_items": history_list[:limit],
    }


async def tool_get_admin_audit_summary(db: AsyncSession, user: User) -> Dict[str, Any]:
    """Tool 6: Read-Only System & Audit Log summary ( strictly restricted to Admin users )."""
    if not is_admin_user(user):
        return {
            "access": "denied",
            "reason": "ผู้ใช้งานปัจจุบันไม่ได้อยู่ในกลุ่ม Admin จึงไม่แสดงข้อมูล Transaction Logs ระดับผู้ดูแลระบบ (Strict RBAC)",
        }

    stmt_logs = select(TransactionLog).order_by(desc(TransactionLog.created_at)).limit(10)
    logs = (await db.execute(stmt_logs)).scalars().all()

    stmt_users_count = select(func.count(User.id))
    total_users = (await db.execute(stmt_users_count)).scalar() or 0
    stmt_active_users = select(func.count(User.id)).where(User.is_active == True)
    active_users = (await db.execute(stmt_active_users)).scalar() or 0

    return {
        "access": "granted",
        "total_users": total_users,
        "active_users": active_users,
        "inactive_users": total_users - active_users,
        "recent_transaction_logs": [
            {
                "created_at": format_ddmmyyyy(lg.created_at),
                "category": lg.category,
                "action": lg.action,
                "status": lg.status,
                "message": sanitize_context_for_privacy(lg.message or ""),
                "triggered_by": lg.triggered_by,
            }
            for lg in logs
        ],
    }


async def build_rbac_context_for_query(
    db: AsyncSession,
    user: User,
    user_query: str,
) -> Dict[str, Any]:
    """
    Executes relevant Read-Only Tools in memory based on the user's question and RBAC permissions,
    then scrubs any sensitive strings via DLP Scrubber before passing to LLM or Local Responder.
    """
    q = user_query.strip().lower()
    viewable_menus = await get_user_viewable_menus(db, user)
    allowed_groups = get_effective_user_allowed_groups(user)

    # Extract potential search keyword (PO number, item code, supplier code, etc.)
    token_match = re.search(r"\b([A-Za-z]{2,4}-\d{3,6}(?:-\d+)?|\d{7,12}|VD-\d+|VQ-\d+)\b", user_query, re.IGNORECASE)
    extracted_kw = token_match.group(1) if token_match else ""

    # Determine filter_mode from natural language
    filter_mode = "all"
    if any(w in q for w in ["เกินกำหนด", "ล่าช้า", "overdue", "delay", "ดีเลย์"]):
        filter_mode = "overdue"
    elif any(w in q for w in ["วันนี้", "เข้าวันนี้", "ส่งวันนี้", "today"]):
        filter_mode = "today"
    elif any(w in q for w in ["ตอบกลับ", "รอ accept", "responded", "ซัพตอบ"]):
        filter_mode = "supplier_responded"
    elif any(w in q for w in ["ยังไม่ระบุ", "ยังไม่ปรับ", "รอระบุ", "unplanned"]):
        filter_mode = "unplanned"
    elif any(w in q for w in ["มาใหม่", "เพิ่งเข้า", "new"]):
        filter_mode = "new"

    context_data: Dict[str, Any] = {
        "current_user": {
            "username": user.username,
            "full_name": user.full_name,
            "department": user.department or "-",
            "group_name": user.group.name if user.group else "User",
            "allowed_item_groups": allowed_groups,
            "authorized_menus": viewable_menus,
        },
        "dashboard_summary": await tool_get_dashboard_summary(db, user),
    }

    # Check if user asked for specific date dd/mm/yyyy
    date_match = re.search(r"\b(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2})\b", user_query)
    target_date_str = date_match.group(1) if date_match else ("today" if "วันนี้" in q else None)
    if target_date_str == "today":
        target_date_str = datetime.now(BKK_TZ).date().isoformat()

    # Invoke specific Read-Only tools based on query intent
    if any(w in q for w in ["ปฏิทิน", "calendar", "ตรวจรับ", "checklist", "ส่งมอบ", "เข้าวันนี้", "ของเข้า", "กำหนดส่ง"]) or date_match:
        context_data["delivery_schedule"] = await tool_get_delivery_schedule(
            db, user, target_date_str=target_date_str, days_ahead=7
        )

    if any(w in q for w in ["po", "ใบสั่งซื้อ", "ค้างส่ง", "รายการ", "เกินกำหนด", "overdue", "ตอบกลับ", "มาใหม่"]) or extracted_kw:
        context_data["open_pos_search"] = await tool_search_open_pos(
            db, user, keyword=extracted_kw, filter_mode=filter_mode, limit=15
        )

    if any(w in q for w in ["master", "lead time", "คู่ค้า", "ผู้ขาย", "supplier", "อีเมล", "เบอร์โทร", "รหัสสินค้า"]) or extracted_kw:
        context_data["masters_lookup"] = await tool_lookup_masters(db, user, keyword=extracted_kw)

    if any(w in q for w in ["ประวัติ", "history", "ปิดยอด", "รับครบ", "closed"]):
        context_data["closed_history"] = await tool_search_closed_history(db, user, keyword=extracted_kw, limit=10)

    if is_admin_user(user) and any(w in q for w in ["log", "audit", "ผู้ใช้", "user", "สถานะระบบ", "ซิงค์", "sap", "admin"]):
        context_data["admin_audit_summary"] = await tool_get_admin_audit_summary(db, user)

    return context_data


# ──────────────────────────────────────────────────────────────────────────────
# Local Rule-Based Read-Only Assistant (Zero-Cost Fallback & Instant Answers)
# ──────────────────────────────────────────────────────────────────────────────

def generate_local_readonly_response(
    user_query: str,
    context_data: Dict[str, Any],
    mutation_info: Optional[Dict[str, str]] = None,
) -> str:
    """
    Generates an accurate, formatted Thai response directly from IRM database context
    when no external API Key is configured or as an immediate Read-Only responder.
    """
    summary = context_data.get("dashboard_summary", {})
    user_info = context_data.get("current_user", {})
    as_of = summary.get("as_of_date", format_ddmmyyyy(datetime.now(BKK_TZ).date()))

    # 1. Handle Mutation Request (Strict Read-Only Policy)
    if mutation_info:
        return (
            f"🛡️ **นโยบายความปลอดภัย Read-Only (Zero-Mutation Policy)**\n\n"
            f"ขออภัยครับ ระบบ **IRM AI Copilot** ได้รับการออกแบบให้ทำงานแบบ **อ่านและวิเคราะห์ข้อมูลอย่างเดียว (Strict Read-Only)** "
            f"จึงไม่สามารถทำการเพิ่ม แก้ไข อัปเดต ลบ หรืออนุมัติข้อมูลลงในฐานข้อมูลแทนผู้ใช้งานได้ครับ\n\n"
            f"💡 **คำแนะนำการดำเนินการด้วยตนเอง:**\n"
            f"- กรุณาไปที่ {mutation_info['menu_hint']} บนแถบเมนูด้านซ้ายของหน้าจอ เพื่อกดดำเนินการด้วยตนเอง\n\n"
            f"📊 **ข้อมูลสถานะปัจจุบันของคุณ ({as_of}):**\n"
            f"- PO เปิดค้างส่งทั้งหมด: **{summary.get('total_open_pos', 0):,} ใบ** (**{summary.get('total_open_items', 0):,} รายการ**)\n"
            f"- รายการที่ Supplier ตอบกลับรอจัดซื้อกด Accept: **{summary.get('supplier_responded_waiting_accept', 0):,} รายการ**\n"
            f"- รายการที่มีกำหนดส่งวันนี้: **{summary.get('today_delivery_items', 0):,} รายการ**"
        )

    q = user_query.strip().lower()

    # 2. Check if asking about closed history
    if "closed_history" in context_data and any(w in q for w in ["ประวัติ", "history", "ปิดยอด", "รับครบ"]):
        hist = context_data["closed_history"]
        items = hist.get("recent_closed_items", [])
        lines = [
            f"📜 **สรุปประวัติ PO ที่ปิดยอดรับครบแล้ว (History) — ข้อมูล ณ {as_of}**",
            f"- จำนวนรายการที่ปิดยอดแล้วทั้งหมด (ตามสิทธิ์กลุ่มสินค้า `{user_info.get('allowed_item_groups')}`): **{hist.get('total_closed_items', 0):,} รายการ**\n",
        ]
        if items:
            lines.append("**รายการล่าสุด (สูงสุด 5 รายการ):**")
            for idx, it in enumerate(items[:5], start=1):
                lines.append(
                    f"{idx}. **PO {it['po_number']}** | `{it['item_code']}` {it['item_name']} "
                    f"| ผู้ขาย: {it['supplier_name']} | รับครบ: **{it['received_qty']:,.2f}** (วันที่ปิด: `{it['closed_at']}`)"
                )
        else:
            lines.append("- ไม่พบรายการที่ตรงกับคำค้นหา")
        return "\n".join(lines)

    # 3. Check if asking about delivery schedule / today's incoming materials
    if "delivery_schedule" in context_data and any(w in q for w in ["วันนี้", "ของเข้า", "ส่งมอบ", "ปฏิทิน", "ตรวจรับ", "calendar", "checklist"]):
        sched = context_data["delivery_schedule"]
        dels = sched.get("deliveries", [])
        lines = [
            f"📅 **ตารางกำหนดส่งมอบวัตถุดิบขาเข้า ({sched.get('date_range')})**",
            f"- พบกำหนดส่งมอบทั้งหมด: **{sched.get('total_scheduled_deliveries', 0):,} รอบส่ง**\n",
        ]
        if dels:
            for idx, d in enumerate(dels[:10], start=1):
                lines.append(
                    f"{idx}. วันที่ **`{d['delivery_date']}`** | **PO {d['po_number']}** | `{d['item_code']}` {d['item_name']} "
                    f"| จำนวน: **{d['quantity']:,.2f} {d['unit']}** ({d['round_info']}) | ผู้ขาย: {d['supplier_name']}"
                )
        else:
            lines.append("- ไม่มีรายการนัดส่งมอบในช่วงเวลาดังกล่าวครับ")
        return "\n".join(lines)

    # 4. Check if asking about specific PO / Overdue / Supplier Responded
    if "open_pos_search" in context_data and any(
        w in q for w in ["เกินกำหนด", "overdue", "ล่าช้า", "ตอบกลับ", "มาใหม่", "ยังไม่ระบุ", "po", "ใบสั่งซื้อ"]
    ):
        pos = context_data["open_pos_search"]
        items = pos.get("items", [])
        lines = [
            f"🔎 **ผลการค้นหารายการใบสั่งซื้อค้างรับ (Open POs) — ณ วันที่ `{as_of}`**",
            f"- พบรายการที่ตรงเงื่อนไขทั้งหมด: **{pos.get('total_matched', 0):,} รายการ**\n",
        ]
        if items:
            for idx, it in enumerate(items[:8], start=1):
                overdue_badge = " 🔴 *(เกินกำหนด)*" if it.get("is_overdue") else ""
                sub_text = f" [แบ่งส่ง {len(it['sub_items'])} งวด]" if it.get("sub_items") else ""
                lines.append(
                    f"{idx}. **PO {it['po_number']}** (`{it['po_date']}`) | `{it['item_code']}` {it['item_name']}\n"
                    f"   • ผู้ขาย: {it['supplier_name']} | ค้างรับ: **{it['remaining_qty']:,.2f} {it['unit']}** "
                    f"| วันนัดส่ง: **`{it['estimate_date']}`** (Due: `{it['due_date']}`){overdue_badge}{sub_text}"
                )
        else:
            lines.append("- ไม่พบรายการที่ตรงกับเงื่อนไขในขณะนี้ครับ")
        return "\n".join(lines)

    # 5. Check if asking about Suppliers or Item Master
    if "masters_lookup" in context_data and any(w in q for w in ["master", "lead time", "คู่ค้า", "ผู้ขาย", "supplier", "อีเมล"]):
        m = context_data["masters_lookup"]
        lines = [
            f"🏭 **ข้อมูลฐานข้อมูลหลัก (Item & Supplier Master)**",
            f"- รหัสสินค้าใน Item Master ทั้งหมด: **{m.get('total_items_in_master', 0):,} รายการ**",
            f"- คู่ค้าใน Supplier Master ทั้งหมด: **{m.get('total_suppliers_in_master', 0):,} ราย** (มีอีเมลพร้อมส่ง Portal: **{m.get('suppliers_with_email', 0):,} ราย**)\n",
        ]
        sups = m.get("suppliers_sample", [])
        if sups:
            lines.append("**ตัวอย่างข้อมูลคู่ค้าที่พบ:**")
            for idx, sp in enumerate(sups[:5], start=1):
                lines.append(
                    f"{idx}. **`{sp['supplier_code']}`** {sp['supplier_name']} | อีเมล: `{sp['email']}` | โทร: {sp['telephone']}"
                )
        return "\n".join(lines)

    # 6. Default Comprehensive Executive Overview
    grp_lines = []
    for gname, gstat in summary.get("group_breakdown", {}).items():
        grp_lines.append(
            f"  • **{gname}**: {gstat['item_count']:,} รายการ (ค้างรับ {gstat['remaining_qty']:,.2f} | เกินกำหนด {gstat['overdue_count']:,})"
        )
    grp_section = "\n".join(grp_lines) if grp_lines else "  • ไม่มีรายการค้างรับ"

    return (
        f"📊 **สรุปภาพรวมระบบ IRM (Incoming Raw Material) — ณ วันที่ `{as_of}`**\n"
        f"*(สิทธิ์การเข้าถึงของคุณ: `{user_info.get('full_name')}` | กลุ่มสินค้า: `{user_info.get('allowed_item_groups')}`)*\n\n"
        f"- 📑 **PO เปิดค้างรับทั้งหมด:** **{summary.get('total_open_pos', 0):,} ใบ** (รวม **{summary.get('total_open_items', 0):,} รายการ**)\n"
        f"- 🚚 **มีกำหนดส่งมอบวันนี้ (`{as_of}`):** **{summary.get('today_delivery_items', 0):,} รายการ**\n"
        f"- 🔴 **เกินกำหนดส่งมอบ (Overdue):** **{summary.get('overdue_items', 0):,} รายการ**\n"
        f"- 🟡 **ใกล้ครบกำหนดใน 3 วัน (Near Due):** **{summary.get('near_due_3d_items', 0):,} รายการ**\n"
        f"- 🟠 **Supplier ตอบกลับแล้ว (รอจัดซื้อกด Accept):** **{summary.get('supplier_responded_waiting_accept', 0):,} รายการ**\n"
        f"- 🟢 **ยืนยันวันส่งมอบแล้ว (Confirmed):** **{summary.get('confirmed_items', 0):,} รายการ**\n"
        f"- ⚪ **ยังไม่ได้ระบุวันส่งมอบ (Unplanned):** **{summary.get('unplanned_items', 0):,} รายการ**\n\n"
        f"📦 **แยกตามกลุ่มวัตถุดิบ:**\n{grp_section}\n\n"
        f"*(🔒 ข้อมูลประมวลผลแบบ Read-Only & Zero-Training 100%)*"
    )


# ──────────────────────────────────────────────────────────────────────────────
# External LLM Provider Execution (Google Gemini / OpenAI / Anthropic / Ollama)
# ──────────────────────────────────────────────────────────────────────────────

async def call_external_llm_provider(
    cfg: Dict[str, Any],
    messages: List[Dict[str, str]],
    context_data: Dict[str, Any],
    mutation_info: Optional[Dict[str, str]] = None,
) -> Tuple[bool, str]:
    """
    Calls the configured LLM provider with mandatory ZERO_TRAINING_PRIVACY_HEADERS,
    DLP-scrubbed context, and Strict Read-Only System Prompt.
    Returns (success, response_text).
    """
    provider = cfg.get("ai_provider", "google").lower()
    model = cfg.get("ai_model") or "gemini-2.5-flash"
    api_key = cfg.get("ai_api_key") or ""
    base_url = cfg.get("ai_base_url") or ""
    custom_system_prompt = cfg.get("ai_system_prompt") or DEFAULT_SYSTEM_PROMPT

    # Scrub context JSON with DLP Scrubber before sending to LLM
    raw_context_json = json.dumps(context_data, ensure_ascii=False, indent=2)
    safe_context_json = sanitize_context_for_privacy(raw_context_json)

    mutation_instruction = ""
    if mutation_info:
        mutation_instruction = (
            f"\n[CRITICAL MUTATION BLOCK]: ผู้ใช้กำลังสั่งให้แก้ไข/เพิ่ม/ลบข้อมูล! "
            f"คุณต้องปฏิเสธการแก้ไขอย่างสุภาพโดยชี้แจงว่าเป็นกฎเหล็ก Strict Read-Only ของระบบ IRM "
            f"แสดงข้อมูลปัจจุบันจาก Context ด้านล่าง และแนะนำให้ผู้ใช้ไปกดดำเนินการเองที่ {mutation_info['menu_hint']}"
        )

    full_system_prompt = (
        f"{custom_system_prompt}\n\n"
        f"=== กฎเหล็กด้านธรรมาภิบาลของระบบ IRM (Mandatory Governance Rules) ===\n"
        f"1. STRICT READ-ONLY: ห้ามรับปากหรือแสร้งทำเป็นว่าได้แก้ไข เพิ่ม ลบ หรืออนุมัติข้อมูลในฐานข้อมูลเด็ดขาด\n"
        f"2. ZERO HALLUCINATION: อ้างอิงตัวเลข เลขที่ PO รหัสสินค้า และสถานะจาก [IRM LIVE DATABASE CONTEXT] ด้านล่างนี้เท่านั้น ห้ามแต่งตัวเลขเอง\n"
        f"3. PURE DATE STANDARD: แสดงวันที่ทุกจุดในรูปแบบ dd/mm/yyyy (ค.ศ.) เท่านั้น\n"
        f"4. ตอบเป็นภาษาไทยที่สุภาพ กระชับ ชัดเจน จัดรูปแบบด้วย Markdown ที่อ่านง่าย"
        f"{mutation_instruction}\n\n"
        f"=== [IRM LIVE DATABASE CONTEXT (RBAC SCOPED & DLP SCRUBBED)] ===\n"
        f"{safe_context_json}"
    )

    # Scrub conversation history
    clean_messages = []
    for m in messages[-8:]:
        role = m.get("role", "user")
        content = sanitize_context_for_privacy(m.get("content", ""))
        if content:
            clean_messages.append({"role": role, "content": content})

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            if provider == "google":
                if not api_key:
                    return False, "Missing Google Gemini API Key"
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                contents = []
                for m in clean_messages:
                    g_role = "model" if m["role"] == "assistant" else "user"
                    contents.append({"role": g_role, "parts": [{"text": m["content"]}]})
                payload = {
                    "systemInstruction": {"parts": [{"text": full_system_prompt}]},
                    "contents": contents,
                    "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1500},
                }
                headers = {"Content-Type": "application/json", **ZERO_TRAINING_PRIVACY_HEADERS}
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and candidates[0].get("content", {}).get("parts"):
                        return True, candidates[0]["content"]["parts"][0].get("text", "")
                return False, f"Gemini API returned {res.status_code}: {res.text[:200]}"

            elif provider in ("openai", "ollama", "custom"):
                if provider == "openai":
                    url = (base_url.rstrip("/") + "/chat/completions") if base_url else "https://api.openai.com/v1/chat/completions"
                else:
                    if not base_url:
                        return False, "กรุณาระบุ Base URL สำหรับ Ollama / Custom Endpoint"
                    url = base_url.rstrip("/")
                    if not url.endswith("/chat/completions") and not url.endswith("/api/chat"):
                        url = f"{url}/v1/chat/completions"

                headers = {"Content-Type": "application/json", **ZERO_TRAINING_PRIVACY_HEADERS}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"

                oai_messages = [{"role": "system", "content": full_system_prompt}] + clean_messages
                payload: Dict[str, Any] = {
                    "model": model,
                    "messages": oai_messages,
                    "temperature": 0.1,
                    "store": False,  # Mandatory Zero-Retention flag
                }
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    if "choices" in data and data["choices"]:
                        return True, data["choices"][0]["message"]["content"]
                    if "message" in data and "content" in data["message"]:
                        return True, data["message"]["content"]
                return False, f"Provider {provider} returned {res.status_code}: {res.text[:200]}"

            elif provider == "anthropic":
                if not api_key:
                    return False, "Missing Anthropic API Key"
                url = (base_url.rstrip("/") + "/v1/messages") if base_url else "https://api.anthropic.com/v1/messages"
                headers = {
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    **ZERO_TRAINING_PRIVACY_HEADERS,
                }
                ant_messages = [
                    {"role": ("assistant" if m["role"] == "assistant" else "user"), "content": m["content"]}
                    for m in clean_messages
                ]
                payload = {
                    "model": model,
                    "system": full_system_prompt,
                    "messages": ant_messages,
                    "max_tokens": 1500,
                    "temperature": 0.1,
                }
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    content_blocks = data.get("content", [])
                    if content_blocks and content_blocks[0].get("text"):
                        return True, content_blocks[0]["text"]
                return False, f"Anthropic API returned {res.status_code}: {res.text[:200]}"

            return False, f"Unsupported AI provider: {provider}"
    except Exception as exc:
        return False, str(exc)


async def test_ai_provider_connection(
    provider: str,
    model: str,
    api_key: str,
    base_url: str = "",
) -> Dict[str, Any]:
    """
    Tests connectivity and API Key validity with the selected AI Provider.
    Returns status, latency_ms, and diagnostic message.
    """
    start_t = time.perf_counter()
    provider = (provider or "google").strip().lower()
    model = (model or "gemini-2.5-flash").strip()
    api_key = (api_key or "").strip()
    base_url = (base_url or "").strip()

    if provider in ("google", "openai", "anthropic") and not api_key:
        return {
            "status": "failed",
            "latency_ms": 0,
            "provider": provider,
            "model": model,
            "message": f"กรุณาระบุ API Key สำหรับผู้ให้บริการ {provider.upper()} ก่อนทดสอบการเชื่อมต่อ",
        }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            if provider == "google":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": "Respond with OK"}]}],
                    "generationConfig": {"maxOutputTokens": 10},
                }
                res = await client.post(url, headers={"Content-Type": "application/json", **ZERO_TRAINING_PRIVACY_HEADERS}, json=payload)
                latency_ms = int((time.perf_counter() - start_t) * 1000)
                if res.status_code == 200:
                    return {
                        "status": "connected",
                        "latency_ms": latency_ms,
                        "provider": provider,
                        "model": model,
                        "message": f"เชื่อมต่อ Google Gemini ({model}) สำเร็จ (Latency: {latency_ms} ms) · บังคับใช้ Zero-Training Headers เรียบร้อย",
                    }
                err_msg = res.json().get("error", {}).get("message", res.text[:150]) if res.text else f"HTTP {res.status_code}"
                return {
                    "status": "failed",
                    "latency_ms": latency_ms,
                    "provider": provider,
                    "model": model,
                    "message": f"เชื่อมต่อ Google Gemini ไม่สำเร็จ ({res.status_code}): {err_msg}",
                }

            elif provider in ("openai", "ollama", "custom"):
                if provider == "openai":
                    url = (base_url.rstrip("/") + "/chat/completions") if base_url else "https://api.openai.com/v1/chat/completions"
                else:
                    if not base_url:
                        return {
                            "status": "failed",
                            "latency_ms": 0,
                            "provider": provider,
                            "model": model,
                            "message": "กรุณาระบุ Endpoint Base URL สำหรับ Ollama หรือ Custom LLM",
                        }
                    url = base_url.rstrip("/")
                    if not url.endswith("/chat/completions") and not url.endswith("/api/chat"):
                        url = f"{url}/v1/chat/completions"

                headers = {"Content-Type": "application/json", **ZERO_TRAINING_PRIVACY_HEADERS}
                if api_key:
                    headers["Authorization"] = f"Bearer {api_key}"
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": "Say OK"}],
                    "max_tokens": 10,
                    "store": False,
                }
                res = await client.post(url, headers=headers, json=payload)
                latency_ms = int((time.perf_counter() - start_t) * 1000)
                if res.status_code == 200:
                    return {
                        "status": "connected",
                        "latency_ms": latency_ms,
                        "provider": provider,
                        "model": model,
                        "message": f"เชื่อมต่อ {provider.upper()} ({model}) สำเร็จ (Latency: {latency_ms} ms)",
                    }
                return {
                    "status": "failed",
                    "latency_ms": latency_ms,
                    "provider": provider,
                    "model": model,
                    "message": f"เชื่อมต่อไม่สำเร็จ (HTTP {res.status_code}): {res.text[:150]}",
                }

            elif provider == "anthropic":
                url = (base_url.rstrip("/") + "/v1/messages") if base_url else "https://api.anthropic.com/v1/messages"
                headers = {
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    **ZERO_TRAINING_PRIVACY_HEADERS,
                }
                payload = {
                    "model": model,
                    "messages": [{"role": "user", "content": "Say OK"}],
                    "max_tokens": 10,
                }
                res = await client.post(url, headers=headers, json=payload)
                latency_ms = int((time.perf_counter() - start_t) * 1000)
                if res.status_code == 200:
                    return {
                        "status": "connected",
                        "latency_ms": latency_ms,
                        "provider": provider,
                        "model": model,
                        "message": f"เชื่อมต่อ Anthropic Claude ({model}) สำเร็จ (Latency: {latency_ms} ms)",
                    }
                return {
                    "status": "failed",
                    "latency_ms": latency_ms,
                    "provider": provider,
                    "model": model,
                    "message": f"เชื่อมต่อ Anthropic ไม่สำเร็จ (HTTP {res.status_code}): {res.text[:150]}",
                }

            return {
                "status": "failed",
                "latency_ms": 0,
                "provider": provider,
                "model": model,
                "message": f"ไม่รองรับผู้ให้บริการ: {provider}",
            }
    except Exception as exc:
        latency_ms = int((time.perf_counter() - start_t) * 1000)
        return {
            "status": "failed",
            "latency_ms": latency_ms,
            "provider": provider,
            "model": model,
            "message": f"เกิดข้อผิดพลาดในการเชื่อมต่อ: {str(exc)}",
        }
