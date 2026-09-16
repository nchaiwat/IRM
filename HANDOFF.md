# 📌 IRM System — HANDOFF & PROGRESS LOG

> **วันที่บันทึก:** 16 กันยายน 2026 (21:15 น.)  
> **สถานะโครงการ:** Production-Ready, Performance-Optimized & Feature Complete (`https://irm.windowasia.com`)  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **VPS Hostinger Path:** `/var/www/Irm`

---

## 🎯 1. ภาพรวมระบบ (System Overview)

ระบบ **IRM (Incoming Raw Material Management System)** ของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) ทำหน้าที่เชื่อมโยงข้อมูล PO วัตถุดิบ 7 กลุ่มหลักจาก **SAP Business One** ส่งต่อให้ Supplier ระบุวันส่งมอบผ่าน **Cryptographic Portal**, วางแผนนัดหมายลง **ปฏิทินส่งของ (Calendar)**, พิมพ์ใบตรวจรับสินค้าจริง (**Receiving Checklist**), แจ้งเตือนยอดวัตถุดิบเข้าประจำวันรายบุคคลผ่าน **Telegram Direct Message (DM)**, ส่งต่อข้อมูลให้ระบบ **QMS**, และรองรับการยืนยันตัวตนระดับองค์กรผ่าน **Central IAM (OAuth2 / OIDC SSO)** พร้อมทั้งการสำรองฉุกเฉินด้วย **Break-Glass Mode**

---

## 🏗️ 2. สรุปความคืบหน้าและการพัฒนางานล่าสุด (16 กันยายน 2026)

### 1) 🧹 ลบการ์ดซ้ำซ้อน Section 9 และเพิ่มช่อง Allow IP สำหรับเซิร์ฟเวอร์ CIAM ในหน้า Settings
* **ปัญหาเดิม:**
  * หน้าจอ System Settings มีการ์ด Central IAM ซ้ำซ้อน 2 จุด (ข้อ 6 และข้อ 9) ซึ่งมีช่องกรอกเหมือนกันทั้งหมด ทำให้เกิดความสับสนและไม่เป็นระเบียบ
  * ในการ์ด Central IAM ไม่มีช่องระบุ **Allowed IP (IP Whitelist)** สำหรับเครื่องเซิร์ฟเวอร์ CIAM ที่จะยิงเชื่อมต่อเข้ามายัง IRM
