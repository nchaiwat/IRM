# 📌 IRM System — HANDOFF & PROGRESS LOG

> **วันที่บันทึก:** 30 สิงหาคม 2026  
> **สถานะโครงการ:** Production-Ready, Deployed & Synchronized on VPS (`https://irm.windowasia.com`)  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **VPS Hostinger Path:** `/var/www/Irm`

---

## 🎯 1. ภาพรวมระบบ (System Overview)
ระบบ **IRM (Incoming Raw Material Management System)** ของบริษัท Window Asia PCL. พัฒนาขึ้นเพื่อติดตามการส่งมอบวัตถุดิบ 7 กลุ่ม (กระจก, อลูมิเนียม, UPVC, ฮาร์ดแวร์, Sparepart, เหล็กดัด, Partner) จาก SAP Business One เชื่อมโยงกับ Supplier ผ่าน Cryptographic Portal, แสดงผลปฏิทินส่งของ (Calendar), จัดการสิทธิ์ด้วย Dynamic Auth Matrix, และเชื่อมต่อข้อมูลส่งมอบกับระบบ **QMS (Quality Management System)** ผ่าน Secure API Channel

---

## 🏗️ 2. สรุปฟังก์ชันที่พัฒนาและปรับปรุงล่าสุด (สิงหาคม 2026)

### 1) ⚡ หน้า Operation: ระบบ 10 Filter Tabs พร้อม Real-time Badge Counts
* **Pill Tab Group (Horizontal Scrollable):**
  1. `ทั้งหมด [จำนวน]` — แสดง PO ค้างส่งทั้งหมด
  2. `✨ มาใหม่วันนี้ [จำนวน]` — กรองเฉพาะ PO ที่เพิ่งซิงค์เข้ามาใหม่ของวันนี้ (`is_new === true`)
  3. `⏱️ ยังไม่ยืนยัน [จำนวน]` — กรองรายการค้างเดิมที่ยังไม่ได้กดยืนยัน (ไม่นับรวมของมาใหม่วันนี้)
  4. `✔️ ยืนยันแล้ว [จำนวน]` — กรองรายการที่ฝ่ายจัดซื้อกด Confirm แผนแล้ว (`status === 'confirmed'`)
  5. `↳ แบ่งการส่ง [จำนวน]` — กรองรายการที่มีการแตกย่อยงวดส่งมอบ (`sub_items.length > 1`)
  6. `⚡ ส่งเกิน PO [จำนวน]` — กรองรายการที่มีการระบุยอดส่งมอบเกินกว่าจำนวน PO (`Over-Delivery`)
  7. `🔴 เกินกำหนด [จำนวน]` — กรองรายการที่เลยกำหนดส่งมอบ (Estimate / Due Date < วันนี้)
  8. `🟡 ถึงใน 7 วัน [จำนวน]` — กรองรายการที่จะถึงกำหนดส่งมอบภายใน 7 วัน
  9. `🟠 ถึงใน 3 วัน [จำนวน]` — กรองรายการที่จะถึงกำหนดส่งมอบภายใน 3 วัน
  10. `💬 รอ Sup ยืนยัน [จำนวน]` — กรองรายการที่ส่งลิงก์ให้ Supplier หรือมีป้ายกระพริบส้มเมื่อ Supplier ตอบกลับ
* **Over-Delivery Logic Refinement:** แก้ไขเงื่อนไข `isOverPO` ให้เปรียบเทียบจากยอดที่ฝ่ายจัดซื้อ/Supplier ได้มีการระบุ/ยืนยันแผนส่งมอบจริง (`isRecordModified`) เพื่อไม่ให้รายการที่เป็นค่า Default ตั้งต้นจาก SAP ถูกเข้าใจผิดว่าส่งเกิน PO

### 2) 📜 หน้า History: ระบบ 2 Filter Tabs & ประสิทธิภาพสูง
* **Tabs:** `ทั้งหมด [จำนวน]` และ `✨ ปิดเมื่อวาน [จำนวน]` เพื่อให้จัดซื้อและผู้บริหารกดดูเฉพาะยอดที่เพิ่งรับเข้าคลังเสร็จสิ้นเมื่อวาน (ซิงค์เข้าเช้าวันนี้) ได้ทันทีในคลิกเดียว
* **Audit Trail Lazy Loading:** ปรับการดึงประวัติ Audit Log เป็นแบบ Lazy-load เมื่อคลิกไอคอนประวัติ (`/api/history/items/{id}/audit-logs`) พร้อมใช้ `selectinload` ตัดปัญหา N+1 Query

### 3) 📱 Telegram Notification Suite ครบวงจร
* **🌅 Morning Summary Report (08:00 AM):** ปรับโครงสร้างรายงานสรุปประจำวันแยกเป็น 4 หมวดหลัก:
  * 📊 **สถานะใบสั่งซื้อ & รายการส่งมอบ:** PO เข้าใหม่, PO ทั้งหมด, Item ยังไม่ยืนยัน, Item ที่ Sup ตอบกลับ, Item ส่งใน 7 วัน
  * 📦 **Item Master:** Item เพิ่มใหม่, Item ยังไม่ยืนยัน
  * 🏢 **Supplier Master:** Supplier เพิ่มใหม่, Supplier ยังไม่มี Email, Supplier รอการตอบกลับ
  * 📜 **History:** Item ปิดยอดใหม่วันนี้, Item พ้นระยะจัดเก็บ (เกิน 7 วัน), Item ในประวัติคงเหลือ
