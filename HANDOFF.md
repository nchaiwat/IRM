# 📌 IRM System — HANDOFF & PROGRESS LOG

> **วันที่บันทึก:** 3 กันยายน 2026  
> **สถานะโครงการ:** Production-Ready & Feature Complete (`https://irm.windowasia.com`)  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **VPS Hostinger Path:** `/var/www/Irm`

---

## 🎯 1. ภาพรวมระบบ (System Overview)

ระบบ **IRM (Incoming Raw Material Management System)** ของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) ได้รับการพัฒนาจนสมบูรณ์ครบถ้วนตามความต้องการของฝ่ายจัดซื้อ ฝ่ายวางแผนการผลิต และฝ่ายคลังสินค้า โดยทำหน้าที่เชื่อมโยงข้อมูล PO วัตถุดิบ 7 กลุ่มหลักจาก **SAP Business One** ส่งต่อให้ Supplier ระบุวันส่งมอบผ่าน **Cryptographic Portal**, วางแผนนัดหมายลง **ปฏิทินส่งของ (Calendar)**, พิมพ์ใบตรวจรับสินค้าจริง (**Receiving Checklist**), ส่งต่อข้อมูลให้ระบบ **QMS**, และรองรับการบริหารจัดการตัวตนส่วนกลางผ่าน **Central Identity Management API (SCIM-Like)**

---

## 🏗️ 2. สรุปความคืบหน้าและการพัฒนางานล่าสุด (กันยายน 2026)

### 1) 📅 หน้า Calendar: เพิ่มโหมด "รายปี" (12 เดือน) และ Universal Search
* **สลับโหมดมุมมองได้ทันที:** มีปุ่มสลับระหว่าง **"รายเดือน"** และ **"รายปี"**
  * **โหมดรายปี:** แสดงการ์ดสรุป 12 เดือนของทั้งปี พร้อมตัวเลขสรุปยอด Confirmed, Estimate, Overdue, และเมทริกซ์จุดมาร์กวันที่มีสินค้าส่งเข้าโรงงาน
* **Universal Search (ค้นหาอเนกประสงค์):**
  * กล่องค้นหาขนาดกะทัดรัด ค้นหาคำค้นใดก็ได้แบบ Real-time (เลขที่ PO, รหัสสินค้า, ชื่อสินค้า, ชื่อคู่ค้า) ครอบคลุมทั้งปี
  * แสดงผลลัพธ์แบบ Dropdown พร้อมปุ่ม **"ไปที่วัน" (Jump to date)** เพื่อกระโดดไปยังเดือนและเปิด Modal แสดงรายการของวันนั้นทันที

### 2) 📋 หน้า Receiving Checklist: เมนูใหม่สำหรับคลังสินค้าและ รปภ.
* **URL:** `/receiving-checklist` (เมนูลำดับที่ 4 ต่อจาก Calendar)
* **ฟังก์ชันการทำงาน:**
  * สรุปรายการสินค้าที่มีนัดหมายส่งมอบในวันที่เลือก เพื่อให้เจ้าหน้าที่หน้างาน (สโตร์, รปภ., QA) ใช้ตรวจรับของจริง
  * มีช่องให้ตรวจเช็ค, บันทึกทะเบียนรถ, จำนวนรับจริง
  * ปุ่ม **สั่งพิมพ์ (Print-Ready):** จัดฟอร์แมตกระดาษ A4 แนวนอน พร้อมช่องลงชื่อผู้ตรวจรับครบถ้วน

### 3) 🧭 หน้า System Blueprint: ผังการทำงานและพิมพ์เขียวระบบ
* **URL:** `/system-blueprint` (เมนูลำดับที่ 8 ต่อจาก History)
* **เนื้อหา 7 หมวดหมู่ใน 1 หน้าจอ:**
  1. แผนผังการไหลของข้อมูล 5 ขั้นตอน (SAP ➔ Operation ➔ Portal ➔ Calendar ➔ QMS/คลัง)
  2. รายละเอียด 6 โมดูลหลักในระบบ
  3. กฎและเงื่อนไขธุรกิจ (Conditions): สูตรคำนวณวันเตือน $\text{Estimate} - \text{Notify Alert}$, การตัดยอดแบบ FIFO จาก SAP, สิทธิ์ส่งเกิน PO, การ Auto-Archive
  4. ตารางสิทธิ์ผู้ใช้งาน (User Roles Matrix: Admin, PU User, Viewer, Supplier)
  5. ระบบความปลอดภัยของ Token (Weekly Windows, Reuse Logic, 1-Hour Single PO)
  6. ตารางเวลาทำงานอัตโนมัติ (04:00 SAP Sync, 08:00 Mail & Telegram, 08:30 PU Reminder)
  7. กล่อง Prompt ภาษาไทย สำหรับนำไปสร้าง Slide Presentation และ Infographic ผ่าน AI

### 4) 🔐 ปรับปรุงระบบ Token Portal: Reuse Token ในรอบเดียวกัน
* **การคำนวณอายุตามรอบ PRD:**
  * รอบวันจันทร์ 08:00 น. ➔ หมดอายุ **คืนวันพุธ 23:59:59 น.**
  * รอบวันพฤหัสบดี 08:00 น. ➔ หมดอายุ **คืนวันอาทิตย์ 23:59:59 น.**