* **การแก้ไข:**
  * **ลบ Section 9 ออก 100%:** จัดระเบียบหน้า Settings ให้เหลือเฉพาะ Section 6 เดียวสำหรับการตั้งค่า Central IAM Single Sign-On (OIDC / PKCE SSO)
  * **เพิ่มช่อง CIAM Allowed IPs ใน Section 6:** เพิ่มฟิลด์ `Central IAM Server Allowed IPs (IP Whitelist สำหรับเซิร์ฟเวอร์ CIAM)` (`ciam_allowed_ips`)
  * **เชื่อมโยง API & M2M Security:** ปรับให้ `ciam_allowed_ips` ซิงค์กับ `management_allowed_ips` และให้ [`central_management.py`](file:///d:/Python/IRM/backend/app/routers/central_management.py) ตรวจสอบ Whitelist IP ทั้งสองค่า ช่วยให้ผู้ดูแลระบบกำหนด IP ของเซิร์ฟเวอร์ CIAM ได้จากจุดเดียว
  * **คงกล่องคำแนะนำ Local/Docker:** ยก Notice Box สำหรับการตั้งค่า Base URL (`http://host.docker.internal:3000`) และ Redirect URI มาไว้ใน Section 6 อย่างเป็นระเบียบ

### 2) ✉️ แก้ไขปัญหาระบบส่งอีเมลสรุปงานตอน 07:50 น. ไม่ได้รับอีเมล (PU Reminder Email)
* **สาเหตุที่แท้จริง:**
  1. ในหน้า System Settings เดิมมีเพียงช่อง **"อีเมลผู้รับทดสอบสรุปงาน"** ซึ่งเป็น State จำลองเฉพาะการกดปุ่มทดสอบ ไม่มีการบันทึกลง Database
  2. เมื่อตั้งเวลาส่งอัตโนมัติ (Scheduler Triggered at `07:50 น.`) ฟังก์ชัน `send_pu_daily_reminder_email` จะพยายามดึงผู้ใช้จากฐานข้อมูล ซึ่งผู้ใช้เริ่มต้นมีอีเมลเป็น dummy (`admin@company.com`, `patcha@company.com`, `pinyada@company.com`) ทำให้ไม่มีอีเมลจริงส่งออกไป หรือถูกปฏิเสธโดย Mail Server
  3. ไม่มีฟิลด์สำหรับระบุอีเมลผู้รับจริงสำหรับรอบเวลา Scheduler ใน System Settings
* **การแก้ไข:**
  * **เพิ่มฟิลด์ `pu_remind_recipient_emails` ใน Database & Settings:**
    * เพิ่มคีย์ `pu_remind_recipient_emails` ใน `SystemSetting` และฟอร์มหน้าเว็บ Section 2
    * รองรับการระบุอีเมลผู้รับรายงานได้หลายท่าน คั่นด้วยเครื่องหมายจุลภาค `,` (เช่น `purchasing@windowasia.com, buyer@windowasia.com`)
  * **ปรับปรุงลอจิกใน [`email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py):**
    * เมื่อระบบ Scheduler ยิงส่ง จะตรวจสอบ `pu_remind_recipient_emails` เป็นลำดับแรก
    * หากไม่มีการตั้งค่า จึงจะ Fallback ไปหา User ที่มีอีเมลจริง (คัดกรอง `@company.com` ออก)
  * **เพิ่ม Debounce ป้องกันการส่งซ้ำใน [`scheduler.py`](file:///d:/Python/IRM/backend/app/services/scheduler.py):** เพิ่มตัวแปร `_last_pu_remind_date` เพื่อรับประกันว่าใน 1 วันจะยิงส่งเพียงครั้งเดียวตรงตามเวลาที่ตั้งไว้ (07:50 น.)
  * **ปรับปรุงปุ่มทดสอบส่งอีเมลสรุปงานในหน้าเว็บ:** หากช่องทดสอบเว้นว่างไว้ ระบบจะดึงอีเมลจากช่อง "อีเมลผู้รับสรุปงานประจำวัน" มาใช้ทดสอบให้อัตโนมัติ

---

## 🏗️ 3. สรุปความคืบหน้าการพัฒนาก่อนหน้า (15 กันยายน 2026)

### 1) ✉️ แก้ไขปัญหาระบบส่งอีเมลสรุปงานและทดสอบส่งอีเมล (Fix Email Service & Pure Date Bug)
* **ปัญหาเดิม:**
  * หน้าจอ System Settings ขึ้น Error: `❌ เกิดข้อผิดพลาดในการส่งอีเมลสรุปงาน: 'datetime.date' object has no attribute 'date'`
  * ระบบไม่ส่งอีเมลสรุปงานและของส่งวันนี้ (PU Reminder Email with 2-Sheet Excel) ให้ฝ่ายจัดซื้อต่อเนื่องเป็นเวลา 3 วัน
  * ปุ่ม "ทดสอบส่ง Email" ด้านบนติด `disabled` หากไม่ได้กรอกอีเมลในช่องด้านบน ทำให้ผู้ใช้คลิกแล้วไม่ตอบสนอง
* **การแก้ไข:**
  * **แก้บั๊ก Pure Date ใน [`email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py):** เพิ่มฟังก์ชัน `_to_pure_date(d)` และตัดการเรียก `.date()` ซ้ำซ้อนบน `sub.estimate_date` และ `item.estimate_date` ใน `generate_pu_remind_excel` (Sheet 2) ขจัด `AttributeError` ส่งผลให้ระบบ APScheduler และปุ่มทดสอบส่งอีเมลสร้างไฟล์แนบ Excel 2 Sheet สำเร็จ 100%
  * **ปรับปรุง `POST /api/settings/test-email` ใน [`settings.py`](file:///d:/Python/IRM/backend/app/routers/settings.py):** เพิ่มระบบ Fallback ดึงรหัสผ่านจาก Database หากผู้ใช้ไม่ได้พิมพ์รหัสผ่านใหม่ และครอบการเชื่อมต่อ SMTP ผ่าน `asyncio.to_thread` เพื่อไม่ให้บล็อก Async Event Loop
  * **ปรับปรุงหน้าจอ Settings ([`admin/settings/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/settings/page.tsx)):** ปลดล็อคปุ่ม "ทดสอบส่ง Email" ให้คลิกได้ตลอดเวลา หากยังไม่ได้กรอกจะมี Alert เตือน หรือดึงอีเมลจากช่องทดสอบสรุปงานอัตโนมัติ พร้อมแสดง Alert แจ้งเตือนผลลัพธ์ชัดเจน

### 2) 🔐 ปรับแต่งหน้า Login เมื่อปิดใช้งานระบบ SSO (Clean Login when SSO Disabled)
* **ปัญหาเดิม:** เมื่อปิดระบบ SSO (`sso_enabled = false`) หน้า Login (`/login`) ยังแสดงกล่องข้อความสีเทา *"Central IAM SSO ปิดใช้งานชั่วคราว"*, เส้นคั่น *"หรือเข้าสู่ระบบสำรอง (Break-Glass Login)"*, ปุ่ม Sign In ระบุ *"เข้าสู่ระบบสำรอง"*, และ Footer อ้างอิง Break-Glass
* **การแก้ไขใน [`frontend/src/app/login/page.tsx`](file:///d:/Python/IRM/frontend/src/app/login/page.tsx):**
  * เมื่อปิดระบบ SSO (`!ssoConfig?.sso_enabled`):
    * **ลบกล่องข้อความและปุ่ม SSO:** ซ่อนกล่องแจ้งเตือน Central IAM, ปุ่ม SSO, และแบนเนอร์ Break-Glass ทั้งหมด 100%
    * **ลบเส้นคั่น:** ไม่มีเส้นคั่น *"หรือเข้าสู่ระบบสำรอง"* ปรากฏ
    * **ปุ่ม Sign In หลัก:** ปรับเปลี่ยนปุ่มเข้าสู่ระบบให้เป็น **Primary Gradient Button** สีน้ำเงินหรูหรา (`bg-gradient-to-r from-sky-500 to-indigo-600`) ระบุข้อความ **`เข้าสู่ระบบ (Sign In)`** โดดเด่น ชัดเจน สะอาดตา
    * **Footer:** แสดงข้อความมาตรฐานองค์กร `Window Asia Public Company Limited · IRM System` โดยไม่มีคำว่า Break-Glass หรือข้อความฉุกเฉินใดๆ

### 3) 👤 การตรวจสอบที่มาของ Test Accounts ใน User Management
* **ข้อเท็จจริง:** บัญชี `test.user.xxxxxx` (เช่น `Lifecycle Test 6b7e63`, `Lifecycle Test c68f9e`) ในหน้า User Management ถูกสร้างขึ้นโดยอัตโนมัติจากการรันชุดทดสอบ Integration Test ของระบบ **Central IAM** ([`D:\Python\Central-IAM\backend\tests\test_api_flow.py`](file:///D:/Python/Central-IAM/backend/tests/test_api_flow.py)) ที่ยิง M2M API เข้ามายัง `POST /api/v1/directory/accounts` เมื่อวันที่ 9–11 กันยายน 2026
* **ความปลอดภัย:** เป็นเพียงข้อมูลจำลองสำหรับทดสอบฟังก์ชัน Provisioning / Offboarding ข้ามระบบ สามารถลบออกได้จากหน้าเว็บอย่างปลอดภัย 100%

---

## 🏗️ 3. สรุปความคืบหน้าการพัฒนาก่อนหน้า (11 กันยายน 2026)

### 1) ⚡ การเพิ่มประสิทธิภาพฐานข้อมูล (Database Performance & Indexing)
* **ปัญหาเดิม:** หน้า Operation, History, และ Calendar มีการโหลดที่ล่าช้า เนื่องจากขาด Index บน Foreign Key และเงื่อนไข Filter หลักใน PostgreSQL ส่งผลให้ต้องทำ Sequential Scan ทุกครั้ง
* **การแก้ไข:**
  * สร้าง Migration [`backend/app/migrations/add_performance_indexes.py`](file:///d:/Python/IRM/backend/app/migrations/add_performance_indexes.py) เพิ่ม Index สำคัญทั้งหมด 13 ตัว:
    * `po_items`: `po_header_id`, `status`, `(po_header_id, status)`, `estimate_date`, `due_date`, `closed_at DESC`
    * `sub_items`: `po_item_id`, `estimate_date`
    * `po_headers`: `status`, `(status, supplier_code)`
    * `po_item_audit_logs`: `po_item_id`, `changed_at DESC`
    * `supplier_portal_tokens`: `(supplier_code, is_submitted, expires_at)`, `po_number`
    * `users`: `group_id`
  * **ตัด Cascading Queries ใน SQLAlchemy:** ปรับ `Group.users` และ `Menu.auth_entries` จาก `lazy="selectin"` เป็น `lazy="select"` เพื่อหยุดการโหลด User ทั้งบริษัทและ Menu ซ้ำซ้อน 20-30 Query ต่อ 1 Request
  * **แก้ MissingGreenlet:** เพิ่ม `.options(selectinload(POItem.sub_items))` ใน `supplier_portal.py` ป้องกัน Error 500 เวลาดึงข้อมูล Portal ที่มี Sub-items

### 2) 🔗 ปุ่ม Link หน้า Operation: ส่งและล็อคทั้ง PO (PO-Level Portal Token)
* **ปัญหาเดิม:** ปุ่ม `[ 🔗 ]` บนตารางหน้า Operation กดแล้วเกิด HTTP 500 (`base_url not defined`) และสร้าง Token เจาะจงเพียงแค่ Item เดียว
* **การแก้ไข:**
  * แก้ไขการดึง `app_base_url` จาก `SystemSetting` ให้ถูกต้อง
  * ขยายขอบเขตให้เมื่อกดปุ่ม `[ 🔗 ]` บน Item ใดใน PO ระบบจะค้นหา **ทุกรายการใน PO นั้น (`po_header_id`)**
  * ล็อคสถานะทุก Item ใน PO พร้อมกัน: `locked_by = 'supplier'`, `lock_expires_at = token_obj.expires_at` และเปลี่ยนเป็น `awaiting_supplier`
  * บันทึก Audit Log ให้ทุก Item และบันทึก `transaction_logs`
  * ฝั่งหน้าจอ Operation ([`operation/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/operation/page.tsx)) อัปเดตสถานะของทุกรายการใน PO นั้นบนตารางแบบ Realtime ทันที

### 3) ⏰ แก้ไขลิงก์หมดอายุ (Expired Links) & Timezone การแสดงผล (+07:00 BKK)
* **ปัญหาเดิม:** ผู้ใช้เปิดลิงก์ Portal แล้วขึ้นหมดอายุ หรือแสดงเวลาเป็น UTC (16:59 น.)
* **การแก้ไข:**
  * ปรับฟังก์ชันแสดงผลใน [`supplier_portal.py`](file:///d:/Python/IRM/backend/app/routers/supplier_portal.py) และ [`suppliers.py`](file:///d:/Python/IRM/backend/app/routers/suppliers.py) ให้แปลงเวลาจาก UTC เป็น `Asia/Bangkok` ก่อนแสดงผล ทำให้หน้าจอและข้อความแจ้งเตือนแสดง `เวลา 23:59 น.` อย่างถูกต้อง
  * **12-Hour Cushion:** ใน [`email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py) ปรับปรุงให้หากสร้าง Token ในช่วงใกล้หมดรอบ (เหลือน้อยกว่า 12 ชม.) ระบบจะขยายวันหมดอายุข้ามไปจบรอบถัดไปทันที ป้องกันลิงก์หมดอายุเร็วเกินไป
  * **Clipboard Helper ([`frontend/src/lib/clipboard.ts`](file:///d:/Python/IRM/frontend/src/lib/clipboard.ts)):** เพิ่มระบบ Fallback คัดลอกผ่าน `execCommand` และ `window.prompt` ป้องกันเบราว์เซอร์บล็อกการคัดลอกหลังรอผล API

### 4) 📝 แสดงผล Item Description เต็มรูปแบบในหน้า Operation (Full Description)
* **ปัญหาเดิม:** หน้า Operation ตัดข้อความคำอธิบายสินค้าด้วย `line-clamp-1` มีจุดไข่ปลา `...`
* **การแก้ไข:**
  * ปลด `line-clamp-1` ออกใน [`operation/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/operation/page.tsx) บรรทัด 1250
  * ปรับใช้ `align-top` และขยายความกว้าง `min-w-[220px]` ให้แสดงผลข้อความยาวได้ครบถ้วนสวยงามเหมือนหน้า History และ Item Master

### 5) 🔐 สรุปการเชื่อมต่อ Central IAM Single Sign-On (Steps 1-5 สำเร็จครบถ้วน)
* **Step 1: DB Schema & System Settings** — ฟิลด์ `ciam_*` ใน `system_settings`
* **Step 2: Backend Auth & SSO Routes** — `/api/auth/sso/login`, `/api/auth/sso/callback`, `/api/auth/break-glass`
* **Step 3: Auto-provisioning & User Sync** — ดึง AD Attributes, ซิงค์กลุ่มผู้ใช้ และ Default Page
* **Step 4: Central Management API** — Endpoint ปลอดภัยสำหรับ CIAM จัดการ User ข้ามระบบ
* **Step 5: Frontend Clean Corporate SSO UI** — ปุ่ม SSO เข้าสู่ระบบด้วย Window Asia Account และ Break-Glass Modal

### 6) ⚙️ เพิ่มหน้าจอตั้งค่า Central IAM SSO UI (Section 9 ใน System Settings)
* **การ์ดตั้งค่า Section 9:** เพิ่มการ์ด UI ส่วน "9. Window Asia Central IAM (Single Sign-On & OIDC/OAuth 2.0)" ใน [`admin/settings/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/settings/page.tsx)
* **ฟิลด์ตั้งค่าครบถ้วน:** รองรับการกรอก `ciam_base_url`, `ciam_client_id`, แก้ไข `ciam_client_secret`, สวิตช์เปิด/ปิด SSO, สลับโหมดฉุกเฉิน Break-Glass, เลือกกลุ่มสิทธิ์เริ่มต้น (Auto-Provision Group), และระบุ Session TTL
* **ปุ่มทดสอบการเชื่อมต่อ (JWKS):** รองรับการทดสอบ Discovery & JWKS endpoint แบบ Real-time พร้อมแสดง Latency และจำนวน Key

### 7) 🚚 ปรับปรุง Telegram Inbound Daily DM: ปรับช่วงเวลาล่วงหน้าจาก 7 วันเป็น 3 วัน
* **เหตุผล:** ผู้ใช้ต้องการสรุปยอดล่วงหน้าที่กระชับขึ้น เนื่องจาก 7 วันนานเกินไป
* **การแก้ไข:** ปรับ `next_7d` เป็น `next_3d` ใน [`telegram_service.py`](file:///d:/Python/IRM/backend/app/services/telegram_service.py) และปรับคำอธิบายในหน้า [`admin/settings`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/settings/page.tsx) และ [`admin/users`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/users/page.tsx) เป็น *"กำหนดส่งใน 3 วันข้างหน้า"*


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

## 📂 4. โครงสร้างไฟล์สำคัญที่ปรับปรุงล่าสุด (Key Files Reference)

| ไฟล์ (File Path) | หน้าที่ / การทำงาน |
| :--- | :--- |
| [`backend/app/services/email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py) | เพิ่ม `_to_pure_date`, แก้ไข `AttributeError: 'datetime.date' object has no attribute 'date'` ใน `generate_pu_remind_excel` |
| [`backend/app/routers/settings.py`](file:///d:/Python/IRM/backend/app/routers/settings.py) | ปรับปรุง `POST /api/settings/test-email` รองรับ Password fallback จาก DB และรัน SMTP ผ่าน `asyncio.to_thread` |
| [`frontend/src/app/(dashboard)/admin/settings/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/settings/page.tsx) | ปลดล็อคปุ่มทดสอบส่ง Email ให้กดได้ตลอดเวลา พร้อมระบบ Alert แจ้งเตือนและเชื่อมต่อกับอีเมลสรุปงาน |
| [`frontend/src/app/login/page.tsx`](file:///d:/Python/IRM/frontend/src/app/login/page.tsx) | ซ่อนกล่องแจ้งเตือน SSO, ปุ่ม SSO, เส้นคั่น Break-Glass, ปรับปุ่ม Sign In เป็น Primary Gradient เมื่อปิด SSO 100% |
| [`backend/app/migrations/add_performance_indexes.py`](file:///d:/Python/IRM/backend/app/migrations/add_performance_indexes.py) | สคริปต์รันสร้าง 13 Performance Index ใน PostgreSQL (`CREATE INDEX IF NOT EXISTS`) |
| [`backend/app/models/po.py`](file:///d:/Python/IRM/backend/app/models/po.py) | กำหนด Index บน `status`, `closed_at`, `po_header_id`, `estimate_date` |
| [`backend/app/models/group.py`](file:///d:/Python/IRM/backend/app/models/group.py) | ปรับ `Group.users` เป็น `lazy="select"` ตัดปัญหา Cascading Queries |
| [`backend/app/models/menu.py`](file:///d:/Python/IRM/backend/app/models/menu.py) | ปรับ `Menu.auth_entries` เป็น `lazy="select"` |
| [`backend/app/routers/operation.py`](file:///d:/Python/IRM/backend/app/routers/operation.py) | ลอจิก PO-Level Portal Link, ล็อคทั้ง PO, แก้ไข `base_url`, และบันทึก Audit/Transaction Logs |
| [`backend/app/routers/supplier_portal.py`](file:///d:/Python/IRM/backend/app/routers/supplier_portal.py) | แก้ MissingGreenlet ด้วย `selectinload`, ฟอร์แมตเวลาหมดอายุเป็น `Asia/Bangkok` (+07:00) |
| [`backend/app/routers/suppliers.py`](file:///d:/Python/IRM/backend/app/routers/suppliers.py) | ฟอร์แมตวันหมดอายุใน Token response เป็นเวลาไทย |
| [`frontend/src/lib/clipboard.ts`](file:///d:/Python/IRM/frontend/src/lib/clipboard.ts) | ยูทิลิตี้คัดลอก Clipboard แบบทนทาน มี Fallback `execCommand` ข้ามเบราว์เซอร์ |
| [`frontend/src/app/(dashboard)/operation/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/operation/page.tsx) | แสดง Item Description เต็มรูปแบบ (ปลด `line-clamp-1`), อัปเดต PO-level lock บนตาราง |
| [`frontend/src/app/(dashboard)/suppliers/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/suppliers/page.tsx) | ปุ่มคัดลอกลิงก์ Supplier Portal พร้อม Fallback ป้องกันการคัดลอกไม่ติด |

---

## 🚀 5. คำสั่งอัปเดตระบบบน VPS Hostinger (`/var/www/Irm`)

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

## 📌 6. Checkpoint สำหรับการเริ่มงานในครั้งหน้า (Next Session)
* **สถานะปัจจุบัน:**
  * โค้ดทั้งหมดได้รับการ Compile (`py_compile`) และ Build (`next build` 19/19 pages) ผ่าน 100%
  * บันทึก Git Commit & Push ขึ้น GitHub `main` เรียบร้อยแล้ว
  * บันทึกความคืบหน้างานทั้งหมดลงใน `HANDOFF.md` เรียบร้อย
* **สิ่งที่ต้องทำต่อบน VPS:**
  * รันคำสั่งในข้อ 5 บน VPS Production เพื่อนำโค้ดที่แก้ไขล่าสุดขึ้นใช้งาน
* **เรื่องที่จะทำต่อในครั้งหน้า:**
  * ตรวจสอบผลการส่งอีเมลสรุปงานรายวันเวลา 07:50 น. บน Production ว่าอีเมลและไฟล์แนบ 2-Sheet Excel ส่งถึงจัดซื้ออย่างสมบูรณ์
  * พัฒนาฟังก์ชันเพิ่มเติมตามโจทย์งานถัดไปของผู้ใช้
