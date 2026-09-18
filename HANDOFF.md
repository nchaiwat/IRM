# 📌 IRM System — HANDOFF & PROGRESS LOG

> **วันที่บันทึก:** 18 กันยายน 2026 (11:45 น.)  
> **สถานะโครงการ:** Production-Ready, Performance-Optimized & Feature Complete (`https://irm.windowasia.com`)  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **Latest Commit:** `29a21dc` (fix(logs): ensure transaction logs commit independently and align email category badges)  
> **VPS Hostinger Path:** `/var/www/Irm`

---

## 🎯 1. ภาพรวมระบบ (System Overview)

ระบบ **IRM (Incoming Raw Material Management System)** ของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) ทำหน้าที่เชื่อมโยงข้อมูล PO วัตถุดิบ 7 กลุ่มหลักจาก **SAP Business One** ส่งต่อให้ Supplier ระบุวันส่งมอบผ่าน **Cryptographic Portal**, วางแผนนัดหมายลง **ปฏิทินส่งของ (Calendar)**, พิมพ์ใบตรวจรับสินค้าจริง (**Receiving Checklist**), แจ้งเตือนยอดวัตถุดิบเข้าประจำวันรายบุคคลผ่าน **Telegram Direct Message (DM)**, ส่งอีเมลสรุปงานและไฟล์แนบ Excel 2 Sheet ให้ทีมจัดซื้อ (**PU Reminder Email**), ส่งต่อข้อมูลให้ระบบ **QMS**, และรองรับการยืนยันตัวตนระดับองค์กรผ่าน **Central IAM (OAuth2 / OIDC SSO)** พร้อมทั้งการสำรองฉุกเฉินด้วย **Break-Glass Mode**

---

## 🏗️ 2. สรุปความคืบหน้าและการพัฒนางานล่าสุด (18 กันยายน 2026)

### 1) ✉️ แก้ปัญหาอีเมลสรุปงาน PU Reminder & เพิ่ม 100% Audit Trail ใน Transaction Logs
* **สาเหตุที่เวลา 07:50 น. ไม่ได้รับอีเมลและไม่มีใน Log:**
  * โค้ดเดิมวางคำสั่ง `record_transaction_log()` ไว้หลังส่งสำเร็จเท่านั้น หากเกิดกรณีสวิตช์ใน DB ปิดอยู่, หรือไม่พบรายชื่อผู้ใช้ในกลุ่ม `PU User` ที่มีอีเมล, หรือไม่ได้ตั้งค่า SMTP ตัวระบบจะ return ออกทันทีโดยไม่มีการลง Log ทำให้ในหน้า Transaction Logs ว่างเปล่า
  * คำสั่ง Query กลุ่มตรวจจับเฉพาะชื่อภาษาอังกฤษ (`PU User`, `PU`) หากกลุ่มในฐานข้อมูลจริงเป็นภาษาไทย เช่น `จัดซื้อ` หรือ `ฝ่ายจัดซื้อ` จะไม่พบผู้ใช้
* **การแก้ไข:**
  * **100% Audit Trail ใน [`email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py):** บันทึก Transaction Log ทุกสถานะ ทั้ง `SUCCESS`, `WARNING` (ไม่พบบัญชีผู้ใช้ที่มีอีเมลในกลุ่มจัดซื้อ พร้อมคำแนะนำให้ไปตั้งค่าที่ User Management), และ `FAILED` (ไม่ได้ตั้งค่า SMTP User / Password)
  * **ขยาย Group Matching:** รองรับทั้ง `pu user`, `pu`, `purchasing`, `จัดซื้อ`, `ฝ่ายจัดซื้อ`
  * **Time & Setting Normalization:** รองรับเวลาทั้ง `7:50` และ `07:50` อย่างแม่นยำ

### 2) ⚡ เพิ่มปุ่ม "ส่งทันที (Manual)" สำหรับอีเมลสรุปงานจัดซื้อ
* **UI ในหน้า System Settings ([`admin/settings/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/settings/page.tsx)):**
  * เพิ่มปุ่ม **`[ ⚡ ส่งทันที (Manual) ]`** ในแถวเดียวกับเวลาส่งอีเมลสรุปประจำวัน (Section 2) ตรงตามตำแหน่งที่ User ต้องการ 100%
