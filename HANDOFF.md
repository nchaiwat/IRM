# 📌 IRM System — HANDOFF & PROGRESS LOG

> **วันที่บันทึก:** 26 สิงหาคม 2026 (19:40 น.)  
> **สถานะโครงการ:** Production-Ready, Deployed & Synchronized on VPS (`https://irm.windowasia.com`)  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **VPS Hostinger Path:** `/var/www/Irm`

---

## 🎯 1. ภาพรวมระบบ (System Overview)
ระบบ **IRM (Inbound Raw Material Delivery Tracking & Calendar Planning)** ของบริษัท Window Asia PCL. พัฒนาขึ้นเพื่อติดตามการส่งมอบวัตถุดิบ 7 กลุ่ม (กระจก, อลูมิเนียม, UPVC, ฮาร์ดแวร์ ฯลฯ) จาก SAP Business One เชื่อมโยงกับ Supplier ผ่าน Cryptographic Portal, แสดงผลปฏิทินส่งของ (Calendar), และเชื่อมต่อข้อมูลส่งมอบกับระบบ **QMS (Quality Management System)** ผ่าน Secure API Channel

---

## 🏗️ 2. สรุปฟังก์ชันที่พัฒนาและแก้ไขล่าสุดในวันนี้ (26 สิงหาคม 2026)

### 1) 📊 Master XLSX Export/Import & Route Conflict Fixes
* **Excel Native (`.xlsx`):** แก้ปัญหาภาษาไทยและ Unicode ในการนำเข้า/ส่งออกทั้งหน้า **Supplier Master** และ **Item Master**
* **Supplier Master:** รองรับการแก้ `Email`, `Allow Over Delivery (ใช่/ไม่ใช่)`, และ `Accept (Accept/รอ Accept)` แล้ว Import กลับเข้าไปเพื่ออัปเดตและปลดสถานะ NEW ได้ทันที
* **Item Master:** รองรับการแก้ `Lead Time`, `Notify Alert`, `Description`, `Group`, และ `Accept (Accept/รอ Accept)` แล้ว Import กลับเข้าไปเพื่ออัปเดตและปลดสถานะ NEW ได้ทันที
* **FastAPI Route Fix:** จัดลำดับ Route `/bulk-update` ให้อยู่ก่อนหน้า `/{id}` เพื่อป้องกัน Error 422 Integer validation

### 2) 🔑 Token Lifecycle & Automatic Revocation
* เมื่อ User กดส่งอีเมลรอบใหม่ หรือกดสร้าง/คัดลอกลิงก์ใหม่ให้ Supplier รายเดิม ระบบจะ **สั่งยกเลิก (Revoke & Expire) Token เก่าทั้งหมดทันที**
* หากผู้ขายเปิดลิงก์เดิมจากอีเมลฉบับก่อนหน้า จะถูกปฏิเสธด้วยข้อความ *"ลิงก์นี้หมดอายุการกรอกข้อมูลแล้ว"* ทันที

### 3) 📋 Sequence Synchronization ระหว่าง Portal กับ Operation
* ปรับแต่ง Query ใน `supplier_portal.py` ให้เรียงลำดับรายการสินค้าในแต่ละ PO ตรงกันกับหน้า `operation.py` แบบ 100% บรรทัดต่อบรรทัด (`order_by(POHeader.po_number.desc(), POItem.id.asc())`) เพื่อให้จัดซื้อและคู่ค้าตรวจสอบข้อมูลตรงกันขณะโทรคุย

### 4) 📅 Calendar Redesign & Interactive Filters
* **การแยกสีสถานะ:**
  * 🟢 **สีเขียว (`Confirmed`):** สำหรับรายการที่ฝ่ายจัดซื้อกด Accept/Confirm แล้ว
  * 🟠 **สีส้ม (`Estimate`):** สำหรับรายการที่มีกำหนดส่งแล้วแต่อยู่ในสถานะประมาณการ
* **ตัวกรองมุมมอง (Interactive Filters):** ปุ่มกดสลับมุมมอง **แสดงทั้งหมด**, **เฉพาะยืนยันแล้ว**, **เฉพาะประมาณการ**
* **ข้อมูลบนการ์ดปฏิทิน:**
  * บรรทัดที่ 1: `Item Code` (ซ้าย) + `Qty & Unit` (ขวา)
  * บรรทัดที่ 2: `Supplier Name` (ซ้าย) + `ชื่อผู้รับผิดชอบ` (ขวา - เช่น `ภิญญาดา`, `พัชชา` โดยไม่มีคำว่า Buyer นำหน้า)
