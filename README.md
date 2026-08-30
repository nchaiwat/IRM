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

- **เข้าใช้งาน Web Application (Port 80):** [http://localhost](http://localhost) (หรือ `https://irm.windowasia.com` บน Production)
- **เข้าดู Swagger API Docs:** [http://localhost/docs](http://localhost/docs)

---

## 🔐 บัญชีผู้ใช้เริ่มต้น (Default Login)

- **Username:** `admin`
- **Password:** `irm@2026`

---

## 📌 เมนูในระบบ (Menu Structure)

1. 📊 **Dashboard** (`/dashboard`) — สรุปสถิติ PO, กลุ่มสินค้า 7 กลุ่ม, Top Supplier ค้างส่ง
2. ⚡ **Operation** (`/operation`) — หน้าหลักฝ่ายจัดซื้อ พร้อม 10 Filter Tabs, Split Delivery, Over-Delivery
3. 📅 **Calendar** (`/calendar`) — ปฏิทินรอบส่งของ แสดงรายการ Confirmed และ Estimate พร้อมชื่อ Buyer
4. 📦 **Item Master** (`/items`) — รหัสสินค้า, Lead Time Days, Notify Alert Days และระบบ Accept สินค้าใหม่
5. 🏭 **Supplier Master** (`/suppliers`) — ข้อมูล Supplier, สิทธิ์ส่งเกิน PO, สร้าง Token Portal, ปุ่มกระจายส่ง Email
6. 📜 **History** (`/history`) — ประวัติรายการที่ Close ใน SAP แล้ว พร้อมวิเคราะห์ Plan vs Actual และ 2 Filter Tabs
7. 🛡️ **Admin** (Parent Header — Accordion)
   - ⚙️ **System Setting** (`/admin/settings`) — ตั้งค่า SMTP, เวลา Sync SAP, Token Telegram, Data Retention
   - 👤 **User Management** (`/admin/users`) — จัดการผู้ใช้งานและกลุ่ม
   - 🛡️ **Group Management** (`/admin/groups`) — จัดการกลุ่มสิทธิ์
   - 🔐 **Auth Matrix** (`/admin/auth-matrix`) — ตารางสิทธิ์ Group x Menu ระดับ Granular
   - 📑 **Audit Logs** (`/admin/logs`) — บันทึกประวัติการเปลี่ยนแปลงระบบทั้งหมด

---

## 📝 บันทึกสถาปัตยกรรมระบบและโซลูชันสำคัญ (System Architecture & Solutions)

### 1. การซิงค์ข้อมูลจาก SAP B1 (One-Way Inbound Synchronization)
- **ทิศทางข้อมูล:** อ่านข้อมูลทางเดียวจาก SAP MS SQL Server (`wa-dbs2.wa.net` - Report 8) เข้า IRM วันละ 1 ครั้งตามเวลาที่ตั้งไว้ (08:00 น. หรือตามกำหนดใน System Settings)
- **Zero Write-Back:** IRM **ไม่มีการเขียนหรือแก้ไขข้อมูลใดๆ กลับไปยังฐานข้อมูล SAP**
- **Differential Closed Detection:** ตรวจจับรายการที่รับของครบหรือปิดยอดใน SAP เพื่อย้ายเข้าสู่หน้า History อัตโนมัติ (เก็บประวัติ 7 วัน)

### 2. การจัดการ Conflict การอัปเดตระหว่าง Supplier กับ User (Ownership Lock + State Machine)
- **หลักการ:** ป้องกันการบันทึกข้อมูลทับซ้อน (Race Condition) ด้วยสิทธิ์ความเป็นเจ้าของเรคอร์ดตามช่วงเวลา (Time-based Ownership Lock)
- **State Machine:**
  - `pending` ➔ User วางแผนวันที่คาดว่าจะส่ง (Estimate Date)
  - `awaiting_supplier` ➔ ระบบส่งลิงก์ Portal ไปยัง Supplier; ทำการ Lock เรคอร์ด (`locked_by = 'supplier'`, `lock_expires_at = วันหมดอายุรอบ`)
  - `supplier_responded` ➔ Supplier เข้ามากรอกวัน/รอบส่งผ่าน Portal และกดยืนยัน; ระบบจะคืนสิทธิ์ให้ User (`locked_by = 'user'`) และแจ้งเตือนผ่าน Telegram
  - `confirmed` ➔ ฝ่ายจัดซื้อกดปุ่ม **Accept** หรือแก้ไขยืนยันข้อมูล
- **ระบบ Force Override:** หากจัดซื้อมีความจำเป็นเร่งด่วนต้องแก้ไขข้อมูลขณะที่ยังอยู่ในช่วงเวลาของ Supplier ระบบจะมี Modal ให้ระบุเหตุผล (Reason) และปลดล็อคพร้อมบันทึกลง Audit Trail ทันที

### 3. ระบบแจ้งเตือน Telegram Notification Suite
- **08:00 AM Morning Summary Report:** สรุป 4 หมวด: Dashboard, Item Master, Supplier Master, History
- **QMS API Inbound Pull Alert:** แจ้งเตือนทันทีเมื่อระบบ QMS ดึงข้อมูล Confirmed Deliveries (พร้อมสรุปจำนวนรายการ, วันที่, IP)
- **Monday & Thursday Email Broadcast Report:** แจ้งเตือนผลการส่งอีเมลให้ Supplier อัตโนมัติในเช้าวันจันทร์และวันพฤหัสบดี (08:00 น.)
- **SAP Sync Alert:** แจ้งเตือนสรุปผลการซิงค์ SAP ประจำวันทันทีที่เสร็จสิ้น

---

## 🚀 คำสั่ง Deploy บน VPS Production (`/var/www/Irm`)

```bash
cd /var/www/Irm
git pull origin main
docker compose up -d --build
```
