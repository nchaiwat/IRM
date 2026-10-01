# 📌 IRM System — HANDOFF & PROGRESS LOG

> **วันที่บันทึก:** 1 ตุลาคม 2026 (12:00 น.)  
> **สถานะโครงการ:** Production-Ready, Performance-Optimized & Feature Complete (`https://irm.windowasia.com`)  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **Latest Commit:** `754323e` (fix(suppliers): allow clearing email and contact fields to null/blank in update_supplier)  
> **VPS Hostinger Path:** `/var/www/Irm`  

---

## 🎯 1. ภาพรวมระบบ (System Overview)

ระบบ **IRM (Incoming Raw Material Management System)** ของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) ทำหน้าที่เชื่อมโยงข้อมูล PO วัตถุดิบ 7 กลุ่มหลักจาก **SAP Business One** ส่งต่อให้ Supplier ระบุวันส่งมอบผ่าน **Cryptographic Portal**, วางแผนนัดหมายลง **ปฏิทินส่งของ (Calendar)**, พิมพ์ใบตรวจรับสินค้าจริง (**Receiving Checklist**), แจ้งเตือนยอดวัตถุดิบเข้าประจำวันรายบุคคลผ่าน **Telegram Direct Message (DM)**, ส่งอีเมลสรุปงานและไฟล์แนบ Excel 2 Sheet ให้ทีมจัดซื้อ (**PU Reminder Email**), ส่งต่อข้อมูลให้ระบบ **QMS**, และรองรับการยืนยันตัวตนระดับองค์กรผ่าน **Central IAM (OAuth2 / OIDC SSO)** พร้อมทั้งการสำรองฉุกเฉินด้วย **Break-Glass Mode**

---

## 🏗️ 2. สรุปความคืบหน้าและการพัฒนางานล่าสุด (1 ตุลาคม 2026)

