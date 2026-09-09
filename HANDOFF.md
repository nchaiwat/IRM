# 📌 IRM System — HANDOFF & PROGRESS LOG

> **วันที่บันทึก:** 9 กันยายน 2026  
> **สถานะโครงการ:** Production-Ready & Feature Complete (`https://irm.windowasia.com`)  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **VPS Hostinger Path:** `/var/www/Irm`

---

## 🎯 1. ภาพรวมระบบ (System Overview)

ระบบ **IRM (Incoming Raw Material Management System)** ของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) ได้รับการพัฒนาจนสมบูรณ์ครบถ้วนตามความต้องการของฝ่ายจัดซื้อ ฝ่ายวางแผนการผลิต ฝ่ายคลังสินค้า และฝ่ายประกันคุณภาพ (QC) โดยทำหน้าที่เชื่อมโยงข้อมูล PO วัตถุดิบ 7 กลุ่มหลักจาก **SAP Business One** ส่งต่อให้ Supplier ระบุวันส่งมอบผ่าน **Cryptographic Portal**, วางแผนนัดหมายลง **ปฏิทินส่งของ (Calendar)**, พิมพ์ใบตรวจรับสินค้าจริง (**Receiving Checklist**), แจ้งเตือนยอดวัตถุดิบเข้าประจำวันรายบุคคลผ่าน **Telegram Direct Message (DM)**, ส่งต่อข้อมูลให้ระบบ **QMS**, และรองรับการบริหารจัดการตัวตนส่วนกลางผ่าน **Central Identity Management API (SCIM-Like)**

---

## 🏗️ 2. สรุปความคืบหน้าและการพัฒนางานล่าสุด (กันยายน 2026)

### 1) 📲 ระบบแจ้งเตือนยอดวัตถุดิบขาเข้าประจำวันรายบุคคล (Daily Inbound Telegram DM for Non-PU Staff)
* **วัตถุประสงค์:** แจ้งข้อมูลสินค้าเข้าทุกเช้าให้กับแต่ละหน่วยงานที่ไม่ใช่ PU (เช่น ฝ่ายวางแผนการผลิต/PC, ฝ่ายคลังสินค้า/Store, ฝ่าย QC) ได้รับทราบข้อมูลล่วงหน้าเฉพาะกลุ่มสินค้า (Item Groups) ที่ตนเองรับผิดชอบ
* **ช่องทางการส่ง:** ส่งตรงเข้า **Telegram Direct Message (DM)** ของพนักงานแต่ละคนตาม `telegram_chat_id` ที่บันทึกไว้ใน User Management
* **โครงสร้างข้อความสรุป 3 ส่วน:**
  1. 🚚 **สินค้ามีนัดส่งเข้า "วันนี้" (Today Inbound):** แสดงรหัสสินค้า, จำนวนพร้อมหน่วย, ชื่อสินค้า, และชื่อผู้ขาย (จำกัดการแสดง 6 รายการแรก พร้อมสรุปยอดที่เหลือ)
  2. 📅 **กำหนดส่งใน 7 วันข้างหน้า (Next 7 Days Forecast):** สรุปจำนวนรายการและผลรวมหน่วยส่งมอบทั้งหมดในรอบสัปดาห์
  3. ⚠️ **ค้างส่งเกินกำหนด (Overdue / Pending):** แจ้งเตือนรายการที่เลยกำหนดส่งและยังไม่ได้ยืนยันรับเข้า เพื่อให้ผู้รับผิดชอบเตรียมประสานงานล่วงหน้า
