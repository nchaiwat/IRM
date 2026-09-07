# 📌 IRM System — HANDOFF & PROGRESS LOG

> **วันที่บันทึก:** 7 กันยายน 2026  
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

### 9) 🔑 Central Identity Management API (SCIM-Like)
* พัฒนาระบบ API สำหรับ Central IAM เข้ามาควบคุมผู้ใช้งานในระบบ IRM ครบทั้ง 3 Endpoint:
  * `GET /api/v1/directory/accounts` — ดึงบัญชีทั้งหมดไปทำ Inventory / Reconciliation
  * `PATCH /api/v1/directory/accounts/{username}/status` — สั่งระงับสิทธิ์พนักงานลาออกทันที (Instant Offboarding)
  * `POST /api/v1/directory/accounts` — สั่งสร้างบัญชีผู้ใช้งานใหม่แบบ Real-time (Account Provisioning)

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
| [`backend/app/services/telegram_service.py`](file:///d:/Python/IRM/backend/app/services/telegram_service.py) | ระบบส่ง Telegram Alert, Morning Summary, และ Daily Inbound DM รายบุคคลตาม Item Groups พร้อมกลไก Detailed Error Diagnostics & HTML Escaping |
| [`backend/app/services/scheduler.py`](file:///d:/Python/IRM/backend/app/services/scheduler.py) | Background Cron Job ตรวจสอบรอบเวลาซิงค์ SAP (06:45), อีเมลแจ้งเตือน (08:00), และ Telegram DM รายบุคคล (07:30) |
| [`backend/app/routers/settings.py`](file:///d:/Python/IRM/backend/app/routers/settings.py) | API จัดการ System Settings, การทดสอบ Telegram Group, Morning Summary, และ Simulation DM |
| [`backend/app/routers/users.py`](file:///d:/Python/IRM/backend/app/routers/users.py) | API บริหารจัดการผู้ใช้งาน รองรับ `telegram_inbound_notify` และ `allowed_item_groups` |
| [`frontend/src/app/(dashboard)/admin/users/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/users/page.tsx) | หน้าจัดการ User พร้อม Multi-select Checkboxes กลุ่มสินค้า และสวิตช์เปิดรับ Telegram DM |
| [`frontend/src/app/(dashboard)/admin/settings/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/settings/page.tsx) | หน้า System Settings พร้อม Master Safeguard Switch, กำหนดเวลาส่ง, และปุ่มจำลองการส่ง DM |
| [`frontend/src/app/(dashboard)/calendar/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/calendar/page.tsx) | ปฏิทินรอบส่งของ โหมดรายเดือน, รายปี (12 เดือน), และ Universal Search |
| [`frontend/src/app/(dashboard)/receiving-checklist/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/receiving-checklist/page.tsx) | ใบตรวจรับสินค้าประจำวันสำหรับสโตร์/รปภ. พร้อมโหมดสั่งพิมพ์ A4 แนวนอน |
| [`frontend/src/app/(dashboard)/system-blueprint/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/system-blueprint/page.tsx) | พิมพ์เขียวระบบ IRM ครบวงจร พร้อมกล่องคัดลอก AI Prompts ภาษาไทย |
| [`backend/app/services/email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py) | ระบบส่งอีเมลคู่ค้า และคำนวณอายุ Token ตามรอบสัปดาห์พร้อมกลไก Reuse |
| [`backend/app/routers/operation.py`](file:///d:/Python/IRM/backend/app/routers/operation.py) | หน้า Operation, การแตกงวดส่ง, Single-PO Token อายุ 1 ชม. พร้อมกลไก Reuse |
| [`backend/app/services/sap_service.py`](file:///d:/Python/IRM/backend/app/services/sap_service.py) | ซิงค์ข้อมูล SAP B1 เวลา 06:45 น. และคงค่าเดิมของ ItemMaster (Lead Time, Notify Alert) |
| [`backend/app/routers/central_management.py`](file:///d:/Python/IRM/backend/app/routers/central_management.py) | Central Identity Management API (SCIM-Like) รองรับ `GET`, `PATCH`, และ `POST /accounts` |
| [`backend/app/routers/external_qms.py`](file:///d:/Python/IRM/backend/app/routers/external_qms.py) | QMS Inbound Deliveries Integration API (`GET /api/external/qms/inbound-deliveries`) |
| [`docs/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md`](file:///d:/Python/IRM/docs/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md) | ข้อกำหนดมาตรฐาน API ระดับองค์กรสำหรับการเชื่อมต่อ Central IAM |

---

## 🚀 5. คำสั่งอัปเดตระบบบน VPS Hostinger (`/var/www/Irm`)

```bash
cd /var/www/Irm
git pull origin main
docker compose up -d --build
```
