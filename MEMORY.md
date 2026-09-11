# 🧠 IRM Project — MEMORY & WORKFLOW RULES

> **บันทึกข้อตกลง กฎเหล็ก และบริบทสำคัญของระบบ IRM (Incoming Raw Material)**  
> **อัปเดตล่าสุด:** 9 กันยายน 2026  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **Production URL:** `https://irm.windowasia.com`  
> **VPS Hostinger Path:** `/var/www/Irm`

---

## 🚨 1. กฎเหล็กในการทำงานกับ User (Strict Protocol — ห้ามลืมเด็ดขาด)

### 1.1 กระบวนการจบงานทุกครั้งหลัง Modify เสร็จ (CRITICAL Mandatory Workflow)
**เมื่อทำงานแก้ไขโค้ด (Modify) เสร็จสิ้นในทุกๆ รอบ ให้ปฏิบัติตามลำดับขั้นตอนนี้เสมอโดยอัตโนมัติ โดยที่ User ไม่จำเป็นต้องทักหรือร้องขอ:**
1. **Compile & ตรวจสอบความถูกต้องบน Local ให้เรียบร้อย 100%:**
   - **Backend:** ตรวจสอบ Syntax และการทำงานของ API
   - **Frontend:** ตรวจสอบ Next.js Type Check & Build ให้ผ่านสมบูรณ์
2. **รายงานสรุปสถานะให้ User ทราบ:**
   - แจ้งให้ชัดเจนว่าระบบ Compile ผ่านเรียบร้อยดี หรือมีจุดใดติดขัดหรือไม่
3. **Auto Git Push:**
   - ทำการ `git add .`, `git commit -m "..."`, และ `git push origin main` ขึ้น GitHub ให้เรียบร้อยก่อนส่งมอบงานทุกครั้ง
4. **ปิดท้ายคำตอบด้วยชุดคำสั่งรันบน VPS เสมอ (ห้ามลืมเด็ดขาด):**
   ```bash
   # 1. ไปที่โฟลเดอร์โปรเจกต์ IRM บน VPS
   cd /var/www/Irm
   # 2. ดึงโค้ดล่าสุดจาก GitHub
   git pull origin main
   # 3. สั่ง Rebuild คอนเทนเนอร์ Backend และ Frontend (รันเฉพาะตัวที่แก้ ไม่กระทบ DB และ Redis เดิม)
   docker compose up -d --build irm-backend irm-frontend
   ```
   *(หากมีการเปลี่ยนแปลงโครงสร้าง Database ให้แนบคำสั่ง `docker exec -i irm-backend python backend/scripts/...` ตามความจำเป็น)*

### 1.2 สไตล์การสื่อสาร (Communication Style)
* **กระชับ ชัดเจน ตรงประเด็น ไม่เยิ่นเย้อ:** สรุปสาระสำคัญเป็นข้อๆ หลีกเลี่ยงคำบรรยายที่เวิ่นเว้อ
* ทุกคำตอบต้องสะท้อนโค้ดจริงในระบบเสมอ

### 1.3 กฎ Route Precedence ของ FastAPI
* ใน FastAPI ต้องประกาศ Route ที่เป็น **Literal Path** (เช่น `/bulk-update`, `/send-all-portal-emails`, `/sync-sap`, `/inbound-deliveries`) **ก่อน (Before)** Route ที่มี **Path Parameter** (เช่น `/{supplier_id}`, `/{item_id}`, `/{user_id}`) เสมอ เพื่อป้องกัน Error 422