* **ปุ่มลิงก์ท้ายข้อความ:** ลิงก์ตรงเปิดไปยัง **ใบตรวจรับสินค้า (Receiving Checklist)** และ **ปฏิทินรอบส่ง (Calendar)** ของระบบ IRM
* **การรักษาความปลอดภัย (Safeguard) และการตั้งค่าใน System Settings:**
  * มี **Master Switch** เปิด/ปิดระบบ Telegram DM ภาพรวม (ปิดไว้เป็นค่าเริ่มต้นเพื่อความปลอดภัยช่วงเริ่มใช้งาน)
  * กำหนดเวลาส่งข้อความตอนเช้าได้อิสระ (ค่าเริ่มต้น `07:30` น.)
  * เครื่องมือ **จำลองการส่งทดสอบ (Test Simulation):** ให้ Admin สามารถเลือกพนักงานเพื่อจำลองกลุ่มสินค้าที่ดูแล พร้อมช่องกรอก Chat ID ทดสอบ เพื่อยิงข้อความจริงเข้า Telegram ได้ทันทีโดยไม่บันทึกทับข้อมูลในฐานข้อมูล

### 2) 👥 ปรับปรุงหน้า User Management: Multi-select Checkboxes & DM Toggle
* **URL:** `/admin/users`
* **เปลี่ยนช่องกรอกกลุ่มสินค้าเป็น Checkboxes:** แทนที่ช่องกรอกข้อความเดิมด้วย Multi-select Checkboxes ของกลุ่มสินค้ามาตรฐาน 6 กลุ่ม:
  * `RM-กระจก`, `HW`, `SP - Sparepart`, `FG-ALU`, `FG-UPVC`, `FG-Non BOI`
  * พร้อมตัวเลือก **`⭐️ ทุกกลุ่มสินค้า (*)`** เพื่อความสะดวกและลดปัญหาการสะกดชื่อกลุ่มผิด
* **สวิตช์เปิดรับแจ้งเตือน DM:** เพิ่ม Checkbox **"รับสรุปยอดของเข้าประจำวันทาง Telegram (Daily DM)"** ในฟอร์มสร้างและแก้ไขผู้ใช้
* **Status Badge บนตาราง:** แสดงป้ายสถานะ `[ ✈️ DM ]` สีฟ้า สำหรับผู้ที่เปิดรับแจ้งเตือน และ `[ ⏸️ ปิด DM ]` สีเทา สำหรับผู้ที่ปิดไว้

### 3) 🧹 ปรับปรุง UI ตาราง: เอาลูกศรซ้ำซ้อนออก (Clean Table Layout)
* นำลูกศรชี้ลง (`↳` / downward arrows) ในแถวตารางข้อมูล PO Header และ Supplier Name ที่เป็นรายการซ้ำออก
* คงเหลือเฉพาะชื่อ PO และ Supplier แสดงเป็นตัวอักษรเรียบหรู สบายตา ตามหลัก Clean Corporate Light Theme

### 4) 📅 หน้า Calendar: โหมดรายปี (12 เดือน) และ Universal Search
* **สลับโหมดมุมมองได้ทันที:** ปุ่มสลับระหว่าง **"รายเดือน"** และ **"รายปี"**
  * **โหมดรายปี:** แสดงการ์ดสรุป 12 เดือนของทั้งปี พร้อมตัวเลขสรุปยอด Confirmed, Estimate, Overdue, และเมทริกซ์จุดมาร์กวันที่มีสินค้าส่งเข้าโรงงาน
* **Universal Search (ค้นหาอเนกประสงค์):**
  * ค้นหาคำค้นด่วนแบบ Real-time (เลขที่ PO, รหัสสินค้า, ชื่อสินค้า, ชื่อคู่ค้า) ครอบคลุมทั้งปี
  * แสดงผลลัพธ์แบบ Dropdown พร้อมปุ่ม **"ไปที่วัน" (Jump to date)** เพื่อกระโดดไปยังเดือนและเปิด Modal แสดงรายการของวันนั้นทันที

### 5) 📋 หน้า Receiving Checklist: ใบตรวจรับสำหรับสโตร์/รปภ.
* **URL:** `/receiving-checklist` (เมนูลำดับที่ 4 ต่อจาก Calendar)
* สรุปรายการสินค้าที่มีนัดหมายส่งมอบในวันที่เลือก เพื่อให้สโตร์, รปภ., QA ตรวจรับของจริง
* บันทึกผลการตรวจเช็ค, ทะเบียนรถ, จำนวนรับจริง พร้อมปุ่ม **สั่งพิมพ์ A4 แนวนอน (Print-Ready)**