* **Header Counters:** แสดงตัวเลขสรุปแยก Confirmed และ Estimate แบบ Real-time

### 5) 📧 Daily PU Reminder Email with 2-Sheet Excel Attachment
* **การตั้งค่า (Settings):** มีสวิตช์เปิด/ปิดฟังก์ชัน (`pu_remind_mail_enabled`) และตั้งเวลาส่งประจำวัน (`pu_remind_mail_time`) ในหน้า Settings
* **สรุปสถิติในเนื้อหาอีเมล (Subject & Body):**
  * หัวข้อ: `IRM System — สรุปรายการติดตามการรับวัตถุดิบและของส่งวันนี้ (DD/MM/YYYY)`
  * ⚠️ รายการที่ยังไม่ Confirm Delivery Date: X ใบสั่งซื้อ (Y รายการ)
  * 🚚 รายการที่มีกำหนดส่งมอบภายในวันนี้: A ใบสั่งซื้อ (B รายการ)
* **ไฟล์แนบ Excel 2 Sheet (`.xlsx` สร้างด้วย OpenPyXL):**
  * **Sheet 1 (`รอ Confirm วันส่งมอบ`):** รายการ PO/Item ที่ยังไม่ได้รับ Accept/Confirm (Format และคอลัมน์เดียวกับหน้า Operation)
  * **Sheet 2 (`กำหนดส่งมอบวันนี้`):** รายการ PO/Item ที่นัดส่งมอบตรงกับวันปัจจุบัน (Format และคอลัมน์เดียวกับหน้า Operation)
* **กล่องทดสอบและ UI Consistency:**
  * มีช่องระบุ **`[อีเมลผู้รับทดสอบสรุปงาน]`** ไว้ข้างปุ่มโดยเฉพาะ
  * ปุ่ม **`ทดสอบส่งอีเมลสรุปงาน`** ได้รับการปรับแต่งสไตล์ให้เป็น **Consistency เดียวกันกับปุ่มทดสอบ Telegram และ SMTP** (`bg-sky-50 text-sky-700 border-sky-200`)
  * มีระบบ **Instant Feedback & Validation**: หากยังไม่ได้ใส่อีเมลจะมี Alert เตือน และหากส่งสำเร็จจะมี Alert สรุปยอดทันที
* **Technical & SMTP Architecture:**
  * ใช้ `MIMEApplication` แนบไฟล์ `.xlsx` (OpenXML Format)
  * ใช้ `_send_smtp_sync` ส่งผ่านพอร์ต 587 (STARTTLS) หรือ 465 (SSL)
  * มี APScheduler minute-checker ตรวจสอบเวลาตาม `SystemSetting` แบบ Real-time โดยไม่ต้อง Restart Server
  * มีระบบ Strict Error Handling ไม่กลืน Exception และส่งข้อความเตือนไปยังผู้ใช้ทันทีหากส่งไม่สำเร็จ

### 6) 👤 User Management User ID Format (`Firstname.L`)
* กำหนดมาตรฐาน User ID เป็น `ชื่อ.นามสกุลตัวแรก` เช่น `Chaiwat.N`, `Patcha.S`, `Pinyada.S` (ยกเว้น `admin`)
* ปรับปรุง User เดิมในฐานข้อมูล: `patcha` ➔ `Patcha.S`, `pinyada` ➔ `Pinyada.S`
* มี Helper text และ Placeholder แสดงรูปแบบที่ถูกต้องใน Modal สร้างผู้ใช้งานใหม่

