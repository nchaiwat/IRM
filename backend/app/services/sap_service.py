"""
SAP B1 Sync Service — Supports Tri-Mode:
1. Outbound Push Agent Mode (On-Premise Python Agent pushes JSON payload to VPS IRM)
2. REST API Mode (httpx call to SAP API Endpoint / Service Layer)
3. Direct SQL Query Mode (MS SQL Server wa-dbs2.wa.net executing SQL Query Report 8)
"""

import json
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_setting import SystemSetting
from app.models.master import ItemMaster, SupplierMaster
from app.models.po import POHeader, POItem, POItemAuditLog

logger = logging.getLogger(__name__)


def build_sap_query_sql(item_groups_setting: str | None = None) -> str:
    """Builds dynamic SQL query with configured Item Groups filter from system settings."""
    group_ids = [113, 115]  # default groups
    if item_groups_setting and str(item_groups_setting).strip():
        try:
            raw = str(item_groups_setting).strip()
            if raw.startswith("["):
                parsed = json.loads(raw)
                if isinstance(parsed, list) and len(parsed) > 0:
                    group_ids = [int(x) for x in parsed if str(x).strip().isdigit()]
            else:
                group_ids = [int(x.strip()) for x in raw.split(",") if x.strip().isdigit()]
        except Exception as e:
            logger.warning(f"Could not parse sap_item_groups setting '{item_groups_setting}': {e}. Using default [113, 115].")
            group_ids = [113, 115]

    if not group_ids:
        group_ids = [113, 115]

    groups_in_clause = ", ".join(str(g) for g in group_ids)
    logger.info(f"🔍 [SAP SQL Query Builder] Filtering T5.ItmsGrpCod IN ({groups_in_clause})")

    return f"""SELECT 
    T1.DocNum AS po_number,
    T0.LineNum AS line_num,
    T1.DocDate AS po_date,
    T1.CardCode AS supplier_code,
    T1.CardName AS supplier_name,
    T3.Phone1 AS supplier_phone,
    T3.E_mail AS supplier_email,
    T3.CntctPrsn AS supplier_contact,
    T0.ItemCode AS item_code,
    T0.Dscription AS item_name,
    CAST(T0.Quantity AS FLOAT) AS quantity,
    T0.unitMsr AS unit,
    T0.ShipDate AS due_date,
    CAST(ISNULL(
        CASE
            WHEN (
                SELECT SUM(PDN1.Quantity)
                FROM PDN1 
                LEFT OUTER JOIN OPDN ON OPDN.DocEntry = PDN1.DocEntry
                WHERE OPDN.CANCELED <> 'Y'
                  AND PDN1.ItemCode = T0.ItemCode
                  AND PDN1.BaseRef = T1.DocNum
                  AND PDN1.BaseLine = T0.LineNum
                  AND PDN1.BaseEntry = T1.DocEntry
            ) IS NULL
            THEN (
                SELECT SUM(PDN1.Quantity)
                FROM PDN1 
                LEFT OUTER JOIN OPDN ON OPDN.DocEntry = PDN1.DocEntry
                WHERE OPDN.CANCELED <> 'Y'
                  AND PDN1.ItemCode = T0.ItemCode
                  AND PDN1.BaseRef = T1.DocNum
                  AND PDN1.BaseEntry = T1.DocEntry
            )
            ELSE (
                SELECT SUM(PDN1.Quantity)
                FROM PDN1 
                LEFT OUTER JOIN OPDN ON OPDN.DocEntry = PDN1.DocEntry
                WHERE OPDN.CANCELED <> 'Y'
                  AND PDN1.ItemCode = T0.ItemCode
                  AND PDN1.BaseRef = T1.DocNum
                  AND PDN1.BaseLine = T0.LineNum
                  AND PDN1.BaseEntry = T1.DocEntry
            )
        END, 0) AS FLOAT) AS received_qty,
    CAST(ISNULL(
        CASE
            WHEN (
                SELECT SUM(PDN1.Quantity)
                FROM PDN1 
                LEFT OUTER JOIN OPDN ON OPDN.DocEntry = PDN1.DocEntry
                WHERE OPDN.CANCELED <> 'Y'
                  AND PDN1.ItemCode = T0.ItemCode
                  AND PDN1.BaseRef = T1.DocNum
                  AND PDN1.BaseLine = T0.LineNum
                  AND PDN1.BaseEntry = T1.DocEntry
            ) IS NULL
            THEN T0.Quantity - (
                SELECT ISNULL(SUM(PDN1.Quantity), 0)
                FROM PDN1 
                LEFT OUTER JOIN OPDN ON OPDN.DocEntry = PDN1.DocEntry
                WHERE OPDN.CANCELED <> 'Y'
                  AND PDN1.ItemCode = T0.ItemCode
                  AND PDN1.BaseRef = T1.DocNum
                  AND PDN1.BaseEntry = T1.DocEntry
            )
            ELSE T0.Quantity - (
                SELECT ISNULL(SUM(PDN1.Quantity), 0)
                FROM PDN1 
                LEFT OUTER JOIN OPDN ON OPDN.DocEntry = PDN1.DocEntry
                WHERE OPDN.CANCELED <> 'Y'
                  AND PDN1.ItemCode = T0.ItemCode
                  AND PDN1.BaseRef = T1.DocNum
                  AND PDN1.BaseLine = T0.LineNum
                  AND PDN1.BaseEntry = T1.DocEntry
            )
        END, T0.Quantity) AS FLOAT) AS remaining_qty,
    T5.ItmsGrpNam AS item_group,
    T4.SlpName AS buyer_name
FROM POR1 T0
INNER JOIN OPOR T1 ON T0.DocEntry = T1.DocEntry
LEFT JOIN OCRD T3 ON T1.CardCode = T3.CardCode
LEFT JOIN OSLP T4 ON T1.SlpCode = T4.SlpCode
LEFT JOIN OITM T2 ON T0.ItemCode = T2.ItemCode
LEFT JOIN OITB T5 ON T2.ItmsGrpCod = T5.ItmsGrpCod
WHERE T0.LineStatus = 'O'
  AND T1.CANCELED <> 'Y'
  AND T5.ItmsGrpCod IN ({groups_in_clause})
ORDER BY T1.DocNum DESC, T0.LineNum ASC;"""


