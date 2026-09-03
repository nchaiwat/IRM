# IRM — Incoming Raw Material Management System
**Version:** 1.0.0 (Production-Ready)  
**Organization:** Window Asia Public Company Limited  
**Production URL:** [https://irm.windowasia.com](https://irm.windowasia.com)  
**VPS Hostinger Path:** `/var/www/Irm`  
**Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)

---

## 📖 เกี่ยวกับระบบ IRM (System Overview)

ระบบ **IRM (Incoming Raw Material)** พัฒนาขึ้นสำหรับ **ฝ่ายจัดซื้อ (Purchasing Dept.)**, **ฝ่ายวางแผนการผลิต (Production Planning)**, และ **ฝ่ายคลังสินค้า (Warehouse)** ของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) เพื่อติดตามการส่งมอบวัตถุดิบ 7 กลุ่มหลัก (กระจก, อลูมิเนียม, UPVC, ฮาร์ดแวร์, Sparepart, เหล็กดัด, Partner) จากระบบ **SAP Business One** เชื่อมโยงกับคู่ค้าผ่าน **Supplier Portal แบบเข้ารหัสความปลอดภัยสูง**, วางแผนนัดหมายผ่าน **ปฏิทินส่งของ (Calendar)**, พิมพ์ใบตรวจรับสินค้าจริง (**Receiving Checklist**), และส่งต่อข้อมูลตรวจรับไปยังระบบ **QMS (Quality Management System)**

