"""
Telegram Notification Service — Standard Header Template and Centralized Incident Alerting for IRM.
Header Standard:
IRM System
📦 IRM System · 19 ส.ค. 2569 11:35 น.
────────────────────────────────
🚀 [Topic]
"""

import httpx
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_setting import SystemSetting
from app.services.log_service import record_transaction_log


THAI_MONTHS_SHORT = [
    "", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
]


def format_thai_now() -> str:
    """Format current datetime in Thai Buddhist Era: 19 ส.ค. 2569 11:35 น."""
    tz_bkk = timezone(timedelta(hours=7))
    now = datetime.now(tz_bkk)
    thai_year = now.year + 543
    month_name = THAI_MONTHS_SHORT[now.month]
    return f"{now.day} {month_name} {thai_year} {now.strftime('%H:%M')} น."


def format_telegram_header(topic: str) -> str:
    """Create standardized header requested by User: 📦 IRM System · วันที่ เวลา + Line + Topic."""
    time_str = format_thai_now()
    header = (
        f"📦 <b>IRM System</b> · {time_str}\n"
        "────────────────────────────\n"
        f"{topic}"
    )
    return header


async def send_telegram_message(db: AsyncSession, message_text: str, category: str = "telegram_alert") -> bool:
    """Send message to configured Telegram Group with fallback and transaction logging."""
    try:
        settings_rows = (await db.execute(select(SystemSetting).where(SystemSetting.category == "telegram"))).scalars().all()
        s_map = {s.key: s.value for s in settings_rows}

        bot_token = s_map.get("telegram_bot_token") or "8231754616:AAHcITgZR6_Gc8XJx-6Fxj-Cyy5bZZQG2hw"
        group_id = s_map.get("telegram_group_id") or "-5394050672"
        api_url = s_map.get("telegram_api_url") or "https://api.telegram.org"

        if not bot_token or not group_id:
            print("Telegram Bot Token or Group ID is not configured.")
            return False

        endpoint = f"{api_url}/bot{bot_token}/sendMessage"
        payload = {
            "chat_id": group_id,
            "text": message_text,
            "parse_mode": "HTML",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(endpoint, json=payload)
            if res.status_code == 200:
                await record_transaction_log(
                    category=category,
                    action="telegram_broadcast",
                    status="SUCCESS",
                    message="ส่งแจ้งเตือน Telegram สำเร็จ",
                    details=message_text[:300],
                    db=db,
                )
                return True
            else:
                print(f"Telegram API Error ({res.status_code}): {res.text}")
                return False
    except Exception as e:
        print(f"Failed to send Telegram notification: {e}")
        return False


# ----------------------------------------------------
# 1. Incident: SAP Sync Completed or Failed
# ----------------------------------------------------
async def send_telegram_sap_sync(
    db: AsyncSession,
    po_count: int,
    item_count: int,
    closed_count: int,
    success: bool = True,
    error_msg: str | None = None
):
    if success:
        topic = "🔄 <b>การ Sync ข้อมูลจาก SAP B1 สำเร็จ</b>"
        body = (
            f"• 📑 <b>จำนวน PO ที่นำเข้า/อัปเดต:</b> {po_count:,} เลขที่ PO\n"
            f"• 📦 <b>จำนวนรายการวัตถุดิบ:</b> {item_count:,} รายการ\n"
            f"• 📥 <b>ปิดยอดรับเข้าคลังครบแล้ว:</b> {closed_count:,} รายการ\n"
            "• ⚡ <b>สถานะ:</b> ข้อมูลในระบบ IRM เป็นปัจจุบันเรียบร้อยแล้ว"
        )
    else:
        topic = "🚨 <b>แจ้งเตือน: การ Sync ข้อมูล SAP ล้มเหลว</b>"
        body = (
            "• ⚠️ <b>สาเหตุ:</b> ไม่สามารถเชื่อมต่อฐานข้อมูล SAP B1 ได้\n"
            f"• 📝 <b>รายละเอียด:</b> <code>{error_msg or 'Connection Timeout'}</code>\n"
            "• 🔧 <b>คำแนะนำ:</b> กรุณาตรวจสอบการตั้งค่า Connection ใน System Setting"
        )
    
    full_msg = f"{format_telegram_header(topic)}\n\n{body}"
    await send_telegram_message(db, full_msg, category="sap_sync")


# ----------------------------------------------------
# 2. Incident: Email Broadcast to Suppliers
# ----------------------------------------------------
async def send_telegram_email_broadcast(
    db: AsyncSession,
    total_sent: int,
    total_items: int,
    missing_sup_list: list[str],
    expiry_str: str,
    round_name: str = "ประจำรอบ",
    total_suppliers: int = 0,
    total_pos: int = 0,
):
    topic = f"📬 <b>รายงานการกระจาย Email แจ้งเตือน Supplier ({round_name})</b>"
    total_sup_val = total_suppliers or total_sent
    pct = (total_sent / total_sup_val * 100) if total_sup_val > 0 else 100.0

    body = (
        f"• 🏢 <b>บริษัทที่ส่งสำเร็จ:</b> {total_sent:,} บริษัท"
    )
    if total_pos > 0 or total_items > 0:
        body += f" (รวม {total_pos:,} PO / {total_items:,} รายการ)"
    body += f"\n• ⏳ <b>กำหนดเวลาตอบกลับ:</b> ภายในวันที่ {expiry_str}\n"

    if missing_sup_list:
        missing_preview = ", ".join(missing_sup_list[:4])
        if len(missing_sup_list) > 4:
            missing_preview += f" และอีก {len(missing_sup_list)-4} ราย"
        body += f"• ⚠️ <b>Supplier ที่ยังไม่มี Email:</b> {len(missing_sup_list)} บริษัท ({missing_preview})\n"
    else:
        body += "• ✅ <b>สถานะ Email:</b> Supplier ทุกรายมี Email ครบถ้วน\n"

    body += (
        f"\n📊 <b>[สถานะการส่ง]</b>\n"
        f"• ส่งสำเร็จ: {total_sent:,}/{total_sup_val:,} บริษัท ({pct:.1f}%)\n"
        "• ระบบล็อกข้อมูลเพื่อรอ Supplier ตอบกลับเรียบร้อยแล้ว"
    )
    full_msg = f"{format_telegram_header(topic)}\n\n{body}"
    await send_telegram_message(db, full_msg, category="supplier_email")


# ----------------------------------------------------
# 3. Incident: Supplier Responded via Portal
# ----------------------------------------------------
async def send_telegram_supplier_response(
    db: AsyncSession,
    supplier_code: str,
    supplier_name: str,
    po_number: str | None,
    item_count: int,
    summary_lines: list[str] | None = None
):
    topic = "🟢 <b>Supplier ยืนยันกำหนดส่งวัตถุดิบผ่าน Portal</b>"
    body = (
        f"• 🏢 <b>ผู้จำหน่าย:</b> {supplier_name} ({supplier_code})\n"
        f"• 📑 <b>เลขที่ PO:</b> {po_number or 'ทุกใบสั่งซื้อที่เปิดค้าง'}\n"
        f"• 📦 <b>จำนวนที่ตอบกลับ:</b> {item_count} รายการ\n"
    )
    if summary_lines:
        body += "• 🚚 <b>สรุปกำหนดส่งมอบ:</b>\n"
        for line in summary_lines[:3]:
            body += f"   - {line}\n"
        if len(summary_lines) > 3:
            body += f"   - และอีก {len(summary_lines)-3} รายการ...\n"
    
    body += "• 💻 <b>ขั้นตอนถัดไป:</b> ฝ่ายจัดซื้อสามารถเข้าตรวจสอบที่หน้า Operation"
    full_msg = f"{format_telegram_header(topic)}\n\n{body}"
    await send_telegram_message(db, full_msg, category="supplier_portal")


# ----------------------------------------------------
# 4. Incident: Lead Time & Upcoming Delivery Alert
# ----------------------------------------------------
async def send_telegram_lead_time_alert(
    db: AsyncSession,
    alert_items: list[dict]
):
    if not alert_items:
        return
    topic = "⏰ <b>แจ้งเตือนวัตถุดิบใกล้ถึงกำหนดส่งมอบ (Upcoming Inbound)</b>"
    body = f"• 📋 <b>พบรายการใกล้กำหนดส่ง:</b> {len(alert_items)} รายการ\n"
    body += "• 🚚 <b>รายการนัดหมายส่งมอบ:</b>\n"
    for it in alert_items[:4]:
        body += f"   - 📦 <b>{it['item_code']}</b>: นัดส่ง {it['est_date']} ({it['qty']:,} {it['unit']}) จาก {it['supplier_name']}\n"
    if len(alert_items) > 4:
        body += f"   - และอีก {len(alert_items)-4} รายการ...\n"
    body += "• 🏢 <b>คำแนะนำ:</b> แผนกจัดซื้อและคลังสินค้าโปรดเตรียมพื้นที่รับมอบ"
    full_msg = f"{format_telegram_header(topic)}\n\n{body}"
    await send_telegram_message(db, full_msg, category="telegram_alert")


# ----------------------------------------------------
# 5. Incident: Critical Overdue Alert
# ----------------------------------------------------
async def send_telegram_overdue_alert(
    db: AsyncSession,
    overdue_items: list[dict]
):
    if not overdue_items:
        return
    topic = "🚨 <b>แจ้งเตือนด่วน: รายการวัตถุดิบเกินกำหนดส่ง (Critical Overdue)</b>"
    body = (
        f"• ⚠️ <b>จำนวนรายการค้างเลย Due Date:</b> {len(overdue_items)} รายการ\n"
        "• 🔥 <b>รายการที่มีความเสี่ยงกระทบสายผลิต:</b>\n"
    )
    for it in overdue_items[:4]:
        body += f"   - 📦 <b>{it['item_code']}</b> (PO {it['po_number']}): เกินกำหนด {it['days_over']} วัน (จัดซื้อ: {it['buyer_name']})\n"
    if len(overdue_items) > 4:
        body += f"   - และอีก {len(overdue_items)-4} รายการ...\n"
    body += "• 📞 <b>คำแนะนำ:</b> เจ้าหน้าที่จัดซื้อโปรดเร่งติดตาม Supplier ด่วน"
    full_msg = f"{format_telegram_header(topic)}\n\n{body}"
    await send_telegram_message(db, full_msg, category="telegram_alert")


# ----------------------------------------------------
# 6. Incident: Buyer Manual Unlock / Override Audit
# ----------------------------------------------------
async def send_telegram_buyer_unlock(
    db: AsyncSession,
    po_number: str,
    item_code: str,
    user_name: str,
    reason: str | None = None
):
    topic = "🔓 <b>แจ้งเตือนการปลดล็อครายการโดยฝ่ายจัดซื้อ (Unlock Override)</b>"
    body = (
        f"• 📑 <b>เลขที่ PO:</b> {po_number}\n"
        f"• 📦 <b>รหัสสินค้า:</b> {item_code}\n"
        f"• 👤 <b>ผู้ทำรายการ:</b> คุณ{user_name}\n"
        f"• 📝 <b>เหตุผล/หมายเหตุ:</b> {reason or 'จัดซื้อดึงกลับมาบริหารและระบุวันส่งเอง'}\n"
        "• 🛡️ <b>ระบบ:</b> บันทึกประวัติใน Transaction & Audit Trail เรียบร้อยแล้ว"
    )
    full_msg = f"{format_telegram_header(topic)}\n\n{body}"
    await send_telegram_message(db, full_msg, category="system_audit")


# ----------------------------------------------------
# 7. Daily 08:00 AM Morning Summary Briefing
# ----------------------------------------------------
async def send_telegram_morning_summary(db: AsyncSession) -> dict:
    """
    Daily Morning Briefing at 08:00 AM:
    Dashboard:
      1. PO เข้าใหม่ x PO (y รายการ)
      2. PO ทั้งหมด x PO (y รายการ)
      3. Item ยังไม่ยืนยัน x รายการ
      4. Item ที่ Sup ตอบกลับแล้ว x รายการ
      5. Item ที่จะส่งภายใน 7 วันและยังไม่ได้ยืนยัน x รายการ
    Item Master:
      1. Item เพิ่มใหม่ x รายการ
      2. Item ยังไม่ยืนยัน x รายการ
    Supplier Master:
      1. Supplier เพิ่มใหม่ x รายชื่อ
      2. Supplier ยังไม่มี Email x รายชื่อ
      3. Supplier รอการตอบกลับ x รายชื่อ
    History:
      1. Item ปิดยอดใหม่วันนี้ x รายการ
      2. Item พ้นระยะจัดเก็บ (เกิน 7 วัน) x รายการ
      3. Item ในประวัติคงเหลือ x รายการ
    """
    from datetime import datetime, timezone, timedelta
    from zoneinfo import ZoneInfo
    from sqlalchemy import func, distinct, select, or_, and_
    from app.models.po import POHeader, POItem
    from app.models.master import ItemMaster, SupplierMaster

    bkk_tz = ZoneInfo("Asia/Bangkok")
    now_bkk = datetime.now(bkk_tz)
    today_bkk_date_str = now_bkk.strftime("%d/%m/%Y")
    
    now_dt = datetime.now(timezone.utc)
    start_today = now_dt.replace(hour=0, minute=0, second=0, microsecond=0)
    end_7days = start_today + timedelta(days=7, hours=23, minutes=59, seconds=59)

    try:
        # 1. Dashboard / Operation Queries
        stmt_new = (
            select(func.count(distinct(POHeader.po_number)), func.count(POItem.id))
            .join(POHeader, POItem.po_header_id == POHeader.id)
            .where(POItem.is_new == True, POItem.status != "closed")
        )
        res_new = (await db.execute(stmt_new)).first()
        new_pos = res_new[0] or 0 if res_new else 0
        new_items = res_new[1] or 0 if res_new else 0

        stmt_open = (
            select(func.count(distinct(POHeader.po_number)), func.count(POItem.id))
            .join(POHeader, POItem.po_header_id == POHeader.id)
            .where(POHeader.status == "O", POItem.status != "closed")
        )
        res_open = (await db.execute(stmt_open)).first()
        total_open_pos = res_open[0] or 0 if res_open else 0
        total_open_items = res_open[1] or 0 if res_open else 0

        stmt_unconfirmed = (
            select(func.count(POItem.id))
            .join(POHeader, POItem.po_header_id == POHeader.id)
            .where(POHeader.status == "O", POItem.status != "closed", POItem.status != "confirmed")
        )
        unconfirmed_items = (await db.execute(stmt_unconfirmed)).scalar_one() or 0

        stmt_sup_resp = (
            select(func.count(POItem.id))
            .join(POHeader, POItem.po_header_id == POHeader.id)
            .where(POHeader.status == "O", POItem.status == "supplier_responded")
        )
        sup_responded_items = (await db.execute(stmt_sup_resp)).scalar_one() or 0

        stmt_upcoming_unconfirmed = (
            select(func.count(distinct(POItem.id)))
            .join(POHeader, POItem.po_header_id == POHeader.id)
            .where(POHeader.status == "O")
            .where(POItem.status != "closed")
            .where(POItem.status != "confirmed")
            .where(
                or_(
                    and_(POItem.estimate_date >= start_today, POItem.estimate_date <= end_7days),
                    and_(POItem.estimate_date.is_(None), POItem.due_date >= start_today, POItem.due_date <= end_7days),
                )
            )
        )
        upcoming_unconfirmed_7d = (await db.execute(stmt_upcoming_unconfirmed)).scalar_one() or 0

        # 2. Item Master Queries
        stmt_new_items = select(func.count(ItemMaster.id)).where(ItemMaster.is_new == True)
        new_item_master_count = (await db.execute(stmt_new_items)).scalar_one() or 0

        stmt_unconf_items = select(func.count(ItemMaster.id)).where(ItemMaster.is_new == True)
        unconf_item_master_count = (await db.execute(stmt_unconf_items)).scalar_one() or 0

        # 3. Supplier Master Queries
        stmt_new_sups = select(func.count(SupplierMaster.id)).where(SupplierMaster.is_new == True)
        new_sup_master_count = (await db.execute(stmt_new_sups)).scalar_one() or 0

        stmt_no_email = select(func.count(SupplierMaster.id)).where(
            or_(SupplierMaster.email.is_(None), SupplierMaster.email == "", SupplierMaster.email == "-")
        )
        no_email_sup_count = (await db.execute(stmt_no_email)).scalar_one() or 0

        stmt_awaiting_sup = (
            select(func.count(distinct(POHeader.supplier_code)))
            .join(POItem, POItem.po_header_id == POHeader.id)
            .where(POHeader.status == "O", POItem.status != "closed", POItem.status != "confirmed")
        )
        awaiting_sup_count = (await db.execute(stmt_awaiting_sup)).scalar_one() or 0

        # 4. History Queries
        stmt_closed_today = select(func.count(POItem.id)).where(
            POItem.status == "closed",
            POItem.closed_at >= (start_today - timedelta(hours=4))
        )
        closed_today_count = (await db.execute(stmt_closed_today)).scalar_one() or 0

        stmt_purged = select(func.count(POItem.id)).where(
            POItem.status == "closed",
            POItem.closed_at < (start_today - timedelta(days=7))
        )
        retention_purged_count = (await db.execute(stmt_purged)).scalar_one() or 0

        stmt_total_hist = select(func.count(POItem.id)).where(POItem.status == "closed")
        total_history_count = (await db.execute(stmt_total_hist)).scalar_one() or 0

        topic = f"🌅 <b>สรุปสถานะระบบ IRM ประจำวัน ({today_bkk_date_str})</b>"
        body = (
            "📊 <b>[สถานะใบสั่งซื้อ & รายการส่งมอบ]</b>\n"
            f"• PO เข้าใหม่: {new_pos:,} PO ({new_items:,} รายการ)\n"
            f"• PO ทั้งหมดที่เปิดอยู่: {total_open_pos:,} PO ({total_open_items:,} รายการ)\n"
            f"• Item ยังไม่ยืนยัน: {unconfirmed_items:,} รายการ\n"
            f"• Item ที่ Sup ตอบกลับแล้ว: {sup_responded_items:,} รายการ\n"
            f"• Item ส่งใน 7 วัน (ยังไม่ยืนยัน): {upcoming_unconfirmed_7d:,} รายการ\n\n"
            "📦 <b>[Item Master]</b>\n"
            f"• Item เพิ่มใหม่: {new_item_master_count:,} รายการ\n"
            f"• Item ยังไม่ยืนยัน: {unconf_item_master_count:,} รายการ\n\n"
            "🏢 <b>[Supplier Master]</b>\n"
            f"• Supplier เพิ่มใหม่: {new_sup_master_count:,} รายชื่อ\n"
            f"• Supplier ยังไม่มี Email: {no_email_sup_count:,} รายชื่อ\n"
            f"• Supplier รอการตอบกลับ: {awaiting_sup_count:,} รายชื่อ\n\n"
            "📜 <b>[History (ประวัติปิดยอด)]</b>\n"
            f"• Item ปิดยอดใหม่วันนี้: {closed_today_count:,} รายการ\n"
            f"• Item พ้นระยะจัดเก็บ (เกิน 7 วัน): {retention_purged_count:,} รายการ\n"
            f"• Item ในประวัติคงเหลือ: {total_history_count:,} รายการ"
        )
        full_msg = f"{format_telegram_header(topic)}\n\n{body}"
        res = await send_telegram_message(db, full_msg, category="morning_summary")
        return {
            "success": res,
            "new_pos": new_pos,
            "new_items": new_items,
            "total_open_pos": total_open_pos,
            "total_open_items": total_open_items,
            "unconfirmed_items": unconfirmed_items,
            "sup_responded_items": sup_responded_items,
            "upcoming_unconfirmed_7d": upcoming_unconfirmed_7d,
        }
    except Exception as e:
        await record_transaction_log(
            category="morning_summary",
            action="telegram_broadcast",
            status="ERROR",
            message=f"ส่งสรุปสถานะประจำวันล้มเหลว: {str(e)}",
            details=str(e),
            db=db,
        )
        raise e


# ----------------------------------------------------
# 8. Incident: QMS API Pull Delivery Schedule Alert
# ----------------------------------------------------
async def send_telegram_qms_pull(
    db: AsyncSession,
    item_count: int,
    client_ip: str,
    date_from: str | None = None,
    date_to: str | None = None,
    success: bool = True,
    error_msg: str | None = None
):
    if success:
        topic = "🔍 <b>QMS ดึงข้อมูลแผนส่งมอบ (Inbound Schedule Sync)</b>"
        date_range_str = f"{date_from} ถึง {date_to}" if (date_from and date_to) else "ทุกช่วงเวลาที่ Confirmed"
        body = (
            "• 🏢 <b>ระบบปลายทาง:</b> QMS (Quality Management System)\n"
            f"• 📦 <b>ข้อมูลที่ส่งออก:</b> {item_count:,} รายการ (เฉพาะรายการที่ Confirmed แล้ว)\n"
            f"• 📅 <b>ช่วงวันที่ส่งมอบ:</b> {date_range_str}\n"
            f"• 🌐 <b>Client IP:</b> <code>{client_ip}</code>\n"
            "• ⚡ <b>สถานะ:</b> 200 OK (ส่งมอบข้อมูลสำเร็จ)"
        )
    else:
        topic = "🚨 <b>แจ้งเตือน: QMS API Authentication Failed</b>"
        body = (
            f"• ⚠️ <b>สาเหตุ:</b> {error_msg or 'API Key ไม่ถูกต้อง'}\n"
            f"• 🌐 <b>Client IP:</b> <code>{client_ip}</code>\n"
            "• 🛡️ <b>ระบบความปลอดภัย:</b> ปฏิเสธการเข้าถึง (401 Unauthorized)"
        )
    full_msg = f"{format_telegram_header(topic)}\n\n{body}"
    await send_telegram_message(db, full_msg, category="qms_export")