### 1.4 กฎการแก้ไขเฉพาะจุดและห้ามกระทบ Logic UX/UI เดิม (Surgical Edits & Preserve Existing Logic/UI)
* **แก้เฉพาะจุดที่ต้องการเท่านั้น (Surgical Modifications Only):** แก้ไขตรงจุดที่ได้รับมอบหมาย ห้ามแก้ลามไปยังโมดูลหรือฟังก์ชันอื่นที่ไม่เกี่ยวข้องโดยเด็ดขาด
* **ห้ามเปลี่ยนแปลง Logic หรือ UX/UI เดิมที่ใช้งานได้ดีอยู่แล้ว:** รักษาพฤติกรรมการทำงานเดิม, โครงสร้างหน้าตา, และ Workflow เดิมที่ทำงานถูกต้องไว้ 100% ห้ามรื้อหรือปรับแต่งส่วนอื่นโดยพลการ
* **ทิศทางและโทนสีของ UI/UX ต้องกลมกลืนและสอดคล้องกัน (Design Tone Consistency):**
  * หน้าการตั้งค่า (System Settings) และหน้าจอทำงานหลัก ต้องเน้นความสะอาด คลีน เรียบหรูในโทนเดียวกัน (Corporate Light Theme)
  * **ไม่มีอะไรให้โดดเด่นเป็นพิเศษเกินความจำเป็น:** ห้ามใช้ Dark Background หรือ Widget สีตัดที่ดึงสายตาและสร้างความซ้ำซ้อน
  * สถานะความพร้อมการทำงาน (Health/Active Status) ให้แสดงเป็น **ไอคอนหรือ Status Pill Badge เล็กๆ เรียบหรู** กำกับข้างหัวข้อในแต่ละการ์ด (เช่น `[ 🟢 Active / Ready ]`)
  * **ไม่ทำข้อมูลหรือสถิติกระจัดกระจาย:** ข้อมูลการเชื่อมต่อหรือ Logs ทุกชนิดต้องรวมศูนย์ไว้ที่ **Transaction Logs (`/admin/logs`)** เท่านั้น ไม่สร้างกล่องสถิติยิบย่อยซ้ำซ้อนในหน้า Settings

### 1.5 กฎมาตรฐานวันที่บริสุทธิ์ (Pure Date Standard) และรูปแบบ dd/mm/yyyy ทั่วทั้งระบบ
* **Pure Date Only:** ข้อมูลวันที่ส่งมอบ (`estimate_date`, `due_date`, `po_date`, `delivery_date`) ในฐานข้อมูลต้องเป็นประเภท `DATE` และใน Python ต้องเป็น `datetime.date` เท่านั้น (ห้ามใช้ `TIMESTAMPTZ` หรือเก็บเวลา 00:00 UTC ที่ทำให้เกิด Date Shift ข้ามวันเด็ดขาด)
* **มาตรฐานการแสดงผล `dd/mm/yyyy` (ค.ศ.):**
  * ทุกหน้าจอ (Operation, Calendar, Receiving Checklist, History, Master, Portal) ต้องแสดงผลวันที่เป็น **`dd/mm/yyyy`** (เช่น `08/09/2026`)
  * ฟังก์ชันแปลงวันที่ต้องจัดการสตริง `YYYY-MM-DD` เป็น `dd/mm/yyyy` โดยตรง ไม่ผ่าน `new Date(str)` ที่เสี่ยงต่อการโดน UTC ดึงวันถอยหลัง
  * ช่องรับค่า (Input) ต้องรับในรูปแบบ `dd/mm/yyyy` และแปลงเป็น `YYYY-MM-DD` ก่อนส่งบันทึกเข้า API
  * การเปรียบเทียบ Overdue / Near Due ให้เปรียบเทียบกับวันที่ปัจจุบันของ `Asia/Bangkok` เที่ยงคืนตรงวันเสมอ

---

## 📌 2. ลำดับเมนูที่เป็นทางการของระบบ (Official Menu Order)

เมนูในระบบถูกกำหนดลำดับและจัดเรียงไว้ดังนี้:
1. **Dashboard** (`/dashboard`)
2. **Operation** (`/operation`)
3. **Calendar** (`/calendar`)
4. **Receiving Checklist** (`/receiving-checklist`) *(ต่อจาก Calendar)*
5. **Item Master** (`/items`)
6. **Supplier Master** (`/suppliers`)
7. **History** (`/history`)
8. **System Blueprint** (`/system-blueprint`) *(ต่อจาก History)*
9. **Admin** (System Setting, User Management, Group Management, Auth Matrix, Logs)

---

## 🔑 3. สรุป Business Logic และกลไกหลักของระบบ

### 3.1 การซิงค์ SAP B1 (One-Way Inbound)
* ซิงค์ข้อมูล PO สถานะ Open (O) จาก SAP MS SQL Server (`Report 8`) ทุกวันเวลา 06:45 น. (ไม่มี 04:00 น. ในระบบแล้ว)
* **ไม่มีการเขียนข้อมูลกลับไปแก้ไขที่ SAP เด็ดขาด (Zero Write-Back)**
* รายการที่รับครบใน SAP (`LineStatus = 'C'`) จะถูกย้ายเข้าหน้า History อัตโนมัติ

