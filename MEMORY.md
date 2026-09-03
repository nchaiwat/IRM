# 🧠 IRM Project — MEMORY & WORKFLOW RULES

> **บันทึกข้อตกลง กฎเหล็ก และบริบทสำคัญของระบบ IRM (Incoming Raw Material)**  
> **อัปเดตล่าสุด:** 3 กันยายน 2026  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **Production URL:** `https://irm.windowasia.com`  
> **VPS Hostinger Path:** `/var/www/Irm`

---

## 🚨 1. กฎเหล็กในการทำงานกับ User (Strict Protocol)

### 1.1 รูปแบบคำสั่ง VPS (CRITICAL — ห้ามเยิ่นเย้อเด็ดขาด)
* เมื่อแจ้งคำสั่งสำหรับรันบน VPS ให้แสดงเฉพาะคำสั่งสั้นๆ 3 บรรทัดนี้เท่านั้น ไม่ต้องใส่คำอธิบายยืดยาว:
  ```bash
  cd /var/www/Irm
  git pull origin main
  docker compose up -d --build
  ```

### 1.2 สไตล์การสื่อสาร (Communication Style)
* **กระชับ ชัดเจน ตรงประเด็น ไม่เยิ่นเย้อ:** สรุปสาระสำคัญเป็นข้อๆ หลีกเลี่ยงคำบรรยายที่เวิ่นเว้อ
* ทุกคำตอบต้องสะท้อนโค้ดจริงในระบบเสมอ

### 1.3 กฎการส่งมอบโค้ด (Delivery Protocol)
* ตรวจสอบความถูกต้องเสมอ:
  1. Backend: รัน `python -m py_compile` ตรวจสอบ Syntax ให้ผ่าน 100%
  2. Frontend: รัน `npm run build` ตรวจสอบ Next.js Type Check & Build ให้ผ่าน (18/18 static pages)
  3. Git: ทำการ `git add`, `git commit`, และ `git push origin main` ให้เรียบร้อยก่อนตอบสรุปงาน

### 1.4 กฎ Route Precedence ของ FastAPI
* ใน FastAPI ต้องประกาศ Route ที่เป็น **Literal Path** (เช่น `/bulk-update`, `/send-all-portal-emails`, `/sync-sap`, `/inbound-deliveries`) **ก่อน (Before)** Route ที่มี **Path Parameter** (เช่น `/{supplier_id}`, `/{item_id}`, `/{user_id}`) เสมอ เพื่อป้องกัน Error 422

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
* ซิงค์ข้อมูล PO สถานะ Open (O) จาก SAP MS SQL Server (`Report 8`) ทุกวันเวลา 04:00 น.
* **ไม่มีการเขียนข้อมูลกลับไปแก้ไขที่ SAP เด็ดขาด (Zero Write-Back)**
* รายการที่รับครบใน SAP (`LineStatus = 'C'`) จะถูกย้ายเข้าหน้า History อัตโนมัติ

### 3.2 กฎความปลอดภัยและการสะสม Master (Append-Only Masters)
* **Item Master และ Supplier Master:** ข้อมูลมีแต่เพิ่มขึ้นเรื่อยๆ **ไม่มีการลบออกหรือลดลงเด็ดขาด**
* **เมื่อข้อมูลจาก SAP ตรงกับรายการเดิมใน Item Master:**
  * **ห้ามแตะต้องและห้ามแก้ไขทับ** ทั้ง `lead_time_days` และ `notify_alert_days` (คงค่าเดิมที่จัดซื้อตั้งไว้ 100%)
  * กำหนด `is_new = False` ถือว่าข้อมูลนั้นไม่ใหม่ ไม่ต้องแสดงป้ายเตือนสินค้าใหม่
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
* ควบคุมความปลอดภัยด้วย `X-Management-API-Key` และ IP Whitelisting
* เอกสารข้อกำหนดสำหรับแอปพลิเคชันส่วนกลาง: `D:\Python\Central-IAM\PRD.md`

### 3.8 การเชื่อมต่อ Active Directory (AD Authentication)
* เชื่อมต่อตรวจสอบรหัสผ่านพนักงานกับ Active Directory Server (`192.168.12.11`) ผ่าน AD Sync Agent Gateway พอร์ต `3100`

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
docker compose up -d --build
```