### 6) 🧭 หน้า System Blueprint: ผังระบบและพิมพ์เขียวองค์กร
* **URL:** `/system-blueprint` (เมนูลำดับที่ 8 ต่อจาก History)
* แผนผังการไหลของข้อมูล 5 ขั้นตอน (SAP ➔ Operation ➔ Portal ➔ Calendar ➔ QMS/คลัง), กฎเงื่อนไขการตัดยอด FIFO, สิทธิ์บทบาทหน้าที่ และกล่องคัดลอก AI Prompts ภาษาไทย

### 7) 🔐 ปรับปรุงระบบ Token Portal: Reuse Token ในรอบเดียวกัน
* **การคำนวณอายุตามรอบ PRD:**
  * รอบวันจันทร์ 08:00 น. ➔ หมดอายุ **คืนวันพุธ 23:59:59 น.**
  * รอบวันพฤหัสบดี 08:00 น. ➔ หมดอายุ **คืนวันอาทิตย์ 23:59:59 น.**
* **Reuse Token Logic:** เมื่อส่งอีเมลซ้ำ หรือกด Copy Link ในรอบเดียวกัน ระบบจะ **ใช้ Token และ URL เดิม** ไม่ทำให้ลิงก์เดิมเสีย
* **Single-PO Token:** ลิงก์ด่วนราย PO สำหรับส่งทาง Line มีอายุ 1 ชั่วโมง (และ Reuse เช่นกัน)

### 8) 📦 กฎความปลอดภัย Item Master & Supplier Master (Append-Only)
* ทั้ง Item Master และ Supplier Master จะสะสมข้อมูลเพิ่มขึ้นเรื่อยๆ ไม่มีการลบออกเด็ดขาด
* เมื่อข้อมูลจาก SAP ตรงกับรายการเดิมใน Item Master:
  * **ไม่แตะต้องและไม่อัปเดตทับ** ทั้ง `lead_time_days` และ `notify_alert_days` (คงค่าเดิม 100%)
  * กำหนด `is_new = False` เมื่อพ้นวันหรือเป็นสินค้าเดิม

### 10) 🗓️ สถาปัตยกรรมวันที่บริสุทธิ์ (Pure Date Standard) & มาตรฐาน dd/mm/yyyy ทั้งระบบ
* **ที่มาและปัญหาเดิม (UTC Discrepancy):**
  * ข้อมูลวันที่ส่งมอบ (`estimate_date`, `due_date`, `po_date`) เดิมจัดเก็บเป็น `TIMESTAMPTZ` (UTC) ใน PostgreSQL
  * เมื่อ Frontend ส่งเวลาเที่ยงคืนไทย `2026-09-08 00:00:00+07` ฐานข้อมูลแปลงเป็น `2026-09-07 17:00:00 UTC` เมื่อเรียกผ่าน `.strftime("%Y-%m-%d")` หรือส่งต่อไปยัง Frontend โดยไม่มี Timezone Offset วันที่จะถอยหลังไป 1 วัน (กลายเป็น 07/09/2026) ส่งผลให้ในปฏิทิน Calendar และการประเมินสถานะ Overdue ผิดพลาด