def parse_raw_sap_rows(raw_records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sanitize and format raw SAP rows into typed dictionary objects."""
    parsed_records = []
    for r in raw_records:
        po_date_val = r.get("po_date")
        if isinstance(po_date_val, str):
            try:
                po_date_val = datetime.fromisoformat(po_date_val.replace("Z", "+00:00"))
            except ValueError:
                po_date_val = datetime.now(timezone.utc)
        elif not isinstance(po_date_val, datetime):
            po_date_val = datetime.now(timezone.utc)

        due_date_val = r.get("due_date")
        if isinstance(due_date_val, str):
            try:
                due_date_val = datetime.fromisoformat(due_date_val.replace("Z", "+00:00"))
            except ValueError:
                due_date_val = po_date_val + timedelta(days=30)
        elif not isinstance(due_date_val, datetime):
            due_date_val = po_date_val + timedelta(days=30)

        s_phone = str(r.get("supplier_phone") or "").strip() or None
        
        raw_email = str(r.get("supplier_email") or "").strip()
        if not raw_email or raw_email in ["-", "--", "none", "null", "N/A", "n/a"] or "@" not in raw_email:
            s_email = None
        else:
            s_email = raw_email

        s_contact = str(r.get("supplier_contact") or "").strip() or None

        parsed_records.append(
            {
                "po_number": str(r.get("po_number") or "").strip(),
                "line_num": int(r.get("line_num") if r.get("line_num") is not None else 0),
                "po_date": po_date_val,
                "supplier_code": str(r.get("supplier_code") or "").strip(),
                "supplier_name": str(r.get("supplier_name") or "").strip(),
                "supplier_phone": s_phone,
                "supplier_email": s_email,
                "supplier_contact": s_contact,
                "buyer_name": str(r.get("buyer_name") or "").strip(),
                "item_code": str(r.get("item_code") or "").strip(),
                "item_name": str(r.get("item_name") or "").strip(),
                "quantity": float(r.get("quantity") or 0.0),
                "unit": str(r.get("unit") or "").strip(),
                "received_qty": float(r.get("received_qty") or 0.0),
                "remaining_qty": float(r.get("remaining_qty") or 0.0),
                "item_group": str(r.get("item_group") or "113").strip(),
                "due_date": due_date_val,
            }
        )

    return parsed_records


async def fetch_real_sap_data(db: AsyncSession) -> List[Dict[str, Any]]:
    """
    Fetch SAP Open PO data using either REST API Endpoint or Direct MS SQL Connection based on 'sap_sync_mode'.
    """
    settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.category == "sap"))).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}

    sync_mode = (s_map.get("sap_sync_mode") or "sql").lower().strip()
    raw_records = []

    # MODE 1: REST API Endpoint (SAP Service Layer / API Gateway)
    if sync_mode == "api":
        api_url = s_map.get("sap_api_url") or ""
        api_token = s_map.get("sap_api_token") or ""

        if not api_url:
            raise RuntimeError("ตั้งค่า SAP Sync Mode เป็น API แต่ยังไม่ได้ระบุ URL (sap_api_url)")

        headers = {"Accept": "application/json"}
        if api_token:
            headers["Authorization"] = f"Bearer {api_token}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(api_url, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"SAP API Error (HTTP {resp.status_code}): {resp.text[:200]}")

            data = resp.json()
            raw_records = data if isinstance(data, list) else data.get("value", data.get("data", []))

    # MODE 2: Direct SQL Query to MS SQL Server
    else:
        host = s_map.get("sap_host") or "wa-dbs2.wa.net"
        port_str = s_map.get("sap_port") or "1433"
        database = s_map.get("sap_database") or "SBO_COMPANY_DB"
        user = s_map.get("sap_user") or "irm_readonly"
        password = s_map.get("sap_password") or ""

        try:
            import pyodbc
            conn_str = (
                f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                f"SERVER={host},{port_str};"
                f"DATABASE={database};"
                f"UID={user};"
                f"PWD={password};"
                f"Timeout=15;"
            )
            try:
                conn = pyodbc.connect(conn_str)
                cursor = conn.cursor()
                sql_query = build_sap_query_sql(s_map.get("sap_item_groups"))
                cursor.execute(sql_query)
                columns = [column[0] for column in cursor.description]
                for row in cursor.fetchall():
                    raw_records.append(dict(zip(columns, row)))
                cursor.close()
                conn.close()
            except Exception as e:
                logger.warning(f"pyodbc connect failed: {e}. Trying pymssql...")
                raise e

        except Exception:
            try:
                import pymssql
                port = int(port_str) if port_str.isdigit() else 1433
                conn = pymssql.connect(
                    server=host,
                    port=port,
                    user=user,
                    password=password,
                    database=database,
                    timeout=15,
                    as_dict=True,
                )
                cursor = conn.cursor()
                sql_query = build_sap_query_sql(s_map.get("sap_item_groups"))
                cursor.execute(sql_query)
                raw_records = cursor.fetchall()
                cursor.close()
                conn.close()
            except Exception as mssql_err:
                logger.error(f"❌ Direct SAP SQL Query connection failed: {mssql_err}")
                raise RuntimeError(
                    f"ไม่สามารถเชื่อมต่อ SAP MS SQL Server ({host}:{port_str}/{database}) ได้: {str(mssql_err)}"
                )

    return parse_raw_sap_rows(raw_records)


async def _process_and_save_sap_records(
    db: AsyncSession, sap_records: List[Dict[str, Any]], triggered_by: str
) -> dict:
    """Core logic to upsert POs, auto-populate Masters, detect closed POs, and purge expired logs."""
    from app.services.telegram_service import send_telegram_sap_sync
    now_dt = datetime.now(timezone.utc)

    new_items_count = 0
    new_suppliers_count = 0
    active_sap_keys = set()

    for rec in sap_records:
        po_num = rec.get("po_number")
        item_code = rec.get("item_code")
        line_num = int(rec.get("line_num") if rec.get("line_num") is not None else 0)
        if not po_num or not item_code:
            continue

        active_sap_keys.add((str(po_num), line_num))

        # 1. Automatic Insert/Update into Supplier Master
        stmt_sup = select(SupplierMaster).where(SupplierMaster.supplier_code == rec["supplier_code"])
        sup = (await db.execute(stmt_sup)).scalar_one_or_none()
        if not sup:
            sup = SupplierMaster(
                supplier_code=rec["supplier_code"],
                supplier_name=rec["supplier_name"],
                telephone=rec.get("supplier_phone"),
                email=rec.get("supplier_email"),
                contact_person=rec.get("supplier_contact"),
                is_new=True,
            )
            db.add(sup)
            new_suppliers_count += 1
        else:
            if rec["supplier_name"] and sup.supplier_name != rec["supplier_name"]:
                sup.supplier_name = rec["supplier_name"]
            if rec.get("supplier_phone") and not sup.telephone:
                sup.telephone = rec["supplier_phone"]
            if rec.get("supplier_email") and not sup.email:
                sup.email = rec["supplier_email"]
            if rec.get("supplier_contact") and not sup.contact_person:
                sup.contact_person = rec["supplier_contact"]

        # 2. Automatic Insert/Update into Item Master (Preserve existing groups and lead times)
        stmt_item = select(ItemMaster).where(ItemMaster.item_code == rec["item_code"])
        itm_master = (await db.execute(stmt_item)).scalar_one_or_none()
        if not itm_master:
            itm_master = ItemMaster(
                item_code=rec["item_code"],
                description=rec["item_name"],
                lead_time_days=60,
                notify_alert_days=3,
                item_group=rec.get("item_group", "HW"),
                is_new=True,
            )
            db.add(itm_master)
            new_items_count += 1
        else:
            if rec["item_name"] and not itm_master.description:
                itm_master.description = rec["item_name"]
            if not itm_master.item_group or itm_master.item_group in ["113", "115"]:
                if rec.get("item_group") and rec["item_group"] not in ["113", "115"]:
                    itm_master.item_group = rec["item_group"]

        # 3. Upsert PO Header
        stmt_po = select(POHeader).where(POHeader.po_number == rec["po_number"])
        po_header = (await db.execute(stmt_po)).scalar_one_or_none()
        if not po_header:
            po_header = POHeader(
                po_number=rec["po_number"],
                po_date=rec["po_date"],
                supplier_code=rec["supplier_code"],
                supplier_name=rec["supplier_name"],
                buyer_name=rec["buyer_name"],
                status="O",
            )
            db.add(po_header)
            await db.flush()
        else:
            po_header.status = "O"

        # 4. Upsert PO Item
        line_num_val = int(rec.get("line_num") if rec.get("line_num") is not None else 0)
        lead_days = itm_master.lead_time_days if (itm_master and itm_master.lead_time_days) else 60
        initial_est_date = rec["po_date"] + timedelta(days=lead_days)

        stmt_po_item = select(POItem).where(
            POItem.po_header_id == po_header.id, POItem.line_num == line_num_val
        )
        po_item = (await db.execute(stmt_po_item)).scalar_one_or_none()
        if not po_item:
            po_item = POItem(
                po_header_id=po_header.id,
                line_num=line_num_val,
                item_code=rec["item_code"],
                item_name=rec["item_name"],
                quantity=rec["quantity"],
                unit=rec["unit"],
                received_qty=rec["received_qty"],
                remaining_qty=rec["remaining_qty"],
                due_date=rec.get("due_date", rec["po_date"] + timedelta(days=30)),
                item_group=rec.get("item_group", "113"),
                estimate_date=initial_est_date,
                estimate_qty=rec["remaining_qty"],
                status="pending",
                is_new=True,
                closed_at=None,
                updated_by_name=None,
                updated_by_type=None,
            )
            db.add(po_item)
        else:
            po_item.quantity = rec["quantity"]
            po_item.received_qty = rec["received_qty"]
            po_item.remaining_qty = rec["remaining_qty"]
            po_item.due_date = rec.get("due_date", rec["po_date"] + timedelta(days=30))
            po_item.item_group = rec.get("item_group", "113")
            if po_item.status == "closed":
                po_item.status = "pending"
                po_item.closed_at = None

    await db.flush()

    # 5. DIFFERENTIAL CLOSED DETECTION
    stmt_open_irm = (
        select(POItem, POHeader)
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .where(POItem.status != "closed")
    )
    irm_open_rows = (await db.execute(stmt_open_irm)).all()
    closed_count = 0

    for item, header in irm_open_rows:
        item_line = int(item.line_num if item.line_num is not None else 0)
        if (str(header.po_number), item_line) not in active_sap_keys:
            item.status = "closed"
            item.closed_at = now_dt
            item.is_new = False
            closed_count += 1

            est_qty = item.estimate_qty or 0.0
            act_qty = item.received_qty or item.quantity
            variance = act_qty - est_qty
            var_str = f"{variance:+,.0f}" if est_qty > 0 else "N/A"

            audit_log = POItemAuditLog(
                po_item_id=item.id,
                action="sap_close",
                changes_detail=f"ปิดรายการจาก SAP (รับจริง: {act_qty:,.0f} {item.unit}, แพลนเดิม: {est_qty:,.0f} {item.unit}, ผลต่าง: {var_str})",
                changed_by_name="SAP B1 Sync",
                changed_by_type="system",
            )
            db.add(audit_log)

            stmt_siblings = select(POItem).where(POItem.po_header_id == header.id)
            all_siblings = (await db.execute(stmt_siblings)).scalars().all()
            if all(s.status == "closed" for s in all_siblings):
                header.status = "C"

    # 6. AUTO-PURGE RETENTION (Default 7 days)
    stmt_retention = select(SystemSetting).where(SystemSetting.key == "history_retention_days")
    ret_setting = (await db.execute(stmt_retention)).scalar_one_or_none()
    try:
        retention_days = int(ret_setting.value) if ret_setting and ret_setting.value else 7
    except ValueError:
        retention_days = 7

    purge_threshold = now_dt - timedelta(days=retention_days)
    stmt_purge_items = select(POItem).where(POItem.status == "closed", POItem.closed_at < purge_threshold)
    expired_items = (await db.execute(stmt_purge_items)).scalars().all()
    purged_count = len(expired_items)

    for exp_item in expired_items:
        await db.delete(exp_item)

    await db.commit()

    logger.info(f"✅ [SAP Sync] Synced {len(sap_records)} records, Closed {closed_count} items, Purged {purged_count} expired records.")

    # Record Transaction Log
    try:
        from app.services.log_service import record_transaction_log
        await record_transaction_log(
            category="sap_sync",
            action="sync_open_pos",
            status="success",
            message=f"Sync ข้อมูลจาก SAP สำเร็จ ({len(sap_records)} รายการ, ปิดยอดใน SAP {closed_count} รายการ, ล้างประวัติ {purged_count} รายการ)",
            details={
                "total_records_pulled": len(sap_records),
                "closed_records_detected": closed_count,
                "purged_records": purged_count,
                "retention_days": retention_days,
            },
            records_count=len(sap_records),
            duration_ms=0,
            triggered_by=triggered_by,
            db=db,
        )
        await db.commit()
    except Exception as log_err:
        logger.error(f"Failed to record SAP sync log: {log_err}")

    # Dispatch Telegram Alert
    try:
        unique_pos = len(set(r.get("po_number") for r in sap_records if r.get("po_number")))
        await send_telegram_sap_sync(
            db,
            po_count=unique_pos,
            item_count=len(sap_records),
            closed_count=closed_count,
            success=True,
        )
    except Exception as tg_err:
        logger.warning(f"Telegram dispatch warning in SAP Sync: {tg_err}")

    return {
        "status": "success",
        "synced_at": now_dt.strftime("%d/%m/%Y %H:%M:%S"),
        "triggered_by": triggered_by,
        "message": f"Sync ข้อมูลจาก SAP สำเร็จ ({len(sap_records)} รายการ, ปิดยอดใน SAP {closed_count} รายการ, ล้างประวัติเกิน {retention_days} วัน {purged_count} รายการ)",
        "total_records": len(sap_records),
        "closed_count": closed_count,
        "purged_count": purged_count,
    }


async def sync_sap_open_pos(db: AsyncSession, triggered_by: str = "System Scheduler") -> dict:
    """Sync Open POs from SAP B1 via Local Direct SQL or REST API."""
    sap_records = await fetch_real_sap_data(db)
    return await _process_and_save_sap_records(db, sap_records, triggered_by)


async def ingest_pushed_sap_records(
    db: AsyncSession, raw_records: List[Dict[str, Any]], triggered_by: str = "On-Premise Push Agent"
) -> dict:
    """Ingest Open PO records pushed from On-Premise Python Agent via HTTPS API."""
    sap_records = parse_raw_sap_rows(raw_records)
    return await _process_and_save_sap_records(db, sap_records, triggered_by)


async def generate_onprem_sync_script(
    db: AsyncSession, app_base_url: str = "", increment_version: bool = False, downloaded_by: str = "Admin"
) -> tuple[str, str, int]:
    """
    Dynamically generates the complete, standalone Python agent script (irm_agent_sync_vX.py)
    embedded with the configured SQL Server settings, target VPS Ingest URL, Secret Token,
    and 7 item groups SQL query.
    Returns (script_content, filename, version_num).
    """
    stmt_settings = select(SystemSetting).where(SystemSetting.category.in_(["sap", "general"]))
    settings_rows = (await db.execute(stmt_settings)).scalars().all()
    s_map = {s.key: s.value for s in settings_rows}

    # Fetch & optionally increment version
    ver_setting = next((s for s in settings_rows if s.key == "sap_agent_version"), None)
    try:
        current_ver = int(ver_setting.value) if ver_setting and ver_setting.value else 1
    except ValueError:
        current_ver = 1

    if increment_version:
        version_num = current_ver + 1
        if ver_setting:
            ver_setting.value = str(version_num)
        else:
            db.add(
                SystemSetting(
                    key="sap_agent_version",
                    value=str(version_num),
                    description="Current Version Number of On-Premise Agent Script",
                    category="sap",
                    data_type="integer",
                )
            )
        await db.commit()

        # Record Transaction Log
        try:
            from app.services.log_service import record_transaction_log
            await record_transaction_log(
                category="sap_sync",
                action="download_agent_script",
                status="success",
                message=f"ดาวน์โหลดไฟล์ On-Premise Agent Script เวอร์ชัน irm_agent_sync_v{version_num}.py (โดย {downloaded_by})",
                details={
                    "agent_version": f"v{version_num}",
                    "filename": f"irm_agent_sync_v{version_num}.py",
                    "downloaded_by": downloaded_by,
                    "previous_version": f"v{current_ver}",
                },
                triggered_by=downloaded_by,
                db=db,
            )
            await db.commit()
        except Exception as log_err:
            logger.error(f"Failed to record download agent script log: {log_err}")
    else:
        version_num = current_ver

    filename = f"irm_agent_sync_v{version_num}.py"

    # Resolve target URL
    vps_url = app_base_url.strip().rstrip("/") if app_base_url else (s_map.get("app_base_url") or "https://irm.windowasia.com").rstrip("/")
    if "irm.windowasia.com" in vps_url and vps_url.startswith("http://"):
        vps_url = vps_url.replace("http://", "https://")
    elif not vps_url.startswith("http"):
        vps_url = f"https://{vps_url}"
    ingest_endpoint = f"{vps_url}/api/sap/inbound-push"

    ingest_token = s_map.get("sap_ingest_token") or "tok_irm_ingest_sec_8a39f029b4c12e87"
    sql_host = s_map.get("sap_host") or "wa-dbs2.wa.net"
    sql_port = s_map.get("sap_port") or "1433"
    sql_db = s_map.get("sap_database") or "SBO_COMPANY_DB"
    sql_user = s_map.get("sap_user") or "irm_readonly"
    sql_pass = s_map.get("sap_password") or ""
    item_groups = s_map.get("sap_item_groups") or "[113, 115]"
    gen_time_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    sql_query_text = build_sap_query_sql(item_groups)

    script_template = f'''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
 🏢 IRM — SAP Business One On-Premise Outbound Sync Agent ({filename})
 Window Asia Public Company Limited (Window Asia PCL.)
 Script Version : v{version_num} (Generated: {gen_time_str})
================================================================================
 คำอธิบาย:
  - สคริปต์นี้ทำงานบน Server On-Premise ฝั่งโรงงาน เพื่อดึงข้อมูล Open PO จาก SAP B1
  - ยิงข้อมูลแบบ Outbound HTTPS POST ไปยังระบบ IRM บน VPS Hostinger
  - ไม่ต้องเปิด Port ขาเข้า (Zero Inbound Firewall Changes) ปลอดภัย 100%
================================================================================
 วิธีการใช้งาน:
  1. ติดตั้ง Library เชื่อมต่อฐานข้อมูล:
       pip install pyodbc requests
     (หรือ: pip install pymssql requests)
  2. สั่งรันด้วยตนเอง:
       python {filename}
  3. ตั้งเวลาใน Windows Task Scheduler / Linux Cron (เช่น รันทุกวันตามเวลาที่กำหนดใน System Setting)
================================================================================
"""

import sys
import os
import json
import time
import logging
from datetime import datetime

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("sap_sync.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("SAP_Agent")

# ==============================================================================
# ⚙️ CONFIGURATION (ฝังค่าอัตโนมัติจาก IRM System Settings)
# ==============================================================================
AGENT_VERSION  = "v{version_num}"
AGENT_FILENAME = "{filename}"
GENERATED_AT   = "{gen_time_str}"

IRM_INGEST_URL = "{ingest_endpoint}"
IRM_INGEST_KEY = "{ingest_token}"

# SAP MS SQL Server On-Premise Connection
SQL_SERVER   = "{sql_host}"
SQL_PORT     = {sql_port}
SQL_DATABASE = "{sql_db}"
SQL_USER     = "{sql_user}"
SQL_PASSWORD = "{sql_pass}"

# SQL Query สำหรับดึง Open POs (กรองกลุ่มสินค้า 7 กลุ่ม)
SAP_SQL_QUERY = """{sql_query_text}"""


def query_sap_data():
    """เชื่อมต่อ SAP MS SQL Server และดึงข้อมูล Open POs ทั้งหมด"""
    logger.info(f"Connecting to SAP MS SQL Server ({{SQL_SERVER}}:{{SQL_PORT}}/{{SQL_DATABASE}})...")
    records = []
    
    # 1. ลองเชื่อมต่อด้วย pyodbc (รองรับ ODBC Driver 17, 18, SQL Server)
    try:
        import pyodbc
        drivers = [
            "DRIVER={{ODBC Driver 17 for SQL Server}};",
            "DRIVER={{ODBC Driver 18 for SQL Server}};TrustServerCertificate=yes;",
            "DRIVER={{SQL Server}};",
        ]
        conn = None
        for drv in drivers:
            try:
                conn_str = (
                    f"{{drv}}"
                    f"SERVER={{SQL_SERVER}},{{SQL_PORT}};"
                    f"DATABASE={{SQL_DATABASE}};"
                    f"UID={{SQL_USER}};"
                    f"PWD={{SQL_PASSWORD}};"
                    "Timeout=20;"
                )
                conn = pyodbc.connect(conn_str)
                break
            except Exception:
                continue

        if conn is not None:
            cursor = conn.cursor()
            cursor.execute(SAP_SQL_QUERY)
            columns = [col[0] for col in cursor.description]
            for row in cursor.fetchall():
                row_dict = dict(zip(columns, row))
                for k, v in row_dict.items():
                    if isinstance(v, datetime):
                        row_dict[k] = v.isoformat()
                records.append(row_dict)
            cursor.close()
            conn.close()
            logger.info(f"Successfully fetched {{len(records)}} records using pyodbc.")
            return records
    except Exception as err_odbc:
        logger.warning(f"pyodbc connection attempt failed: {{err_odbc}}. Trying pymssql...")

    # 2. ลองเชื่อมต่อด้วย pymssql เป็น Fallback
    try:
        import pymssql
        conn = pymssql.connect(
            server=SQL_SERVER,
            port=SQL_PORT,
            user=SQL_USER,
            password=SQL_PASSWORD,
            database=SQL_DATABASE,
            timeout=20,
            as_dict=True,
        )
        cursor = conn.cursor()
        cursor.execute(SAP_SQL_QUERY)
        for row in cursor.fetchall():
            row_dict = dict(row)
            for k, v in row_dict.items():
                if isinstance(v, datetime):
                    row_dict[k] = v.isoformat()
            records.append(row_dict)
        cursor.close()
        conn.close()
        logger.info(f"Successfully fetched {{len(records)}} records using pymssql.")
        return records
    except Exception as err_mssql:
        logger.error(f"pymssql connection attempt also failed: {{err_mssql}}")
        raise RuntimeError(f"Cannot connect to SAP SQL Server: {{err_mssql}}")


def push_data_to_irm(records):
    """ส่งข้อมูลแบบ Outbound HTTPS POST ไปยัง IRM VPS Hostinger"""
    logger.info(f"Sending Outbound HTTPS POST to IRM ({{IRM_INGEST_URL}})...")
    
    headers = {{
        "Content-Type": "application/json",
        "X-IRM-Ingest-Key": IRM_INGEST_KEY,
        "User-Agent": f"IRM-OnPrem-SAP-Agent/{{AGENT_VERSION}} ({{AGENT_FILENAME}})",
    }}
    
    payload = {{
        "records": records,
        "agent_version": AGENT_VERSION,
        "agent_filename": AGENT_FILENAME,
        "pushed_at": datetime.now().isoformat(),
        "source_host": os.environ.get("COMPUTERNAME", os.environ.get("HOSTNAME", "On-Prem-Server")),
    }}
    
    import requests
    response = requests.post(IRM_INGEST_URL, json=payload, headers=headers, timeout=60)
    
    if response.status_code == 200:
        result = response.json()
        logger.info(f"SUCCESS! IRM Ingest Response: {{result.get('message', 'OK')}}")
        logger.info(f"Total Records: {{result.get('total_records', len(records))}}, Closed in SAP: {{result.get('closed_count', 0)}}, Purged Expired: {{result.get('purged_count', 0)}}")
        return result
    else:
        logger.error(f"FAILED! HTTP {{response.status_code}}: {{response.text}}")
        raise RuntimeError(f"IRM Ingestion Rejected (HTTP {{response.status_code}}): {{response.text}}")


def main():
    start_time = time.time()
    logger.info("================================================================================")
    logger.info(f"  IRM SAP ON-PREMISE SYNC AGENT [{{AGENT_FILENAME}}] STARTED [{{datetime.now().strftime('%d/%m/%Y %H:%M:%S')}}]")
    logger.info(f"  Target: {{IRM_INGEST_URL}} | Version: {{AGENT_VERSION}}")
    logger.info("================================================================================")
    
    try:
        records = query_sap_data()
        push_data_to_irm(records)
        elapsed = time.time() - start_time
        logger.info(f"Agent finished successfully in {{elapsed:.2f}} seconds.")
        logger.info("================================================================================\\n")
        return 0
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"Sync Agent execution failed: {{e}} (Duration: {{elapsed:.2f}}s)")
        logger.info("================================================================================\\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
'''
    return script_template.strip(), filename, version_num
