# 🧠 IRM Project — MEMORY & WORKFLOW RULES

> **บันทึกข้อตกลงและกฎเหล็กในการทำงานของ AI Assistant กับ User**  
> **อัปเดตล่าสุด:** 30 สิงหาคม 2026  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **Production URL:** `https://irm.windowasia.com`  
> **VPS Hostinger Path:** `/var/www/Irm`

---

## 🚨 กฎเหล็กในการทำงาน (Strict Development Rules)

### 1. กฎการ Deploy และส่งมอบงาน (Deployment Protocol)
* **ต้องทำครบทุกขั้นตอนเสมอ ห้ามข้ามเด็ดขาด:**
  1. ทำการแก้ไขโค้ดและทดสอบความถูกต้อง
  2. สั่ง **Build Next.js Frontend / PyCompile Backend** ให้ผ่าน 100%
  3. สั่ง **Git Commit & Push** ขึ้น GitHub Repository `origin main` เสมอ
  4. แสดงคำสั่งสำหรับรันบน **VPS Hostinger** ให้ User อย่างชัดเจน:
     ```bash
     cd /var/www/Irm
     git pull origin main
     docker compose up -d --build
     ```

### 2. กฎ Routing ของ FastAPI (Route Precedence Rule)
* ใน FastAPI ต้องประกาศ Route ที่เป็น **Literal Path** (เช่น `/bulk-update`, `/send-all-portal-emails`, `/sync-sap`, `/inbound-deliveries`) **ก่อน (Before)** Route ที่มี **Path Parameter** (เช่น `/{supplier_id}`, `/{item_id}`, `/{user_id}`) เสมอ เพื่อป้องกันไม่ให้ FastAPI ตีความคำเฉพาะเป็น ID ที่ไม่ใช่ Integer จนเกิด Error 422

---

## 🔑 สรุปข้อตกลง Business Logic & System Standards

### 1. การซิงค์ SAP (One-Way Sync & No Write-Back)
* IRM อ่านข้อมูลทางเดียวจาก SAP MS SQL Server (Report 8) วันละ 1 ครั้ง (08:00 น. ตาม System Settings)
* **ไม่มีการเขียนข้อมูลกลับไปที่ SAP เด็ดขาด**
* ทุก Item ที่เข้าใหม่จะมีค่า Default เสมอ (`Estimate Date = PO Date + Lead Time`, `Estimate Qty = Remaining Qty`) จึงไม่มีสถานะ Unscheduled

### 2. หน้า Operation (10 Filter Tabs & Over-Delivery)
* แถบปุ่ม Filter 10 ปุ่ม (Pill Buttons with Badge Counts): `ทั้งหมด`, `✨ มาใหม่วันนี้`, `⏱️ ยังไม่ยืนยัน`, `✔️ ยืนยันแล้ว`, `↳ แบ่งการส่ง`, `⚡ ส่งเกิน PO`, `🔴 เกินกำหนด`, `🟡 ถึงใน 7 วัน`, `🟠 ถึงใน 3 วัน`, `💬 รอ Sup ยืนยัน`
* **Over-Delivery Logic:** รายการจะถูกนับว่าส่งเกิน PO ก็ต่อเมื่อมีการแตกงวดส่ง (`sub_items`) รวมเกิน หรือ ผู้ใช้/Supplier ได้มีการระบุ/ยืนยันแผนส่งมอบจริง (`Confirmed / Modified`) เกินยอดค้างรับหรือยอดสั่งซื้อ

### 3. หน้า History (2 Filter Tabs & Plan vs Actual)
* แถบปุ่ม Filter 2 ปุ่ม: `ทั้งหมด [จำนวน]` และ `✨ ปิดเมื่อวาน [จำนวน]`
* `ปิดเมื่อวาน` กรองจาก `closed_at` ที่ตรวจจับและซิงค์เข้ามาใหม่ในเช้าวันนี้
* มีการวิเคราะห์ผลต่าง Plan vs Actual (`ตรงตามแผน`, `+ เกินแผน`, `- ขาดแผน`) พร้อม Lazy Loading Audit Trail

### 4. การแจ้งเตือน Telegram Notification Suite
* **Morning Summary Report (08:00 น.):** สรุป 4 หมวด: Dashboard, Item Master, Supplier Master, History
* **QMS Inbound Pull:** แจ้งเตือนทันทีเมื่อ QMS ยิงดึงข้อมูล Confirmed Deliveries (พร้อมสรุปรายการ, IP, ช่วงวันที่)
* **Mon/Thu Supplier Email Broadcast:** แจ้งเตือนรอบส่งเมล์อัตโนมัติเช้าวันจันทร์และวันพฤหัสบดี (08:00 น.)
* **SAP Sync:** แจ้งผลสรุปการซิงค์ทุกรอบ

### 5. การนำเข้า/ส่งออก Master (Supplier Master & Item Master)
* ใช้ไฟล์ **`.xlsx` (Excel Native)** แทน CSV เพื่อรองรับภาษาไทย 100%
* **Supplier Master XLSX:** รองรับ 7 คอลัมน์ (Code, Name, Email, Telephone, Contact Person, Over Delivery, Accept)
* **Item Master XLSX:** รองรับ 7 กลุ่มสินค้า, Lead Time, Notify Alert Days, Description, Group, Accept

### 6. กลไก Supplier Portal Token & Auto-Revocation
* **One-Time Token:** ลิงก์ Portal มีการเข้ารหัสเฉพาะตัว
* **Auto-Revocation:** เมื่อจัดซื้อกดส่งอีเมลรอบใหม่ หรือกด Copy Link ใหม่ ระบบจะ **สั่งยกเลิก (Revoke & Expire) Token เก่าทั้งหมดของ Supplier รายนั้นทันที**
* **One-Time Submit Lock:** เมื่อกดยืนยันแล้ว ลิงก์จะถูกล็อคเป็น Read-Only ทันที

### 7. QMS Integration API Channel
* **Endpoint:** `GET /api/external/qms/inbound-deliveries`
* **Authentication:** ส่งผ่าน Header `X-API-Key: irm_qms_secure_key_2026` (หรือ Bearer Token)
* **Data Scope:** คืนเฉพาะข้อมูลที่ **Confirmed** แล้วเท่านั้น
* **Audit Trail & Telegram:** บันทึก Transaction Log และส่ง Telegram Alert ทุกครั้ง

---

## 🛠️ รายการคำสั่งสำคัญ (Essential Commands)

### บนเครื่อง Local (Windows PowerShell):
```powershell
# รันระบบ Local ทั้งหมด
docker-compose up -d --build

# ตรวจสอบ TypeScript & Build Frontend
cd frontend; npm run build

# ตรวจสอบ Python Syntax Backend
python -m py_compile backend/app/services/*.py backend/app/routers/*.py
```

### บนเซิร์ฟเวอร์ VPS Hostinger (`/var/www/Irm`):
```bash
# อัปเดตและ Rebuild ทันที
cd /var/www/Irm
git pull origin main
docker compose up -d --build

# ล้างข้อมูล Transaction & Masters เพื่อทดสอบจากศูนย์:
docker compose exec irm-db psql -U irm -d irm -c "TRUNCATE TABLE item_masters, supplier_masters, sub_items, po_item_audit_logs, po_items, po_headers, supplier_portal_tokens, transaction_logs RESTART IDENTITY CASCADE;"
docker compose exec irm-redis redis-cli flushall
```
