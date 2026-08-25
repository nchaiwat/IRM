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
    expiry_str: str
):
    topic = "📬 <b>รายงานการกระจาย Email แจ้งเตือน Supplier</b>"
    body = (
        f"• 🏢 <b>ส่งสำเร็จ:</b> {total_sent:,} บริษัท (รวม {total_items:,} รายการ PO)\n"
        f"• ⏳ <b>กำหนดเวลากรอกข้อมูล:</b> หมดอายุในวันที่ {expiry_str}\n"
    )
    if missing_sup_list:
        missing_preview = ", ".join(missing_sup_list[:4])
        if len(missing_sup_list) > 4:
            missing_preview += f" และอีก {len(missing_sup_list)-4} ราย"
        body += f"• ⚠️ <b>ยังไม่มี Email ในระบบ:</b> {len(missing_sup_list)} บริษัท ({missing_preview})\n"
    else:
        body += "• ✅ <b>สถานะ Email:</b> Supplier ทุกรายมี Email ครบถ้วน\n"
    
    body += "• 🔐 <b>ความปลอดภัย:</b> ส่ง Secure Cryptographic Token เรียบร้อยแล้ว"
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
    - รายการเพิ่มใหม่กี่ Item จากกี่ PO
    - รายการที่ปิดยอดแล้วกี่ Item จากกี่ PO
    - รายการรอยืนยันกี่ Item จากกี่ PO
    """
    from sqlalchemy import func, distinct, select
    from app.models.po import POHeader, POItem

    # 1. New Items: is_new == True, Open POs, not closed
    stmt_new = (
        select(func.count(POItem.id), func.count(distinct(POHeader.po_number)))
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .where(POHeader.status == "O")
        .where(POItem.status != "closed")
        .where(POItem.is_new == True)
    )
    res_new = (await db.execute(stmt_new)).first()
    new_items_count = res_new[0] or 0 if res_new else 0
    new_pos_count = res_new[1] or 0 if res_new else 0

    # 2. Closed Items
    stmt_closed = (
        select(func.count(POItem.id), func.count(distinct(POHeader.po_number)))
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .where(POItem.status == "closed")
    )
    res_closed = (await db.execute(stmt_closed)).first()
    closed_items_count = res_closed[0] or 0 if res_closed else 0
    closed_pos_count = res_closed[1] or 0 if res_closed else 0

    # 3. Pending/Awaiting Confirmation Items: status not in ('confirmed', 'closed')
    stmt_pending = (
        select(func.count(POItem.id), func.count(distinct(POHeader.po_number)))
        .join(POHeader, POItem.po_header_id == POHeader.id)
        .where(POHeader.status == "O")
        .where(POItem.status != "confirmed")
        .where(POItem.status != "closed")
    )
    res_pending = (await db.execute(stmt_pending)).first()
    pending_items_count = res_pending[0] or 0 if res_pending else 0
    pending_pos_count = res_pending[1] or 0 if res_pending else 0

    topic = "🌅 <b>สรุปสถานะรายการประจำวัน (Daily 08:00 AM Morning Summary)</b>"
    body = (
        f"• 🆕 <b>มี Item เพิ่มใหม่:</b> {new_items_count:,} รายการ ({new_pos_count:,} ใบสั่งซื้อ PO)\n"
        f"• 📥 <b>มี Item ที่ปิดแล้ว:</b> {closed_items_count:,} รายการ ({closed_pos_count:,} ใบสั่งซื้อ PO)\n"
        f"• ⏳ <b>มี Item รอยืนยัน:</b> {pending_items_count:,} รายการ ({pending_pos_count:,} ใบสั่งซื้อ PO)\n\n"
        "• 💻 <b>คำแนะนำ:</b> ฝ่ายจัดซื้อสามารถเข้าตรวจสอบและกดยืนยันรอบส่งได้ที่เมนู <b>Operation</b>"
    )
    full_msg = f"{format_telegram_header(topic)}\n\n{body}"
    res = await send_telegram_message(db, full_msg, category="morning_summary")
    return {
        "success": res,
        "new_items": new_items_count,
        "new_pos": new_pos_count,
        "closed_items": closed_items_count,
        "closed_pos": closed_pos_count,
        "pending_items": pending_items_count,
        "pending_pos": pending_pos_count,
    }