> 📘 **คู่มือและพิมพ์เขียวระบบ:**
> * สำหรับผู้ใช้งานทั่วไป: [คู่มือการใช้งานระบบ IRM (USER_GUIDE.md)](file:///d:/Python/IRM/docs/USER_GUIDE.md)
> * สถาปัตยกรรมและกฎเงื่อนไขครบวงจร: หน้า **System Blueprint** ในระบบ (`/system-blueprint`)
> * เอกสารมาตรฐาน Identity Management: [CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md](file:///d:/Python/IRM/docs/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md)
> * พิมพ์เขียว Central IAM Application: `D:\Python\Central-IAM\PRD.md`

---

## 🏗️ โครงสร้าง Docker แบบแยกอิสระ (Fully Containerized on Port 80)

IRM ทำงานอยู่บน **Docker Containers 5 ตัว** แยกอิสระในวง Network ของตัวเอง (`irm-network`) ไม่รบกวนโปรเจกต์อื่น:

```
[ Browser / User / External API ] ───► Port 80 (HTTP / Nginx Reverse Proxy)
                                              │
                                      [ irm-nginx ]
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
              [ irm-frontend ]                                 [ irm-backend ]
             (Next.js 15 Server)                             (FastAPI Python 3.11)
                      │                                               │
                      └───────────────────────┬───────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
                 [ irm-db ]                                     [ irm-redis ]
             (PostgreSQL 16 DB)                                (Redis 7 Cache)
```

---

## 🛠️ วิธีการสั่งรันบนเครื่อง Local (Windows)

เปิด Terminal ในโฟลเดอร์โปรเจกต์ แล้วสั่ง:

```bash
docker-compose up -d --build
```

> **Container ทั้ง 5 ตัวจะ Build และเริ่มทำงานทันที:**
> 1. `irm-nginx` — Reverse Proxy ให้บริการที่ **Port 80**
> 2. `irm-frontend` — Next.js 15 Web Application (พอร์ตภายใน 3000)
> 3. `irm-backend` — FastAPI Core API Server (พอร์ตภายใน 8000)
> 4. `irm-db` — PostgreSQL 16 Database (พอร์ตภายใน 5432)
> 5. `irm-redis` — Redis 7 In-memory Cache & Task Queue (พอร์ตภายใน 6379)

---

## 🌐 การเข้าใช้งานระบบและ API Docs

- **Web Application:** [http://localhost](http://localhost) (หรือ `https://irm.windowasia.com` บน VPS)
- **Swagger API Documentation:** [http://localhost/docs](http://localhost/docs)
- **ReDoc Interactive Documentation:** [http://localhost/redoc](http://localhost/redoc)

---

## 🔐 บัญชีผู้ใช้เริ่มต้น (Default Credentials)

- **Username:** `admin`
- **Password:** `irm@2026`
- **User อื่นๆ ที่มีในระบบ:** `Patcha.S` (จัดซื้อ), `Pinyada.S` (จัดซื้อ)

---

## 📌 โครงสร้างเมนูหลัก (Official Menu Architecture)

เมนูในระบบจัดเรียงตามลำดับโฟลว์การทำงานจริงขององค์กร ดังนี้:

1. 📊 **Dashboard (`/dashboard`):** สรุปสถิติ PO ค้างส่ง, ยอดแยกตาม 7 กลุ่มสินค้า, Top Suppliers, และแจ้งเตือนด่วน
2. ⚡ **Operation (`/operation`):** ศูนย์กลางงานจัดซื้อ จัดการ Estimate Date, แตกงวดส่ง (Sub-items), 10 Filter Tabs, Over-Delivery Warning, และระบบ Ownership Lock
3. 📅 **Calendar (`/calendar`):** ปฏิทินส่งของ มีโหมด **"รายเดือน"** และ **"รายปี" (12 เดือน)** พร้อมระบบ **Universal Search** ค้นหาได้ทุกคำข้ามปีแบบ Real-time
4. 📋 **Receiving Checklist (`/receiving-checklist`):** ใบตรวจรับสินค้าประจำวันสำหรับคลังสินค้า, รปภ., และ QC พร้อมปุ่มสั่งพิมพ์ A4 แนวนอน (Print-Ready)
5. 📦 **Item Master (`/items`):** ฐานข้อมูลรหัสสินค้า, กำหนด Lead Time Days, Notify Alert Days และระบบ Accept สินค้าใหม่ (ระบบ Append-Only ไม่ลบข้อมูล)
6. 🏭 **Supplier Master (`/suppliers`):** ฐานข้อมูลคู่ค้า, จัดการอีเมล, สิทธิ์ส่งเกิน PO (Allow Over-Delivery), ปุ่มสร้าง Token และส่งอีเมลเชิญเข้า Portal
7. 📜 **History (`/history`):** ประวัติ PO ที่ปิดยอดรับครบใน SAP แล้ว (LineStatus = 'C') พร้อมวิเคราะห์ Plan vs Actual และ Filter "ปิดเมื่อวาน"
8. 🧭 **System Blueprint (`/system-blueprint`):** ผังพิมพ์เขียวระบบ อธิบาย 5-Step Pipeline, กฎ Conditions, สิทธิ์ User Roles, ตารางเวลาอัตโนมัติ และชุดคำสั่ง AI Prompts ภาษาไทยสำหรับสร้าง Presentation/Infographic
9. 🛡️ **Admin (เมนูย่อยระดับผู้ดูแลระบบ):**
   - ⚙️ **System Setting (`/admin/settings`):** ตั้งค่า SMTP, เวลาซิงค์ SAP, Telegram Token, Central IAM API Key และ IP Whitelisting
   - 👤 **User Management (`/admin/users`):** บริหารจัดการบัญชีผู้ใช้งาน, ฝ่าย, Telegram Chat ID, และสิทธิ์ AD
   - 🛡️ **Group Management (`/admin/groups`):** จัดการกลุ่มผู้ใช้งานและกำหนดหน้าเริ่มต้น (Default Landing Page)
   - 🔐 **Auth Matrix (`/admin/auth-matrix`):** กำหนดสิทธิ์ View, Create, Edit, Delete รายเมนูแบบ Dynamic
   - 📈 **Transaction Logs (`/admin/logs`):** ตรวจสอบ Audit Trail การแก้ไขข้อมูลและการเรียก API ทั้งหมด

---

## 🔑 ฟังก์ชันและกลไกสำคัญของระบบ (Key Features & Logic)

### 1. การซิงค์ข้อมูลจาก SAP B1 (One-Way Sync & Zero Write-Back)
* ดึงข้อมูล PO เปิด (Open PO) เฉพาะกลุ่มวัตถุดิบจาก SAP MS SQL Server (`Report 8`) ทุกวันเวลา 04:00 น.
* **ไม่มีการเขียนข้อมูลกลับไปแก้ไขใน SAP เด็ดขาด**
* ตรวจจับรายการที่ปิดยอดใน SAP เพื่อย้ายเข้าหน้า History อัตโนมัติ

### 2. กลไก Supplier Portal Token & Reuse Logic
* **รอบเวลาตาม PRD:**
  * รอบวันจันทร์ 08:00 น. ➔ หมดอายุ **คืนวันพุธ 23:59:59 น.**
  * รอบวันพฤหัสบดี 08:00 น. ➔ หมดอายุ **คืนวันอาทิตย์ 23:59:59 น.**
* **Reuse Token:** การส่งอีเมลซ้ำ หรือการกด Copy Link ในรอบเดียวกัน จะใช้ Token และ URL เดิม ไม่ตัดสิทธิ์หรือทำให้ลิงก์เดิมเสีย
* **Single-PO Token:** ลิงก์ด่วนราย PO สำหรับส่งผ่าน Line มีอายุ 1 ชั่วโมง (และ Reuse เช่นกัน)
* **One-Time Submit Lock:** ทันทีที่ Supplier กด Submit แล้ว ลิงก์จะถูกล็อคเป็น Expired ทันทีเพื่อความปลอดภัย

### 3. กฎความปลอดภัยและการสะสม Master (Append-Only)
* **Item Master & Supplier Master:** ข้อมูลมีแต่เพิ่มขึ้น (Append-Only) ไม่มีการลบออกหรือลดลง
* **Existing Items:** หากมีข้อมูลจาก SAP ตรงกับรหัสสินค้าที่มีอยู่แล้ว ระบบจะ **ไม่แตะต้อง Lead Time และ Notify Alert Days** (คงค่าเดิมที่จัดซื้อตั้งไว้ 100%) และถือว่าข้อมูลนั้นไม่ใหม่ (`is_new = False`)

### 4. Central Identity Management API (SCIM-Like Integration)
* ให้บริการ Endpoint มาตรฐานสำหรับ Central IAM ในการควบคุมสิทธิ์พนักงาน:
  * `GET /api/v1/directory/accounts` — ดึงบัญชีทั้งหมดไปทำ Reconciliation
  * `PATCH /api/v1/directory/accounts/{username}/status` — คำสั่งระงับสิทธิ์พนักงานลาออกทันที (Instant Offboarding)
* ควบคุมความปลอดภัยด้วย `X-Management-API-Key` และ IP Whitelisting

### 5. Telegram Notification Suite
* `08:00 น. ทุกวัน` ➔ สรุปภาพรวมเช้า (Morning Briefing)
* `08:00 น. จันทร์ & พฤหัสบดี` ➔ สรุปผลการส่งอีเมลเชิญ Supplier
* `08:30 น. ทุกวัน` ➔ ส่งอีเมลแจ้งเตือนจัดซื้อพร้อมแนบ Excel 2 Sheet
* `Real-time` ➔ แจ้งเตือนเมื่อ QMS เข้ามาดึงข้อมูลการส่งมอบ

---

## 🚀 คำสั่งอัปเดตระบบบน VPS Hostinger (`/var/www/Irm`)

```bash
cd /var/www/Irm
git pull origin main
docker compose up -d --build
```