* **การแก้ไขด้วยแนวทาง Pure Date (Option 1):**
  * **Database Type Migration (`init_db.py`):** แปลงประเภทคอลัมน์ `po_items.estimate_date`, `po_items.due_date`, `sub_items.estimate_date`, และ `po_headers.po_date` ใน PostgreSQL ให้เป็น **`DATE`** บริสุทธิ์ (ไม่มีเวลาและ Timezone) โดยใช้คำสั่ง `USING (column AT TIME ZONE 'Asia/Bangkok')::date` เพื่อให้ข้อมูลเดิมทั้งหมดถูกแปลงกลับมาเป็นวันที่ตามเวลาประเทศไทยตรงเป๊ะ ไม่เลื่อนถอยหลัง 1 วัน
  * **SQLAlchemy & Pydantic Models:** ปรับ Type เป็น `Date` และ `datetime.date` ส่งสตริงวันที่รูปแบบมาตรฐาน `YYYY-MM-DD` บริสุทธิ์
  * **Backend Services & Routers:**
    * `calendar.py`: จัดส่ง Event Date เป็น `YYYY-MM-DD` แน่นอน ไม่เกิด Timezone Drift
    * `receiving_checklist.py` & `dashboard.py`: คำนวณสถานะ Overdue, OTIF, และ 14-day Delivery Forecast โดยยึดวันปัจจุบัน (`today_date`) ในเวลา `Asia/Bangkok`
    * `qms_integration.py`: ส่ง `delivery_date` และ `po_date` แบบ Pure Date ป้องกันความผิดพลาดของระบบภายนอก
    * `sap_service.py`: ดึง `po_date` และ `due_date` จาก SAP แปลงเป็น Pure Date สะอาดทันทีก่อนบันทึก
    * `email_service.py` & `telegram_service.py`: คำนวณวันหมดอายุ PRD Token และแสดงผลวันที่โดยอิงเวลาประเทศไทยอย่างแม่นยำ
* **มาตรฐานการแสดงผล `dd/mm/yyyy` ครบทุกหน้าจอ:**
  * หน้า **Operation**, **Calendar**, **Receiving Checklist**, **History**, **Item Master**, **Supplier Master**, และ **Supplier Portal** แสดงผลวันที่ทั้งหมดในรูปแบบ **`dd/mm/yyyy`** (เช่น `08/09/2026`) อย่างสม่ำเสมอ
  * ฟังก์ชันแปลงวันที่ (`formatDateThai`, `formatDateDisplay`) ตรวจจับ Regex `YYYY-MM-DD` และสลับเป็น `dd/mm/yyyy` โดยตรง ไม่ผ่านการ parse UTC ที่อาจเกิด Timezone Shift
  * ช่องกรอกวันที่ (Date Masking Input) รองรับการพิมพ์และจัดรูปแบบ `dd/mm/yyyy` พร้อมแปลงเป็น `YYYY-MM-DD` สำหรับส่งไปยัง Backend
  * วันเวลาที่อัปเดตและ Audit Logs แสดงเป็น `dd/mm/yyyy hh:mm` (ค.ศ.) คงความเป็นเอกภาพทั่วทั้งระบบ

---

## 🗂️ 3. ลำดับเมนูที่เป็นทางการของระบบ (Official Menu Order)

1. **Dashboard** (`/dashboard`)
2. **Operation** (`/operation`)
3. **Calendar** (`/calendar`)
4. **Receiving Checklist** (`/receiving-checklist`)
5. **Item Master** (`/items`)
6. **Supplier Master** (`/suppliers`)
7. **History** (`/history`)
8. **System Blueprint** (`/system-blueprint`)
9. **Admin** (`/admin/settings`, `/admin/users`, `/admin/groups`, `/admin/auth-matrix`, `/admin/logs`)

---

## 📂 4. โครงสร้างไฟล์สำคัญ (Key Files Reference)