* **Reuse Token Logic:** เมื่อฝ่ายจัดซื้อส่งอีเมลซ้ำ หรือกด Copy Link ในรอบเดียวกัน ระบบจะ **ใช้ Token และ URL เดิม** ไม่ตัดสิทธิ์หรือทำให้ลิงก์เดิมในอีเมลเสีย ทำให้ทุกช่องทางเปิดเข้าหน้าเดียวกันได้ทั้งหมด
* **Single-PO Token:** ลิงก์ด่วนราย PO สำหรับส่งทาง Line มีอายุ 1 ชั่วโมง และ Reuse เช่นกัน

### 5) 📦 กฎความปลอดภัย Item Master & Supplier Master (Append-Only)
* **ไม่มีการลบข้อมูล:** ทั้ง Item Master และ Supplier Master จะสะสมข้อมูลเพิ่มขึ้นเรื่อยๆ ไม่มีการลบออกหรือลดลง
* **เมื่อข้อมูลจาก SAP ตรงกับรายการเดิมใน Item Master:**
  * **ไม่แตะต้องและไม่อัปเดตทับ** ทั้ง `lead_time_days` และ `notify_alert_days` (คงค่าเดิมที่จัดซื้อตั้งไว้ 100%)
  * กำหนด `is_new = False` ถือว่าข้อมูลนั้นไม่ใหม่ ไม่ต้องแสดงป้ายเตือนสินค้าใหม่
* **Supplier Master:** คงค่าการติดต่อและสิทธิ์ส่งเกิน PO (`allow_over_delivery`) เดิมไว้เสมอ

### 6) 🗂️ การจัดเรียงลำดับเมนูใหม่อย่างเป็นทางการ (Official Menu Order)
1. **Dashboard** (`/dashboard`)
2. **Operation** (`/operation`)
3. **Calendar** (`/calendar`)
4. **Receiving Checklist** (`/receiving-checklist`)
5. **Item Master** (`/items`)
6. **Supplier Master** (`/suppliers`)
7. **History** (`/history`)
8. **System Blueprint** (`/system-blueprint`)
9. **Admin** (`/admin/settings`, `/admin/users`, `/admin/groups`, `/admin/auth-matrix`, `/admin/logs`)

### 7) 🔑 Central Identity Management API (SCIM-Like) & PRD
* วางระบบ API สำหรับ Central IAM App เข้ามาควบคุมผู้ใช้:
  * `GET /api/v1/directory/accounts` (Reconciliation)
  * `PATCH /api/v1/directory/accounts/{username}/status` (Instant Offboarding)
* เอกสารมาตรฐาน API: [docs/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md](file:///d:/Python/IRM/docs/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md)
* จัดทำเอกสารข้อกำหนดระบบกลางไว้ที่: `D:\Python\Central-IAM\PRD.md`

---

## 📂 3. โครงสร้างไฟล์สำคัญ (Key Files Reference)

| ไฟล์ (File Path) | หน้าที่ / การทำงาน |
| :--- | :--- |
| [`frontend/src/app/(dashboard)/calendar/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/calendar/page.tsx) | ปฏิทินรอบส่งของ โหมดรายเดือน, รายปี (12 เดือน), และ Universal Search |
| [`frontend/src/app/(dashboard)/receiving-checklist/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/receiving-checklist/page.tsx) | ใบตรวจรับสินค้าประจำวันสำหรับสโตร์/รปภ. พร้อมโหมดสั่งพิมพ์ A4 แนวนอน |
| [`frontend/src/app/(dashboard)/system-blueprint/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/system-blueprint/page.tsx) | พิมพ์เขียวระบบ IRM ครบวงจร พร้อมกล่องคัดลอก AI Prompts ภาษาไทย |
| [`frontend/src/components/layout/Sidebar.tsx`](file:///d:/Python/IRM/frontend/src/components/layout/Sidebar.tsx) | แถบเมนูด้านซ้าย เรียงลำดับเมนูตามมาตรฐานทางการ |
| [`backend/app/services/email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py) | ระบบส่งอีเมลคู่ค้า และคำนวณอายุ Token ตามรอบสัปดาห์พร้อมกลไก Reuse |
| [`backend/app/routers/operation.py`](file:///d:/Python/IRM/backend/app/routers/operation.py) | หน้า Operation, การแตกงวดส่ง, Single-PO Token อายุ 1 ชม. พร้อมกลไก Reuse |
| [`backend/app/services/sap_service.py`](file:///d:/Python/IRM/backend/app/services/sap_service.py) | ซิงค์ข้อมูล SAP B1 และคงค่าเดิมของ ItemMaster (Lead Time, Notify Alert) |
| [`backend/app/routers/central_management.py`](file:///d:/Python/IRM/backend/app/routers/central_management.py) | Central Identity Management API (SCIM-Like) สำหรับ Reconcile และ Instant Offboard |
| [`docs/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md`](file:///d:/Python/IRM/docs/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md) | ข้อกำหนดมาตรฐาน API สำหรับการเชื่อมต่อ Central IAM |
| `D:\Python\Central-IAM\PRD.md` | พิมพ์เขียวและข้อกำหนดความต้องการระบบของแอปพลิเคชัน Central IAM |

---

## 🚀 4. คำสั่งอัปเดตระบบบน VPS Hostinger (`/var/www/Irm`)

```bash
cd /var/www/Irm
git pull origin main
docker compose up -d --build
```