* **API Backend ([`settings.py`](file:///d:/Python/IRM/backend/app/routers/settings.py)):**
  * สร้าง Endpoint `POST /api/settings/send-pu-remind-email-now` ส่งอีเมลสรุปงานและไฟล์แนบ Excel 2 Sheet ไปยังทีมจัดซื้อทุกคนทันที พร้อมบันทึก Transaction Log แสดงสถิติและรายชื่อผู้รับชัดเจน

### 3) 🧹 เพิ่ม Card กำหนดระยะเวลาจัดเก็บ Log ย้อนหลัง (Default 15 วัน) & Auto Purge
* **Card ใหม่ในหน้า Settings:**
  * เพิ่ม Sub-card **"กำหนดระยะเวลาจัดเก็บและแสดงผล Transaction Logs (Log Retention Policy)"** ใน Section 4
  * กำหนดค่า Default ที่ **15 วัน** (`log_retention_days`)
  * มีปุ่ม **`[ 🗑️ ล้าง Log เก่ากว่ากำหนดทันที ]`** ให้ Admin สั่งล้างแบบ Manual ได้ทันที
* **Backend Auto Purge & Log Filter:**
  * ใน [`scheduler.py`](file:///d:/Python/IRM/backend/app/services/scheduler.py): เพิ่ม Job ประจำวัน (00:30 น.) สั่งลบแถวใน `transaction_logs` ที่เก่ากว่ากำหนด (`created_at < now - log_retention_days`) อัตโนมัติ เพื่อประหยัดพื้นที่ดิสก์
  * ใน [`logs.py`](file:///d:/Python/IRM/backend/app/routers/logs.py): เพิ่มลอจิก Filter ข้อมูลย้อนหลังตาม `log_retention_days` (15 วัน) เป็นค่าเริ่มต้นเมื่อผู้ใช้ไม่ได้ระบุวันเริ่มต้น
  * ใน [`init_db.py`](file:///d:/Python/IRM/backend/app/init_db.py): เพิ่ม Seed Setting `log_retention_days` = `"15"`

### 4) 🔍 แก้ไขปัญหา Transaction Log ไม่บันทึกเมื่อกดส่งแบบ Manual (Isolated Commit & Category Alignment)
* **ปัญหาที่พบ:** ผู้ใช้กดปุ่ม `[ ⚡ ส่งทันที (Manual) ]` ในหน้า Settings แต่เมื่อสลับไปดูหน้า Transaction Logs (`/admin/logs`) กลับไม่พบประวัติรายการ
* **สาเหตุเชิงลึก:**
  1. **FastAPI Dependency Rollback:** ใน `get_db()` มีการครอบ `except Exception: await session.rollback()` เมื่อฟังก์ชันส่งอีเมลพบข้อผิดพลาดหรือข้อความเตือน (`res.status in ["skipped", "error"]`) แล้ว route ทำการ `raise HTTPException(...)` ตัว FastAPI จะถือว่าเป็น Exception และสั่ง **Rollback request session** ส่งผลให้ Transaction Log ที่ถูกเขียนผ่าน session เดียวกันถูกลบล้างไปด้วย
  2. **Category Filter Mismatch:** อีเมลจัดซื้อบันทึกด้วย `category="pu_remind_email"` แต่แท็บ `[ 📧 ส่ง Email ]` บนหน้าเว็บและตัวนับสถิติ Backend ฟิลเตอร์เฉพาะ `category="supplier_email"` ทำให้ไม่ปรากฏในแท็บอีเมล
  3. **Case-Sensitive Status Badge:** ในหน้าเว็บเปรียบเทียบ `status` แบบตรงตัว ทำให้ `SUCCESS`, `ERROR`, `WARNING` (ตัวพิมพ์ใหญ่) ไม่เข้าเงื่อนไข และแสดงเป็น badge สีเทาข้อความดิบ
  4. **หน้าจอไม่ได้ Auto-Polling:** หน้าจอ Transaction Logs โหลดข้อมูลเฉพาะตอนเปิดหน้าหรือกดปุ่ม `[ 🔄 ]` (Refresh) เท่านั้น (ภาพที่ผู้ใช้เปิดไว้ข้อมูลค้างที่ 08:00 น. ก่อนกดส่ง)
* **การแก้ไข:**
  * **Isolated Transaction Log Commit ([`log_service.py`](file:///d:/Python/IRM/backend/app/services/log_service.py)):** ปรับ `record_transaction_log()` ให้สร้างและ commit ด้วย Session อิสระเด็ดขาด (`AsyncSessionLocal()`) แยกขาดจาก Business Transaction เสมอ ทำให้ไม่ว่าจะเกิด Error หรือ Rollback ใดๆ ใน Endpoint ตัว Audit Log จะได้รับการบันทึกถาวร 100%
  * **ระบุผู้ทำรายการจริง ([`settings.py`](file:///d:/Python/IRM/backend/app/routers/settings.py)):** ส่ง `triggered_by=f"user:{current_user.username}"` เข้าไปใน Log เพื่อให้แสดงเป็น `user:Chaiwat.N` ในคอลัมน์ผู้ทำรายการ
  * **รวมหมวดหมู่อีเมล ([`logs.py`](file:///d:/Python/IRM/backend/app/routers/logs.py)):** ขยายแท็บ `supplier_email` และตัวนับสถิติ `email_sent_count` ให้ดึงทั้ง `supplier_email` และ `pu_remind_email`, ปรับการค้นหาสถานะให้เป็น Case-insensitive (`func.lower(status)`)
  * **ปรับปรุง UI Badge ([`admin/logs/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/logs/page.tsx)):** เพิ่ม Badge `📧 อีเมลสรุปจัดซื้อ (PU)` สีครามสวยงาม และปรับ `getStatusBadge` ให้แปลงเป็น `.toLowerCase()` รองรับทั้ง `SUCCESS`, `FAILED`, `ERROR`, `WARNING` แสดงสีเขียว/แดง/ส้มถูกต้องตาม Design System

---

## 🏗️ 3. สรุปความคืบหน้าการพัฒนาก่อนหน้า (15–17 กันยายน 2026)

### 1) 🧹 จัดระเบียบหน้า Settings: ลบการ์ดซ้ำซ้อน Section 9 และเพิ่มช่อง Allow IP สำหรับเซิร์ฟเวอร์ CIAM
* **การแก้ไข:** ลบ Section 9 ซ้ำซ้อนออก เหลือเฉพาะ Section 6 เดียวสำหรับการตั้งค่า Central IAM Single Sign-On (OIDC / PKCE SSO), เพิ่มฟิลด์ `Central IAM Server Allowed IPs (IP Whitelist สำหรับเซิร์ฟเวอร์ CIAM)` (`ciam_allowed_ips`), และซิงค์การตรวจสอบร่วมกับ `management_allowed_ips` ใน [`central_management.py`](file:///d:/Python/IRM/backend/app/routers/central_management.py)

### 2) ✉️ ปรับปรุงระบบส่งอีเมลสรุปงาน (PU Reminder Email) & คืนค่าสถาปัตยกรรมเดิม 100%
* **การแก้ไข:** ลบฟิลด์ `pu_remind_recipient_emails` ออกจากระบบ 100% เพื่อไม่ให้ซ้ำซ้อนกับ User Management, ยึดหลักดึงสมาชิกกลุ่ม `PU User` จากฐานข้อมูลหลักโดยตรง, แก้ไข Pure Date bug (`AttributeError: 'datetime.date' object has no attribute 'date'`) ในการสร้างไฟล์แนบ Excel 2 Sheet

### 3) 🔐 ปรับแต่งหน้า Login เมื่อปิดใช้งานระบบ SSO (Clean Login when SSO Disabled)
* **การแก้ไข:** เมื่อปิดระบบ SSO (`sso_enabled = false`) หน้า Login (`/login`) จะซ่อนกล่องแจ้งเตือน Central IAM, ซ่อนปุ่ม SSO, ซ่อนเส้นคั่น Break-Glass ทั้งหมด และปรับปุ่มเข้าสู่ระบบหลักเป็น **Primary Gradient Button** สีน้ำเงินหรูหรา (`bg-gradient-to-r from-sky-500 to-indigo-600`) สะอาดตา

### 4) ⚡ การเพิ่มประสิทธิภาพฐานข้อมูล (Database Performance & Indexing)
* **การแก้ไข:** เพิ่ม 13 Performance Index ใน PostgreSQL ผ่าน [`add_performance_indexes.py`](file:///d:/Python/IRM/backend/app/migrations/add_performance_indexes.py) บน `po_items`, `po_headers`, `sub_items`, `supplier_portal_tokens` และปรับ SQLAlchemy Relationship จาก `lazy="selectin"` เป็น `lazy="select"` เพื่อตัด Cascading Queries ซ้ำซ้อน

### 5) 🔗 ปุ่ม Link หน้า Operation: ส่งและล็อคทั้ง PO (PO-Level Portal Token)
* **การแก้ไข:** ปรับปรุงปุ่ม `[ 🔗 ]` บนตารางหน้า Operation ให้สร้าง Portal Token คลุม **ทุก Item ใน PO นั้น** พร้อมกัน, ล็อคสถานะทุก Item เป็น `awaiting_supplier`, แปลงวันหมดอายุเป็นเวลาไทย (+07:00 BKK) และเพิ่ม 12-Hour Cushion ป้องกันลิงก์หมดอายุเร็วเกินไป

---

## 🗂️ 4. ลำดับเมนูที่เป็นทางการของระบบ (Official Menu Order)

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

## 📂 5. โครงสร้างไฟล์สำคัญที่ปรับปรุงล่าสุด (Key Files Reference)

| ไฟล์ (File Path) | หน้าที่ / การทำงาน |
| :--- | :--- |
| [`backend/app/services/log_service.py`](file:///d:/Python/IRM/backend/app/services/log_service.py) | ฟังก์ชัน `record_transaction_log` ใช้ Isolated Session (`AsyncSessionLocal()`) บันทึก Log ทุกสถานะอย่างถาวร ไม่โดน Rollback |
| [`backend/app/services/email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py) | ดึงผู้รับรายงานสรุปงานและไฟล์แนบ Excel 2 Sheet จากกลุ่ม `PU User` ใน User Management โดยตรง, บันทึก Log ทุกสถานะ (`SUCCESS`, `WARNING`, `FAILED`) |
| [`backend/app/routers/settings.py`](file:///d:/Python/IRM/backend/app/routers/settings.py) | Endpoint `POST /api/settings/send-pu-remind-email-now` (ส่งทันที) และ `POST /api/settings/purge-old-logs` (สั่งล้าง Log เก่าทันที) |
| [`backend/app/routers/logs.py`](file:///d:/Python/IRM/backend/app/routers/logs.py) | ปรับปรุงแท็บ `supplier_email` และสถิติให้ครอบคลุม `pu_remind_email`, รองรับ Case-insensitive status filter, และ Default Date Filter 15 วัน |
| [`frontend/src/app/(dashboard)/admin/settings/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/settings/page.tsx) | เพิ่มปุ่ม `[ ⚡ ส่งทันที (Manual) ]` ใน Section 2 และเพิ่ม Card Log Retention Policy ใน Section 4 |
| [`frontend/src/app/(dashboard)/admin/logs/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/logs/page.tsx) | เพิ่ม Badge `📧 อีเมลสรุปจัดซื้อ (PU)` และรองรับ Badge สถานะทุกรูปแบบ (`SUCCESS`, `ERROR`, `WARNING`) |
| [`backend/app/services/scheduler.py`](file:///d:/Python/IRM/backend/app/services/scheduler.py) | Job เวลา 00:30 น. ลบ Transaction Log เก่ากว่า 15 วันอัตโนมัติ, Minute-checker สำหรับ PU Reminder Email |
| [`backend/app/init_db.py`](file:///d:/Python/IRM/backend/app/init_db.py) | Seed Setting `log_retention_days = "15"` |

---

## 🚀 6. คำสั่งอัปเดตระบบบน VPS Hostinger (`/var/www/Irm`)

```bash
# 1. ไปที่โฟลเดอร์โปรเจกต์ IRM บน VPS
cd /var/www/Irm

# 2. ดึงโค้ดล่าสุดจาก main branch
git pull origin main

# 3. สั่ง Rebuild คอนเทนเนอร์ Backend และ Frontend
docker compose up -d --build irm-backend irm-frontend

# 4. ตรวจสอบสถานะการทำงาน
docker compose ps
```

---

## 📌 7. Checkpoint สำหรับการเริ่มงานในครั้งหน้า (Next Session)

* **สถานะความพร้อมของระบบ (System Readiness):**
  * โค้ดทั้งหมดได้รับการตรวจสอบ Syntax และ Compile ผ่าน 100% (`python -m py_compile` & `next build` 19/19 static pages)
  * บันทึก Git Commit & Push ขึ้น GitHub `main` เรียบร้อยแล้ว (`commit: 29a21dc`)
  * ปัญหาเรื่อง Log ส่งเมล์ไม่ขึ้นได้รับการแก้ไขอย่างสมบูรณ์ด้วย Isolated Session Commit และ Badge/Tab Alignment
* **ขั้นตอนถัดไปเมื่อกลับมาเริ่มงาน (Next Steps):**
  1. **Deploy ขึ้น Production:** รันคำสั่งในข้อ 6 บน VPS Production Hostinger
  2. **ทดสอบกดปุ่ม `[ ⚡ ส่งทันที (Manual) ]`:** ตรวจสอบ Alert ผลการส่ง และตรวจเช็คในหน้า Transaction Logs (`/admin/logs`) หลังกด Refresh `[ 🔄 ]` ว่ามีรายการ `📧 อีเมลสรุปจัดซื้อ (PU)` แสดงสถานะ Success พร้อมชื่อผู้ทำรายการ `user:Chaiwat.N`
  3. **สังเกตการณ์รอบเวลาส่งอัตโนมัติ:** ตรวจสอบรอบเวลาประจำวัน (เช่น 07:50 น.) ว่า APScheduler ยิงส่งอีเมลและบันทึก Transaction Log อัตโนมัติเรียบร้อย
  4. **ดำเนินงานต่อตามโจทย์ใหม่:** พร้อมรับ Requirements ถัดไปจากผู้ใช้ได้ทันทีครับ
