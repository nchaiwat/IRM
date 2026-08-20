# IRM — Incoming Raw Material System

ระบบติดตามการรับวัตถุดิบ (Incoming Raw Material) สำหรับ **ฝ่ายจัดซื้อ (PU Dept.)** เพื่อวางแผนและติดตามการส่งของจาก Supplier ตาม PO บน SAP B1

> 📖 **สำหรับผู้ใช้งานทั่วไป (Non-Technical):** สามารถอ่านคู่มือการใช้งานและเงื่อนไขทั้งหมดฉบับเข้าใจง่ายได้ที่ [คู่มือการใช้งานระบบ IRM (USER_GUIDE.md)](file:///d:/Python/IRM/docs/USER_GUIDE.md)

---

## 🚀 โครงสร้าง Docker แบบแยกอิสระ (Fully Containerized on Port 80)

IRM ทำงานอยู่บน **Docker Containers 5 ตัว** แยกอิสระในวง Network ของตัวเอง (`irm-network`) ไม่ยุ่งกับโปรเจกต์อื่นในเครื่อง:

```
[ Browser / User ] ───► Port 80 (HTTP)
                             │
                      [ irm-nginx ] (Nginx Reverse Proxy)
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
      [ irm-frontend ]               [ irm-backend ]
     (Next.js App Server)          (FastAPI API Server)
              │                             │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
         [ irm-db ]                   [ irm-redis ]
       (PostgreSQL 16)                (Redis 7 Cache)
```

---

## 🛠️ วิธีการสั่งรันง่ายๆ คำสั่งเดียว

เปิด Terminal ในโฟลเดอร์ `d:\Python\IRM` แล้วรัน:

```bash
docker-compose up -d --build
```

> **คำสั่งเดียวจบ!** Docker จะ Build และเริ่มทำงาน Container ทั้ง 5 ตัวทันที:
> 1. `irm-nginx` — Reverse Proxy เปิดบริการที่ **Port 80**
> 2. `irm-frontend` — Next.js Frontend (รันอยู่ภายใน)
> 3. `irm-backend` — FastAPI Backend (รันอยู่ภายใน)
> 4. `irm-db` — PostgreSQL Database (รันอยู่ภายใน)
> 5. `irm-redis` — Redis Cache (รันอยู่ภายใน)

---

## 🌐 การเข้าใช้งานระบบ

- **เข้าใช้งาน Web Application (Port 80):** [http://localhost](http://localhost)
- **เข้าดู Swagger API Docs:** [http://localhost/docs](http://localhost/docs)

---

## 🔐 บัญชีผู้ใช้เริ่มต้น (Default Login)

- **Username:** `admin`
- **Password:** `irm@2026`

---

## 📌 เมนูในระบบ (Menu Structure)

1. 📋 **Operation** (`/operation`) — หน้าหลักฝ่ายจัดซื้อ
2. 📅 **Calendar** (`/calendar`) — ปฏิทินรอบส่งของ
3. 📦 **Item Master** (`/items`) — รหัสสินค้าและ Lead Time
4. 🏭 **Supplier Master** (`/suppliers`) — ข้อมูล Supplier
5. 📜 **History** (`/history`) — ประวัติรายการที่ Close แล้ว
6. 🛡️ **Admin** (Parent Header — Accordion)
   - ⚙️ **System Setting** (`/admin/settings`) — ตั้งค่า SMTP, เวลา Sync SAP
   - 👤 **User Management** (`/admin/users`) — จัดการผู้ใช้งาน
   - 🛡️ **Group Management** (`/admin/groups`) — จัดการกลุ่มสิทธิ์
   - 🔐 **Auth Matrix** (`/admin/auth-matrix`) — ตารางสิทธิ์ Group x Menu

---

## 📝 บันทึกสถาปัตยกรรมระบบและโซลูชันสำคัญ (System Architecture & Solutions)

### 1. การจัดการ Conflict การอัปเดตระหว่าง Supplier กับ User (Ownership Lock + State Machine)
- **หลักการ:** ป้องกันการบันทึกข้อมูลทับซ้อน (Race Condition) ด้วยสิทธิ์ความเป็นเจ้าของเรคอร์ดตามช่วงเวลา (Time-based Ownership Lock)
- **State Machine:**
  - `pending` ➔ User วางแผนวันที่คาดว่าจะส่ง (Estimate Date)
  - `awaiting_supplier` ➔ ระบบส่งลิงก์ Portal ไปยัง Supplier; ทำการ Lock เรคอร์ด (`locked_by = 'supplier'`, `lock_expires_at = วันหมดอายุรอบ`)
  - `supplier_responded` ➔ Supplier เข้ามากรอกวัน/รอบส่งผ่าน Portal และกดยืนยัน; ระบบจะคืนสิทธิ์ให้ User (`locked_by = 'user'`) และแจ้งเตือนผ่าน Telegram Group
  - `confirmed` ➔ ฝ่ายจัดซื้อกดปุ่ม **Accept** หรือแก้ไขยืนยันข้อมูล
- **ระบบ Force Override:** หากจัดซื้อมีความจำเป็นเร่งด่วนต้องแก้ไขข้อมูลขณะที่ยังอยู่ในช่วงเวลาของ Supplier ระบบจะมี Modal ให้ระบุ **เหตุผล (Reason)** และทำการปลดล็อคพร้อมบันทึกใน **Audit Trail** ทันที

### 2. ตาราง Operation สำหรับหน้าจอขนาดกะทัดรัด (14"+ Displays) และการแยกสีสถานะ Record
- **Dual Synchronized Scrollbars:** มีแถบเลื่อนซ้าย-ขวา (Mirror Scrollbar) อยู่ที่ขอบบนของตาราง ซิงค์ตำแหน่งกับการเลื่อนของตารางด้านล่างโดยอัตโนมัติ ทำให้ผู้ใช้บนจอขนาด 14 นิ้วสามารถเลื่อนดูคอลัมน์ด้านขวาได้ทันทีโดยไม่ต้องเลื่อนหน้าจอลงไปล่างสุด
- **Sticky Column Freezing:** ตรึง 3 คอลัมน์สำคัญไว้ทางซ้ายเสมอ (`#`, `PO No. / Date`, `Group`) พร้อมเงาแบ่งแยกคอลัมน์ เพื่อให้ผู้ใช้ยังคงเห็นเลข PO และกลุ่มสินค้าตลอดเวลาที่เลื่อนดูข้อมูลทางขวา
- **การแยกความแตกต่างของ Record (Visual Row Highlighting):**
  - 🟢 **Record ที่ปรับเปลี่ยนแล้ว:** แถบสีเขียวซ้ายมือ (`border-l-4 border-l-emerald-500`), พื้นหลังเขียวอ่อน, จุดสถานะเขียว พร้อมไฮไลท์ช่อง **Est. Date / Qty** เป็นสีเขียวเข้มเด่นชัด
  - 🟠 **Record ที่ Supplier ตอบกลับแล้ว:** แถบสีส้ม (`border-l-4 border-l-amber-500`), พื้นหลังส้มอ่อน พร้อม Badge แจ้งเตือนแบบกระพริบ (Pulse)
  - ⚪ **Record ที่ยังไม่ปรับเปลี่ยน:** แถบสีเทา (`border-l-4 border-l-slate-200`), พื้นหลังสีขาว, ช่อง Est. Date แสดงข้อความ `[ - ยังไม่ระบุวัน - ]`
  - 🔘 **แถบ Quick Filter Tabs:** มีปุ่มแท็บด้านบนตารางเพื่อคลิกกรองเฉพาะ *"ปรับเปลี่ยนแล้ว"* หรือ *"ยังไม่ปรับเปลี่ยน"* หรือ *"Sup ตอบกลับ"* พร้อมตัวเลขแสดงจำนวนรายการแบบ Real-time

### 3. ระบบตั้งเวลาส่งอีเมล Supplier (Scheduler), นโยบาย No-Reply และ Rate Limiting
- **ตารางเวลาอัตโนมัติ (APScheduler):**
  - **รอบที่ 1:** วันจันทร์ เวลา 08:00 น. ➔ ลิงก์หมดอายุวันพุธ 23:59:59 น.
  - **รอบที่ 2:** วันพฤหัสบดี เวลา 08:00 น. ➔ ลิงก์หมดอายุวันอาทิตย์ 23:59:59 น.
  - **รอบ Sync SAP:** ทุกวัน เวลา 04:00 น.
- **ระบบ Rate Limiting & Batch Delivery:**
  - จัดคิวส่งเป็นชุด ชุดละ **20 รายการ** พร้อมหน่วงเวลา **5 วินาที** ระหว่างชุด เพื่อป้องกัน SMTP Mail Server บล็อก
  - จำกัดการส่งสูงสุด **100 รายการ** ต่อรอบ
- **นโยบาย No-Reply:**
  - ตั้งค่า Sender `From: IRM System (No-Reply) <noreply@...>` และ `Reply-To: noreply@...`
  - มีแถบแจ้งเตือนเด่นชัดในอีเมลภาษาไทย: *"โปรดอย่า Reply หรือตอบกลับอีเมลนี้ เนื่องจากเป็นระบบอัตโนมัติที่ไม่สามารถรับข้อความตอบกลับได้"* พร้อมระบุช่องทางติดต่อฝ่ายจัดซื้อโดยตรง

### 4. การจัดการ Lifecycle ข้อมูล SAP Sync (ตรวจจับ Close, ย้ายไป History 7 วัน, ติดตาม Variance, รายการ New)
- **การตรวจจับ Record ที่ Close ใน SAP (Differential Comparison):**
  - ระบบนำ Set ของ `(po_number, item_code)` จาก Query สดจาก SAP มาเปรียบเทียบกับ Record ทั้งหมดใน IRM
  - รายการใดที่เคยมีใน IRM แต่ **ไม่ปรากฏใน Query ใหม่จาก SAP** จะถูกประเมินว่าเป็นรายการที่ **Close แล้วใน SAP**
  - ทำการ Soft-Close: ปรับ `status = 'closed'`, บันทึก `closed_at = now()` และย้ายออกจากหน้า Operation ไปยังหน้า **History** ทันที
- **การเปรียบเทียบและบันทึกส่วนต่าง (Plan vs Actual Variance):**
  - SAP เป็น Ground Truth สำหรับยอดรับจริง (`received_qty`) ส่วน IRM เก็บแผนเดิม (`estimate_qty`)
  - บันทึกลงใน **Audit Trail** อัตโนมัติ: เช่น `"ปิดรายการจาก SAP (รับจริง: 100 แผ่น, แพลนเดิม: 95 แผ่น, ผลต่าง: +5 แผ่น)"`
  - หน้า History แสดงคอลัมน์เปรียบเทียบยอด **สั่งซื้อ (PO) | แผนเดิม (Est) | รับจริง (SAP) | ผลต่าง (Variance)** อย่างชัดเจน
### 5. สิทธิ์การส่งเกินยอดสั่งซื้อ (Allow Over-Delivery Permission)
- **การกำหนดสิทธิ์:** กำหนดเปิด-ปิดสิทธิ์ `allow_over_delivery` ได้ในหน้า **Supplier Master (`/suppliers`)**
- **ฝั่ง Operation:** ในหน้าต่างแตกงวดส่ง (Inline Split Editor) หาก Supplier มีสิทธิ์ส่งเกิน ระบบจะอนุญาตให้กรอกยอดรวมเกินยอดคงเหลือ (Remaining Qty) และบันทึกลงระบบได้ทันที
- **ฝั่ง Supplier Portal:** ระบบจะไม่บล็อกข้อความเตือนสีแดง และอนุญาตให้คู่ค้าบันทึกร่างและกดยืนยันส่งมอบจริงที่มีจำนวนเกินได้ โดยฝ่ายจัดซื้อสามารถตรวจสอบได้ในหน้า Operation

### 6. การแจ้งเตือน Telegram กลาง (Standard Header & Rich Emojis)
- ทุก Incident ในระบบส่งผ่านโมดูล `telegram_service` เพื่อควบคุม Header มาตรฐานเดียวกัน:
  ```text
  📦 IRM System · 19 ส.ค. 2569 16:55 น.
  ────────────────────────────
  [Topic / หัวข้อการแจ้งเตือน]

  • 🏢 [รายละเอียดพร้อม Contextual Emoji ...]
  ```
- เพิ่ม Emoji หลากหลายและชัดเจนในทุก Bullet Point เพื่อความสบายตาและอ่านข้อมูลได้รวดเร็วทันที

### 7. มาตรฐานชื่อไฟล์ Export CSV
- ทุกไฟล์ที่ถูก Export ออกมาจากระบบจะใช้รูปแบบชื่อเดียวกัน: `IRM_<ModuleName>_YYYYMMDD_HHMMSS.csv`
- เช่น `IRM_Item_Master_Export_20260819_172811.csv`, `IRM_Supplier_Master_Export_20260819_172811.csv`

### 8. ประวัติการแก้ไข (Audit Trail Sorted Newest First)
- หน้าต่าง Audit Trail (ไอคอนนาฬิกา 🕘) เรียงลำดับเหตุการณ์ **ล่าสุดขึ้นมาอยู่บนสุดเสมอ** พร้อมป้ายแท็กไฮไลต์ **`ล่าสุด`**

### 9. การป้องกันข้อมูลและอีเมล (Data Integrity & Safe Sync)
- **Safe Sync:** การ Sync ข้อมูลจาก SAP จะไม่เขียนทับ Email หรือ Group ที่ผู้ใช้แก้ไขในระบบ IRM
- **Auto-Sanitization:** ล้างตัวอักษรภาษาไทยที่พิมพ์ผิดพลาดในช่อง Email อัตโนมัติ (เช่น `ืn.chaiwat@gmail.com` ➔ `n.chaiwat@gmail.com`)
- **UTF-8 Email Standard:** ใช้โมดูล `email.message.EmailMessage` เพื่อการเข้ารหัส UTF-8 ภาษาไทยสมบูรณ์แบบ 100%