* **🔍 QMS Integration API Alert:** ส่งแจ้งเตือนทันทีเมื่อระบบ QMS ยิงเรียก `GET /api/external/qms/inbound-deliveries` ระบุจำนวนรายการ, ช่วงวันที่, Client IP และสถานะ `200 OK` (หรือ `401 Unauthorized` กรณี Auth Failed)
* **📬 Scheduled Supplier Email Broadcast Alert:** ส่งรายงานสรุปทันทีเมื่อถึงรอบส่งอีเมลอัตโนมัติวันจันทร์และวันพฤหัสบดี (08:00 น.) ระบุจำนวนบริษัทที่ส่งสำเร็จ, จำนวน PO/Item, กำหนดเวลาตอบกลับ (48 ชม.), และรายชื่อ Supplier ที่ยังไม่มีอีเมล
* **🔄 SAP Sync Alert:** แจ้งผลการซิงค์ SAP ประจำวันทันทีที่เสร็จสิ้น

### 4) 📊 Master XLSX Export/Import ครบถ้วน 7 คอลัมน์
* **Supplier Master:** Export/Import รองรับ 7 คอลัมน์: Code, Name, Email, Telephone, Contact Person, Over-Delivery, และ Accept
* **Item Master:** Export/Import รองรับ 7 กลุ่มวัตถุดิบ, Lead Time Days, Notify Alert Days, และ Accept

### 5) 🔐 Security & User Management
* **Auth Matrix:** Dynamic Database-driven Matrix สำหรับกำหนดสิทธิ์ View, Create, Edit, Delete รายเมนูตาม Role
* **Mobile Responsive:** รองรับการใช้งานผ่านมือถือและแท็บเล็ตด้วยเมนู Drawer และตัดการแสดงผล Password ในหน้า Login

---

## 📂 3. โครงสร้างไฟล์สำคัญ (Key Files Reference)

| ไฟล์ (File Path) | หน้าที่ / การทำงาน |
| :--- | :--- |
| [`frontend/src/app/(dashboard)/operation/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/operation/page.tsx) | หน้า Operation พร้อม 10 Filter Tabs, Split Deliveries, Over-Delivery, และ Lock Modal |
| [`frontend/src/app/(dashboard)/history/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/history/page.tsx) | หน้า History พร้อม 2 Filter Tabs (`ทั้งหมด`, `ปิดเมื่อวาน`) และ Plan vs Actual Variance |
| [`backend/app/services/telegram_service.py`](file:///d:/Python/IRM/backend/app/services/telegram_service.py) | ศูนย์กลางการแจ้งเตือน Telegram (Morning Report, QMS Alert, Email Broadcast, SAP Sync) |
| [`backend/app/services/scheduler.py`](file:///d:/Python/IRM/backend/app/services/scheduler.py) | Background Scheduler (SAP Sync 04:00/08:00, Telegram 08:00, Mon/Thu Email Broadcast) |
| [`backend/app/routers/qms_integration.py`](file:///d:/Python/IRM/backend/app/routers/qms_integration.py) | API Channel สำหรับเชื่อมต่อระบบ QMS ดึงข้อมูล Confirmed Inbound Deliveries |
| [`backend/app/services/sap_service.py`](file:///d:/Python/IRM/backend/app/services/sap_service.py) | SAP One-Way Inbound Sync & Differential Closed Detection |
| [`backend/app/services/email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py) | Email Dispatcher with Rate-Limiting, No-Reply Protocol, and Excel Attachments |
| [`MEMORY.md`](file:///d:/Python/IRM/MEMORY.md) | กฎเหล็กในการทำงาน, ข้อตกลง และมาตรฐานการพัฒนาของระบบ |
| [`QMS_API_INTEGRATION_GUIDE.md`](file:///d:/Python/IRM/QMS_API_INTEGRATION_GUIDE.md) | คู่มือการเชื่อมต่อ API สำหรับส่งต่อให้ทีมพัฒนาระบบ QMS |

---

## 🚀 4. คำสั่งจัดการระบบบน VPS Hostinger (`/var/www/Irm`)

### 🔄 ดึงโค้ดล่าสุด & Rebuild:
```bash
cd /var/www/Irm
git pull origin main
docker compose up -d --build
```

### 🧹 ล้างข้อมูล Transaction & Masters (กรณีเริ่มทดสอบใหม่จากศูนย์):
```bash
docker compose exec irm-db psql -U irm -d irm -c "TRUNCATE TABLE item_masters, supplier_masters, sub_items, po_item_audit_logs, po_items, po_headers, supplier_portal_tokens, transaction_logs RESTART IDENTITY CASCADE;"
docker compose exec irm-redis redis-cli flushall
```
