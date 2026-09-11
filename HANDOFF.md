# 📌 IRM System — HANDOFF & PROGRESS LOG

> **วันที่บันทึก:** 11 กันยายน 2026 (22:05 น.)  
> **สถานะโครงการ:** Production-Ready, Performance-Optimized & Feature Complete (`https://irm.windowasia.com`)  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **VPS Hostinger Path:** `/var/www/Irm`

---

## 🎯 1. ภาพรวมระบบ (System Overview)

ระบบ **IRM (Incoming Raw Material Management System)** ของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) ทำหน้าที่เชื่อมโยงข้อมูล PO วัตถุดิบ 7 กลุ่มหลักจาก **SAP Business One** ส่งต่อให้ Supplier ระบุวันส่งมอบผ่าน **Cryptographic Portal**, วางแผนนัดหมายลง **ปฏิทินส่งของ (Calendar)**, พิมพ์ใบตรวจรับสินค้าจริง (**Receiving Checklist**), แจ้งเตือนยอดวัตถุดิบเข้าประจำวันรายบุคคลผ่าน **Telegram Direct Message (DM)**, ส่งต่อข้อมูลให้ระบบ **QMS**, และรองรับการยืนยันตัวตนระดับองค์กรผ่าน **Central IAM (OAuth2 / OIDC SSO)** พร้อมทั้งการสำรองฉุกเฉินด้วย **Break-Glass Mode**

---

## 🏗️ 2. สรุปความคืบหน้าและการพัฒนางานล่าสุด (11 กันยายน 2026)

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
| [`backend/app/migrations/add_performance_indexes.py`](file:///d:/Python/IRM/backend/app/migrations/add_performance_indexes.py) | สคริปต์รันสร้าง 13 Performance Index ใน PostgreSQL (`CREATE INDEX IF NOT EXISTS`) |
| [`backend/app/models/po.py`](file:///d:/Python/IRM/backend/app/models/po.py) | กำหนด Index บน `status`, `closed_at`, `po_header_id`, `estimate_date` |
| [`backend/app/models/group.py`](file:///d:/Python/IRM/backend/app/models/group.py) | ปรับ `Group.users` เป็น `lazy="select"` ตัดปัญหา Cascading Queries |
| [`backend/app/models/menu.py`](file:///d:/Python/IRM/backend/app/models/menu.py) | ปรับ `Menu.auth_entries` เป็น `lazy="select"` |
| [`backend/app/routers/operation.py`](file:///d:/Python/IRM/backend/app/routers/operation.py) | ลอจิก PO-Level Portal Link, ล็อคทั้ง PO, แก้ไข `base_url`, และบันทึก Audit/Transaction Logs |
| [`backend/app/routers/supplier_portal.py`](file:///d:/Python/IRM/backend/app/routers/supplier_portal.py) | แก้ MissingGreenlet ด้วย `selectinload`, ฟอร์แมตเวลาหมดอายุเป็น `Asia/Bangkok` (+07:00) |
| [`backend/app/routers/suppliers.py`](file:///d:/Python/IRM/backend/app/routers/suppliers.py) | ฟอร์แมตวันหมดอายุใน Token response เป็นเวลาไทย |
| [`backend/app/services/email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py) | เพิ่ม 12-hour cushion ใน `calculate_prd_expiry_date` ป้องกันลิงก์หมดอายุทันที |
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

# 3. รัน Migration สร้าง Performance Index ใน PostgreSQL (รันครั้งเดียวปลอดภัยด้วย IF NOT EXISTS)
docker cp backend/app/migrations/add_performance_indexes.py irm-backend:/app/app/migrations/add_performance_indexes.py
docker exec irm-backend python /app/app/migrations/add_performance_indexes.py

# 4. สั่ง Rebuild คอนเทนเนอร์ Backend และ Frontend
docker compose up -d --build irm-backend irm-frontend

# 5. ตรวจสอบสถานะการทำงาน
docker compose ps
```

---

## 📌 6. Checkpoint สำหรับการเริ่มงานในครั้งหน้า (Next Session)
* **สถานะปัจจุบัน:** โค้ดทั้งหมดได้รับการ Compile และทดสอบความถูกต้องผ่าน 100%, Git Commit & Push ขึ้น `main` (`commit 736b72b`) ครบถ้วน
* **สิ่งที่ต้องทำต่อบน VPS:** รันคำสั่งในข้อ 5 เพื่อนำ Index และฟีเจอร์ใหม่ขึ้น Production
* **เรื่องที่จะพูดคุยต่อในครั้งหน้า:** ตรวจสอบผลการใช้งานจริงบน Production หลัง Rebuild หรือขยายผลฟังก์ชันเพิ่มเติมตามที่ผู้ใช้ต้องการ