| ไฟล์ (File Path) | หน้าที่ / การทำงาน |
| :--- | :--- |
| [`backend/app/init_db.py`](file:///d:/Python/IRM/backend/app/init_db.py) | รัน Database Migration อัตโนมัติ แปลงคอลัมน์วันที่เป็น pure `DATE` ด้วย `AT TIME ZONE 'Asia/Bangkok'` |
| [`backend/app/models/po.py`](file:///d:/Python/IRM/backend/app/models/po.py) | โมเดล SQLAlchemy กำหนด `po_date`, `due_date`, `estimate_date` เป็น `Date` |
| [`backend/app/schemas/po.py`](file:///d:/Python/IRM/backend/app/schemas/po.py) | Pydantic Schemas กำหนด Data Type ของวันที่เป็น pure `date` (`YYYY-MM-DD`) |
| [`backend/app/routers/calendar.py`](file:///d:/Python/IRM/backend/app/routers/calendar.py) | API ปฏิทินส่งของ พร้อมระบบ Universal Search และส่ง Event Date แบบ `YYYY-MM-DD` |
| [`backend/app/routers/receiving_checklist.py`](file:///d:/Python/IRM/backend/app/routers/receiving_checklist.py) | API ใบตรวจรับสินค้าประจำวัน ตรวจสอบ Overdue เทียบกับเวลาประเทศไทย |
| [`backend/app/routers/dashboard.py`](file:///d:/Python/IRM/backend/app/routers/dashboard.py) | API คำนวณ KPI ภาพรวม, OTIF, Overdue, และ 14-day Delivery Forecast บนเวลาไทย |
| [`backend/app/services/telegram_service.py`](file:///d:/Python/IRM/backend/app/services/telegram_service.py) | ระบบส่ง Telegram Alert, Morning Summary, และ Daily Inbound DM รายบุคคลตาม Item Groups |
| [`backend/app/services/scheduler.py`](file:///d:/Python/IRM/backend/app/services/scheduler.py) | Background Cron Job ตรวจสอบรอบเวลาซิงค์ SAP (06:45), อีเมลแจ้งเตือน (08:00), และ Telegram DM รายบุคคล (07:30) |
| [`backend/app/services/email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py) | ระบบส่งอีเมลคู่ค้า คำนวณอายุ Token ตามรอบสัปดาห์ (23:59:59 BKK) พร้อมกลไก Reuse |
| [`backend/app/routers/operation.py`](file:///d:/Python/IRM/backend/app/routers/operation.py) | หน้า Operation, การแตกงวดส่ง, Single-PO Token อายุ 1 ชม. พร้อมกลไก Reuse |
| [`backend/app/services/sap_service.py`](file:///d:/Python/IRM/backend/app/services/sap_service.py) | ซิงค์ข้อมูล SAP B1 เวลา 06:45 น., แปลงวันที่เป็น `date` สะอาด, คงค่าเดิม Item Master |
| [`backend/app/routers/central_management.py`](file:///d:/Python/IRM/backend/app/routers/central_management.py) | Central Identity Management API (SCIM-Like) รองรับ `GET`, `PATCH`, และ `POST /accounts` |
| [`backend/app/routers/external_qms.py`](file:///d:/Python/IRM/backend/app/routers/external_qms.py) | QMS Inbound Deliveries Integration API (`GET /api/external/qms/inbound-deliveries`) |
| [`frontend/src/app/(dashboard)/operation/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/operation/page.tsx) | หน้า Operation รองรับกรอก/แสดงผล `dd/mm/yyyy`, คำนวณ Overdue เที่ยงคืนไทย |
| [`frontend/src/app/(dashboard)/calendar/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/calendar/page.tsx) | ปฏิทินรอบส่งของ โหมดรายเดือน, รายปี (12 เดือน), Universal Search, และ Badge `dd/mm/yyyy` |
| [`frontend/src/app/(dashboard)/receiving-checklist/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/receiving-checklist/page.tsx) | ใบตรวจรับสินค้าประจำวันสำหรับสโตร์/รปภ. พร้อมโหมดสั่งพิมพ์ A4 แนวนอน |
| [`docs/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md`](file:///d:/Python/IRM/docs/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md) | ข้อกำหนดมาตรฐาน API ระดับองค์กรสำหรับการเชื่อมต่อ Central IAM |

---

## 🚀 5. คำสั่งอัปเดตระบบบน VPS Hostinger (`/var/www/Irm`)

```bash
cd /var/www/Irm

# 1. ดึงโค้ดล่าสุดจาก main branch
git pull origin main

# 2. Rebuild และ Restart คอนเทนเนอร์ irm-backend และ irm-frontend
docker compose up -d --build irm-backend irm-frontend

# 3. ตรวจสอบสถานะการทำงาน
docker compose ps
```