### 7) 🔗 QMS Integration API Channel
* สร้าง Endpoint: `GET /api/external/qms/inbound-deliveries`
* รองรับ Query Parameters: `date_from`, `date_to`, `po_number`, `item_code`
* ส่งข้อมูลเฉพาะรายการที่ **Confirmed** แล้วเท่านั้น พร้อมรองรับรายการแตกส่งหลายรอบ (Split Rounds)
* **Security:** บังคับใส่ Header `X-API-Key: irm_qms_secure_key_2026`
* **Audit Trail:** บันทึก IP, เวลา, และจำนวน Record ลง `transaction_logs` หมวด `qms_integration` ทุกครั้ง
* จัดทำเอกสารคู่มือฉบับสมบูรณ์ไว้ที่ [QMS_API_INTEGRATION_GUIDE.md](file:///d:/Python/IRM/QMS_API_INTEGRATION_GUIDE.md)

---

## 📂 3. โครงสร้างไฟล์สำคัญ (Key Files Reference)

| ไฟล์ (File Path) | หน้าที่ / การทำงาน |
| :--- | :--- |
| [`backend/app/routers/qms_integration.py`](file:///d:/Python/IRM/backend/app/routers/qms_integration.py) | API Channel สำหรับเชื่อมต่อระบบ QMS ดึงข้อมูล Confirmed Inbound Deliveries |
| [`backend/app/routers/calendar.py`](file:///d:/Python/IRM/backend/app/routers/calendar.py) | API Calendar ส่งรายการ Confirmed/Estimate พร้อมชื่อ Buyer |
| [`frontend/src/app/(dashboard)/calendar/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/calendar/page.tsx) | ปฏิทินแสดงรอบส่งมอบ แยกสีเขียว/ส้ม และแสดงชื่อผู้รับผิดชอบ |
| [`backend/app/routers/supplier_portal.py`](file:///d:/Python/IRM/backend/app/routers/supplier_portal.py) | Supplier Portal API พร้อม Token Revocation และการจัดเรียง Sequence |
| [`backend/app/routers/suppliers.py`](file:///d:/Python/IRM/backend/app/routers/suppliers.py) | Supplier Master CRUD & Bulk XLSX Import |
| [`backend/app/routers/items.py`](file:///d:/Python/IRM/backend/app/routers/items.py) | Item Master CRUD & Bulk XLSX Import |
| [`MEMORY.md`](file:///d:/Python/IRM/MEMORY.md) | กฎเหล็กในการทำงาน, ข้อตกลง และมาตรฐานการพัฒนาของระบบ |
| [`QMS_API_INTEGRATION_GUIDE.md`](file:///d:/Python/IRM/QMS_API_INTEGRATION_GUIDE.md) | คู่มือการเชื่อมต่อ API สำหรับส่งต่อให้ทีมพัฒนาระบบ QMS |

---

## 🚀 4. คำสั่งจัดการระบบบน VPS Hostinger (`/var/www/Irm`)

### 🔄 ดึงโค้ดล่าสุด & Rebuild:
```bash
cd /var/www/Irm
git pull origin main
docker compose build --no-cache irm-backend irm-frontend
docker compose up -d
```

### 🧹 ล้างข้อมูล Transaction & Masters (เพื่อเริ่มทดสอบใหม่จากศูนย์):
```bash
docker compose exec irm-db psql -U irm -d irm -c "TRUNCATE TABLE item_masters, supplier_masters, sub_items, po_item_audit_logs, po_items, po_headers, supplier_portal_tokens, transaction_logs RESTART IDENTITY CASCADE;"
docker compose exec irm-redis redis-cli flushall
```

---

## 📌 5. แผนงานที่จะทำต่อในวันพรุ่งนี้ (Next Steps for Tomorrow)

1. **Deploy & Verification on VPS:**
   * รันคำสั่ง Rebuild บน VPS Hostinger และทดสอบหน้า Calendar, Supplier Master, Item Master, และ QMS API บน Production
2. **QMS Team Handover & Test:**
   * ส่งไฟล์ `QMS_API_INTEGRATION_GUIDE.md` ให้ทีม QMS เพื่อทดสอบยิง Postman / Code Integration จริง
3. **SAP On-Premise Python Agent Live Sync:**
   * ทดสอบรัน Agent ดึงข้อมูล PO จริงจาก MS SQL ของ SAP B1 เข้าสู่ระบบ IRM
4. **End-to-End Workflow Validation:**
   * ทดสอบวงจรเต็ม: SAP Ingest ➔ ส่ง Email Supplier ➔ Supplier ตอบกลับผ่าน Portal ➔ PU Accept ในหน้า Operation ➔ แสดงผลบน Calendar ➔ QMS ดึงข้อมูลไปใช้งาน