### 1) 🔐 มาตรฐาน Step 0 Guard สำหรับ Central IAM SSO Callback (Commit `704b646`)
* **ปัญหาเดิม:** เมื่อผู้ดูแลระบบปิดการใช้งาน SSO ในหน้าตั้งค่า IRM (`ciam_sso_enabled = false` หรือเปิด Break-Glass) หน้าจอ Login ตรงของ IRM จะซ่อนปุ่ม SSO ถูกต้อง แต่หากพนักงานคลิกปุ่มเปิดระบบ IRM มาจากหน้า Central-IAM Portal ตัว endpoint `/api/auth/sso/callback` ของ IRM ยังคงยอมรับ authorization code และทำ login สำเร็จ เนื่องจากขาดการตรวจสอบสถานะ SSO ภายใน callback
* **การแก้ไขใน Backend ([`backend/app/routers/sso.py`](file:///d:/Python/IRM/backend/app/routers/sso.py)):**
  * เพิ่ม **Step 0 Guard** ที่จุดเริ่มต้นของฟังก์ชัน `handle_sso_callback`
  * ตรวจสอบเงื่อนไข: หาก `not sso_settings.ciam_sso_enabled` หรือ `sso_settings.ciam_break_glass_active`
  * ปฏิเสธการเข้าสู่ระบบทันทีด้วย `HTTP 503 Service Unavailable`: *"Single Sign-On (Central IAM) ถูกปิดใช้งานหรืออยู่ในโหมดฉุกเฉิน (Break-Glass) กรุณาเข้าสู่ระบบด้วยบัญชี Local ของ IRM"*
  * บันทึก Transaction Audit Log หมวดหมู่ `ciam_sso` (Action: `sso_callback_rejected_inactive`)

### 2) 🔄 ระบบ Auto-Refresh ทันทีหลังอัปเดตข้อมูล Supplier Master & Item Master (Commit `704b646`)
* **ปัญหาเดิม:** เมื่อผู้ใช้งานแก้ไขข้อมูล Supplier Master หรือ Item Master แล้วกดบันทึก หน้าจอไม่รีเฟรชค่าใหม่ทันที ต้องกด F5 / Hard Reload
* **การแก้ไขใน Frontend ([`frontend/src/app/(dashboard)/suppliers/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/suppliers/page.tsx), [`frontend/src/app/(dashboard)/items/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/items/page.tsx)):**
  * **Optimistic Local State Update:** นำ object ผลลัพธ์ `res.data` ที่ได้จาก Backend มา Map อัปเดตลง State `suppliers` และ `items` ทันทีหลังการบันทึกสำเร็จ ทำให้หน้าจอสะท้อนข้อมูลใหม่ทันทีในระดับ Millisecond
  * **Anti-Cache Guard:** ปรับปรุงฟังก์ชัน `fetchSuppliers()` และ `fetchItems()` ให้ส่ง `{ params: { _t: Date.now() }, headers: { 'Cache-Control': 'no-cache' } }` เพื่อป้องกันปัญหา Browser HTTP 304 / Memory Caching อย่างเด็ดขาด

### 3) ✉️ ปลดล็อกการลบ Email, Phone, และ Contact ใน Supplier Master ให้เป็นค่าว่าง (Commit `754323e`)
* **ปัญหาเดิม:** เมื่อผู้ใช้ต้องการลบอีเมลที่ไม่ถูกต้องของ Supplier ออกให้เป็นค่าว่าง (Blank) ระบบกลับไม่ยอมเซฟค่าว่าง และยังคงแสดงอีเมลเดิมค้างอยู่
* **Root Cause:** ใน FastAPI Endpoint `update_supplier` เดิมเขียนตรวจสอบเงื่อนไข `if data.email is not None:` ทำให้เมื่อฝั่ง Frontend ส่ง `email: null` เข้ามา Python จะข้ามการอัปเดตฟิลด์ดังกล่าวไป
* **การแก้ไขใน Backend ([`backend/app/routers/suppliers.py`](file:///d:/Python/IRM/backend/app/routers/suppliers.py)):**
  * ปรับมาใช้ `update_data = data.model_dump(exclude_unset=True)` ตรวจสอบว่ามีคีย์ `email`, `phone`, `contact_person` ถูกส่งมาหรือไม่
  * หากถูกส่งมา (แม้จะเป็น `None` หรือ `""`) ระบบจะทำความสะอาดสตริงและบันทึกลงฐานข้อมูลเป็น `None` (`NULL` ใน PostgreSQL) ทันที
  * หน้าตารางจะแสดงสถานะ `ยังไม่มี Email` อย่างถูกต้องตามที่ผู้ใช้ต้องการ

### 4) ⚡ ระบบ Realtime Auto-Refresh & Global Anti-Cache ทุกหน้าจอ
* **ปัญหาเดิม:** เมื่อผู้ใช้คลิกสลับหน้าไป-มา เช่น จาก Dashboard ไปหน้าอื่นแล้วกลับมา หรือ Supplier เพิ่งกดยืนยันวันส่งมอบ ข้อมูลไม่เปลี่ยนทันที ต้องกดปุ่ม Refresh บนเบราว์เซอร์
* **การแก้ไข:**
  * **Backend ([`backend/app/main.py`](file:///d:/Python/IRM/backend/app/main.py)):** ติดตั้ง HTTP Anti-Cache Middleware ให้ทุก endpoint `/api/*` ส่ง Response Headers `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` และ `Pragma: no-cache`
  * **Axios Interceptor ([`frontend/src/lib/api.ts`](file:///d:/Python/IRM/frontend/src/lib/api.ts)):** บังคับให้ทุกคำขอ `GET` แนบพารามิเตอร์ Cache-Buster `_t: Date.now()` และ Headers ห้ามแคชอัตโนมัติแบบครอบคลุมทั้งระบบ
  * **Next.js Router Cache ([`frontend/next.config.js`](file:///d:/Python/IRM/frontend/next.config.js)):** กำหนด `experimental.staleTimes: { dynamic: 0, static: 0 }` และตั้ง `prefetch={false}` บนทุกลิงก์ใน Sidebar ([`Sidebar.tsx`](file:///d:/Python/IRM/frontend/src/components/layout/Sidebar.tsx)) เพื่อให้ดึงข้อมูลสดทุกครั้งที่คลิกเปลี่ยนหน้า
  * **Window Focus & Silent Background Polling:** เพิ่มตัวจับสัญญาณ `window.focus` และ `visibilitychange` พร้อม Silent Background Polling ทุก 30 วินาทีใน Dashboard ([`dashboard/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/dashboard/page.tsx)), Operation ([`operation/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/operation/page.tsx)), และ Calendar ([`calendar/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/calendar/page.tsx)) โดยมี Safeguard ข้ามการรีเฟรชหากผู้ใช้กำลังเปิด Modal แก้ไขข้อมูลอยู่

---

## 🏗️ 3. สรุปความคืบหน้าการพัฒนาก่อนหน้า (27 กันยายน 2026)

### 1) 👤 แก้ไข User ID (Username) ให้ปรับตรงกับ Active Directory (AD) ได้
* **ความเป็นมา:** เดิมในหน้า User Management ไม่มีช่องแก้ไข Username ทำให้เมื่อจำเป็นต้องปรับเปลี่ยน User ID ให้สอดคล้องกับบัญชี AD ขององค์กร ผู้ดูแลระบบไม่สามารถปรับได้โดยตรงจากหน้าจอ
* **การพัฒนา Backend ([`backend/app/schemas/user.py`](file:///d:/Python/IRM/backend/app/schemas/user.py), [`backend/app/routers/users.py`](file:///d:/Python/IRM/backend/app/routers/users.py)):**
  * เพิ่ม `username: str | None = None` ใน `UserUpdate` Schema
  * ใน `PUT /api/users/{user_id}`:
    * ตรวจสอบความถูกต้องและไม่เป็นสตริงว่าง
    * ตรวจสอบความซ้ำซ้อนกับผู้ใช้อื่นในฐานข้อมูล (`select(User).where(User.username == new_username, User.id != user_id)`)
    * ป้องกันการเปลี่ยนชื่อของ root `admin`
    * บันทึก Transaction Audit Log หมวดหมู่ `user_management` (Action: `update_username`) บันทึก User ID เดิมและใหม่
* **การพัฒนา Frontend ([`frontend/src/app/(dashboard)/admin/users/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/users/page.tsx)):**
  * เพิ่มช่องกรอก **"User ID / Username"** ใน Edit Modal เป็นช่องแรก
  * กำกับข้อความช่วยเหลือ *"ปรับให้ตรงกับ Active Directory (AD) ได้"*
  * ปิดการแก้ไข (Disabled) อัตโนมัติหากผู้ใช้งานเป้าหมายคือ `admin` เพื่อความปลอดภัย

### 2) 🗑️ เพิ่มฟังก์ชันลบบัญชีผู้ใช้งานที่ไม่ใช้งานแล้ว (Delete User Account) พร้อมระบบความปลอดภัย
* **ความเป็นมา:** เดิมระบบรองรับเฉพาะการกด "ปิดใช้งาน" (Deactivate) แต่ยังไม่มีปุ่มสำหรับลบบัญชีที่ไม่ใช้งานแล้วหรือบัญชีทดสอบออกจากฐานข้อมูล
* **การพัฒนา Backend ([`backend/app/routers/users.py`](file:///d:/Python/IRM/backend/app/routers/users.py)):**
  * สร้าง Endpoint `DELETE /api/users/{user_id}` ควบคุมสิทธิ์ด้วย `require_permission("/admin/users", "delete")`
  * **กลไกความปลอดภัย (Safety Safeguards):**
    * ป้องกันไม่ให้ผู้ใช้ลบบัญชีของตนเองที่กำลังล็อกอินอยู่ (`user.id == current_user.id`)
    * ป้องกันไม่ให้ลบบัญชีผู้ดูแลระบบหลัก (`admin`)
  * ลบข้อมูลออกจากฐานข้อมูลอย่างสมบูรณ์ (`await db.delete(user)`)
  * บันทึก Transaction Audit Log หมวดหมู่ `user_management` (Action: `delete_user`) พร้อมข้อมูลชื่อผู้ใช้งานและผู้สั่งลบ
* **การพัฒนา Frontend ([`frontend/src/app/(dashboard)/admin/users/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/users/page.tsx)):**
  * เพิ่มปุ่มไอคอนถังขยะ (`Trash2`) ในคอลัมน์ "การจัดการ" (Actions) ด้านขวาสุดของตาราง
  * ปุ่มจะ Disable อัตโนมัติและแสดง Tooltip เตือนหากเป็นบัญชี `admin` หรือบัญชีของตนเอง
  * เพิ่ม **Modal ยืนยันการลบ (Delete Confirmation Modal)** โทนสะอาด ปลอดภัย แสดงรายละเอียดบัญชี (User ID, ชื่อ-นามสกุล, แผนก, อีเมล) อย่างชัดเจนก่อนกดยืนยัน

### 3) 📄 จัดทำเอกสารข้อกำหนดระบบที่เป็นทางการ ([`PRD.md`](file:///d:/Python/IRM/PRD.md))
* รวบรวมและจัดหมวดหมู่ข้อกำหนด สถาปัตยกรรม 5 คอนเทนเนอร์, กฎความปลอดภัย, ลำดับเมนูที่เป็นทางการ 9 หน้า, กฎ Pure Date Standard, กลไก Append-Only Masters, ตารางเวลาอัตโนมัติ และข้อตกลงการเชื่อมโยงระบบ SAP B1 / Central IAM / QMS ไว้ในเอกสาร [`PRD.md`](file:///d:/Python/IRM/PRD.md) อย่างสมบูรณ์

---

## 🏗️ 3. สรุปความคืบหน้าการพัฒนาก่อนหน้า (18–26 กันยายน 2026)

### 1) 🔐 ระบบ Central IAM SSO & Duplicate Token Prevention
* แก้ไขการแลกเปลี่ยน SSO Token โดยใช้ `executedRef` เพื่อป้องกันการเกิด Duplicate Token Exchange ใน React Strict Mode
* ปรับปรุงฟังก์ชัน `create_access_token` และ `create_refresh_token` ให้รองรับ Data Payload ได้ยืดหยุ่น

### 2) ✉️ ปรับปรุงระบบอีเมลสรุปงานจัดซื้อ (PU Reminder) & ปุ่มส่งทันที (Manual)
* เพิ่มปุ่ม **`[ ⚡ ส่งทันที (Manual) ]`** ใน System Settings Section 2
* ปรับปรุง `email_service.py` ให้ใช้ Isolated Session (`AsyncSessionLocal()`) ในการบันทึก Audit Log ทุกสถานะ (`SUCCESS`, `WARNING`, `FAILED`) ป้องกันการโดน Rollback จาก FastAPI Dependency

### 3) 🧹 ระบบ Log Retention Policy (15 วัน) & Auto Purge
* เพิ่ม Card กำหนดระยะเวลาจัดเก็บ Log ย้อนหลัง (Default 15 วัน) ใน System Settings Section 4
* เพิ่ม Background Job ใน `scheduler.py` เวลา 00:30 น. สั่งลบแถว `transaction_logs` ที่เก่ากว่ากำหนดอัตโนมัติ

### 4) ⚡ เพิ่มประสิทธิภาพฐานข้อมูล (PostgreSQL Performance Indexes)
* สร้าง 13 ดัชนี (Indexes) บน `po_items`, `sub_items`, `po_headers`, `po_item_audit_logs`, `users`
* เปลี่ยน Relationship จาก `lazy="selectin"` เป็น `lazy="select"` เพื่อตัด Cascade Queries ซ้ำซ้อน

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
| [`backend/app/routers/sso.py`](file:///d:/Python/IRM/backend/app/routers/sso.py) | เพิ่ม Step 0 Check ตรวจสอบ `ciam_sso_enabled` ป้องกันการ bypass SSO จาก CIAM Portal เมื่อ Spoke ปิด SSO |
| [`backend/app/routers/suppliers.py`](file:///d:/Python/IRM/backend/app/routers/suppliers.py) | รองรับการล้างอีเมล/เบอร์โทรให้เป็น Blank/NULL (`model_dump(exclude_unset=True)`) |
| [`frontend/src/app/(dashboard)/suppliers/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/suppliers/page.tsx) | Optimistic State Update + Anti-Cache header ป้องกัน browser cache รีเฟรชทันทีหลังบันทึก |
| [`frontend/src/app/(dashboard)/items/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/items/page.tsx) | Optimistic State Update + Anti-Cache header รีเฟรชทันทีหลังบันทึก |
| [`backend/app/schemas/user.py`](file:///d:/Python/IRM/backend/app/schemas/user.py) | เพิ่ม `username: str | None = None` ใน `UserUpdate` |
| [`backend/app/routers/users.py`](file:///d:/Python/IRM/backend/app/routers/users.py) | รองรับการเปลี่ยน Username พร้อมตรวจซ้ำ และเพิ่ม `DELETE /api/users/{user_id}` พร้อมระบบ Safeguards |
| [`frontend/src/app/(dashboard)/admin/users/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/users/page.tsx) | ช่องกรอก User ID ใน Edit Modal, ปุ่มไอคอนถังขยะ `Trash2`, และ Modal ยืนยันการลบบัญชี |
| [`PRD.md`](file:///d:/Python/IRM/PRD.md) | เอกสาร Product Requirements Document ฉบับสมบูรณ์ของระบบ IRM |
| [`backend/app/services/log_service.py`](file:///d:/Python/IRM/backend/app/services/log_service.py) | ฟังก์ชัน `record_transaction_log` บันทึก Audit Log แบบ Isolated Session ไม่โดน Rollback |
| [`backend/app/services/email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py) | ดึงผู้รับ PU Reminder จากกลุ่ม `PU User` ใน User Management โดยตรง พร้อมไฟล์แนบ Excel 2 Sheet |
| [`backend/app/routers/settings.py`](file:///d:/Python/IRM/backend/app/routers/settings.py) | Endpoint `POST /api/settings/send-pu-remind-email-now` (ส่งทันที) และ Purge Logs |
| [`backend/app/services/scheduler.py`](file:///d:/Python/IRM/backend/app/services/scheduler.py) | Auto Purge Logs เวลา 00:30 น., Minute-Checker สำหรับ PU Reminder Email |

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
  * บันทึก Git Commit & Push ขึ้น GitHub `main` เรียบร้อยแล้ว (`commit: 0a3a5c1` และ commit อัปเดตเอกสารล่าสุด)
  * ระบบ User Management รองรับการแก้ User ID ให้ตรงกับ AD และการลบบัญชีที่ไม่ใช้งานแล้วอย่างปลอดภัย
* **ขั้นตอนถัดไปเมื่อกลับมาเริ่มงาน (Next Steps):**
  1. **Deploy ขึ้น Production:** รันคำสั่งในข้อ 6 บน VPS Production Hostinger
  2. **ทดสอบฟังก์ชัน User Management บน Production:**
     - ทดสอบแก้ไข User ID ของผู้ใช้ทั่วไป เพื่อตรวจสอบการซิงค์และบันทึกข้อมูล
     - ทดสอบลบบัญชีผู้ใช้งานที่ไม่ใช้งาน พร้อมสังเกต Modal ยืนยันการลบและผลใน Audit Log
  3. **ดำเนินงานต่อตามโจทย์ใหม่:** พร้อมรับ Requirements ถัดไปจากผู้ใช้ได้ทันทีครับ