### 3.2 กฎความปลอดภัยและการสะสม Master (Append-Only Masters)
* **Item Master และ Supplier Master:** ข้อมูลมีแต่เพิ่มขึ้นเรื่อยๆ **ไม่มีการลบออกหรือลดลงเด็ดขาด**
* **คำจำกัดความของ "สินค้าใหม่" (Item `is_new` Logic):**
  * ข้อมูลดึงมาจาก SAP มีทั้งเพิ่มขึ้นและลดลงจากเมื่อวาน
  * **เฉพาะ Item ที่เพิ่งปรากฏเพิ่มขึ้นใหม่จากรอบเมื่อวานเท่านั้นที่จะถือว่าเป็นสินค้าใหม่ (`is_new = True`)**
  * เมื่อข้ามวัน หรือมีอยู่ใน Master เดิมอยู่แล้ว จะถือว่า **"ไม่ใหม่" (`is_new = False`)** ทันที
  * เมื่อข้อมูลจาก SAP ตรงกับรายการเดิมใน Item Master:
    * **ห้ามแตะต้องและห้ามแก้ไขทับ** ทั้ง `lead_time_days` และ `notify_alert_days` (คงค่าเดิมที่จัดซื้อตั้งไว้ 100%)
* **Supplier Master:** คงค่าการติดต่อและสิทธิ์ `allow_over_delivery` เดิมไว้เสมอ

### 3.3 กลไก Supplier Portal Token & Reuse Logic
* **รอบเวลาหมดอายุตาม PRD:**
  * รอบวันจันทร์ 08:00 น. ➔ หมดอายุ **คืนวันพุธ เวลา 23:59:59 น.**
  * รอบวันพฤหัสบดี 08:00 น. ➔ หมดอายุ **คืนวันอาทิตย์ เวลา 23:59:59 น.**
* **Reuse Active Token:** การส่งอีเมลซ้ำ หรือการ Copy Link ในรอบเดียวกัน จะ **ใช้ Token และ URL เดิม** ไม่ตัดสิทธิ์หรือทำให้ลิงก์เดิมในอีเมลเสีย
* **Single-PO Token:** ลิงก์ด่วนราย PO สำหรับส่งทาง Line มีอายุ 1 ชั่วโมง (และ Reuse เช่นกัน)
* **One-Time Submit Lock:** เมื่อ Supplier กด Submit แล้ว ลิงก์จะถูกล็อค (Expired) ทันที

### 3.4 ฟังก์ชันหน้า Calendar: โหมดรายปี & Universal Search
* **โหมดรายเดือน vs รายปี:** สลับดูตารางเดือน หรือการ์ดสรุป 12 เดือนของทั้งปี
* **Universal Search:** ช่องค้นหาคำค้นด่วนแบบ Real-time ค้นหาได้ทุกคำ (PO, รหัสสินค้า, ชื่อสินค้า, ชื่อคู่ค้า) ข้ามปี พร้อมปุ่ม "ไปที่วัน" เปิดดูรายละเอียดทันที

### 3.5 หน้า Receiving Checklist (ใบตรวจรับสินค้าจริง)
* สรุปรายการสินค้าที่มีนัดส่งมอบในวันที่เลือกสำหรับคลังสินค้า, รปภ., และ QC
* มีช่องกรอกผลตรวจรับ, ทะเบียนรถ, จำนวนรับจริง พร้อมปุ่มสั่งพิมพ์ A4 แนวนอน (Print-Ready)

### 3.6 หน้า System Blueprint (พิมพ์เขียวระบบ)
* หน้ารวมสถาปัตยกรรมระบบ 5 ขั้นตอน, กฎเงื่อนไข (Conditions), ตารางสิทธิ์ User Roles, กลไกความปลอดภัย Token, ไทม์ไลน์เวลาอัตโนมัติ
* มีปุ่มคัดลอก **AI Prompts ภาษาไทย** สำหรับนำไปสร้าง Presentation และ Infographic

### 3.7 Central Identity Management API (SCIM-Like Integration)
* ให้บริการ Endpoint มาตรฐานสำหรับเชื่อมต่อกับระบบ Central IAM ของบริษัท:
  * `GET /api/v1/directory/accounts` — ดึงบัญชีทั้งหมดไปตรวจสอบ (Reconciliation)
  * `PATCH /api/v1/directory/accounts/{username}/status` — ระงับสิทธิ์พนักงานลาออกทันที (Instant Offboarding)
  * `POST /api/v1/directory/accounts` — สร้างบัญชีผู้ใช้งานใหม่แบบ Real-time (Instant Provisioning)
* ควบคุมความปลอดภัยด้วย `X-Management-API-Key` และ IP Whitelisting
* จัดทำเอกสารข้อกำหนดระดับองค์กร: [`docs/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md`](file:///d:/Python/IRM/docs/CENTRAL_IDENTITY_MANAGEMENT_API_SPEC.md) และพิมพ์เขียวแอปพลิเคชันส่วนกลาง: `D:\Python\Central-IAM\PRD.md`

### 3.8 การเชื่อมต่อ QMS Inbound Deliveries Integration API
* QMS เป็นฝ่ายดึงข้อมูลเข้าหาตัวเอง (Pull Model): `GET /api/external/qms/inbound-deliveries`
* IRM ไม่เป็นผู้ยิงส่งข้อมูลออกไป ไม่มีปุ่มทดสอบส่ง JSON
* ทุกคำขอจาก QMS ถูกบันทึกลงใน **Transaction Logs** โดยตรง และแจ้งเตือนผ่าน Telegram แบบ Real-time

### 3.10 การแจ้งเตือนยอดวัตถุดิบขาเข้าประจำวันรายบุคคล (Daily Inbound Telegram DM for Non-PU Staff)
* **วัตถุประสงค์:** แจ้งข้อมูลสินค้าเข้าทุกเช้าให้กับแต่ละหน่วยงานที่ไม่ใช่ PU (PC, สโตร์/คลัง, QC) ล่วงหน้าเฉพาะกลุ่มสินค้าที่ตนเองรับผิดชอบ
* **ส่งตรงรายบุคคล (DM):** ส่งข้อความเข้า Telegram Chat ID ของพนักงานแต่ละคนตามที่ระบุใน User Management
* **คัดกรองตามกลุ่มสินค้า (Item Groups):** สรุป 3 ส่วน: 1) ของเข้าวันนี้, 2) ประมาณการ 7 วันข้างหน้า, 3) รายการค้างส่งเกินกำหนด (Overdue)
* **Master Safeguard Switch:** สวิตช์หลักใน System Settings สำหรับ Admin เปิด/ปิดระบบ DM ภาพรวม พร้อมช่องกำหนดเวลาส่ง (07:30 น.) และแถบจำลองการส่งทดสอบ (Test Simulation)
### 3.11 การเพิ่มประสิทธิภาพฐานข้อมูล (Database Performance) และ PO-Level Portal Token
* **PostgreSQL Indexes:** ตาราง `po_items`, `sub_items`, `po_headers`, `po_item_audit_logs`, `users` มี Index บน Foreign Key และเงื่อนไข Filter หลักทั้งหมด ป้องกัน Sequential Scan
* **Eliminate Cascade Queries:** ยกเลิก `lazy="selectin"` บน `Group.users` และ `Menu.auth_entries` เปลี่ยนเป็น `lazy="select"` เพื่อหยุดการโหลด User และ Menu ซ้ำซ้อนหลายสิบ Query ต่อ Request
* **PO-Level Portal Link & Lock:** ปุ่ม `[ 🔗 ]` บนหน้า Operation สร้าง Token ระดับ PO และล็อค **ทุกรายการใน PO นั้น** เป็น `awaiting_supplier` และ `locked_by = 'supplier'`
* **Token Expiry Standard:** ใช้วันหมดอายุรอบ PRD (พุธ 23:59 น. / อาทิตย์ 23:59 น.) พร้อม Cushion ขั้นต่ำ 12 ชม. และฟอร์แมตเวลาแสดงผลเป็น `Asia/Bangkok` (+07:00)

---

## 🛠️ 4. คำสั่งสำคัญในการดูแลระบบ

### บนเครื่อง Local (Windows):
```powershell
# รันระบบ Local ผ่าน Docker
docker-compose up -d --build

# ตรวจสอบการ Build Frontend
cd frontend; npm run build

# ตรวจสอบ Python Syntax Backend
python -m py_compile backend/app/services/*.py backend/app/routers/*.py
```

### บน VPS Hostinger (`/var/www/Irm`):
```bash
cd /var/www/Irm
git pull origin main

# รัน Migration สร้าง Performance Index ใน PostgreSQL
docker cp backend/app/migrations/add_performance_indexes.py irm-backend:/app/app/migrations/add_performance_indexes.py
docker exec irm-backend python /app/app/migrations/add_performance_indexes.py

# Rebuild คอนเทนเนอร์ Backend และ Frontend
docker compose up -d --build irm-backend irm-frontend
```
