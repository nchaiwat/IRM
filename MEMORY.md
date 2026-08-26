# 🧠 IRM Project — MEMORY & WORKFLOW RULES

> **บันทึกข้อตกลงและกฎเหล็กในการทำงานของ AI Assistant กับ User**  
> **อัปเดตล่าสุด:** 26 สิงหาคม 2026  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **Production URL:** `https://irm.windowasia.com`  
> **VPS Hostinger Path:** `/var/www/Irm`

---

## 🚨 กฎเหล็กในการทำงาน (Strict Development Rules)

### 1. กฎการ Deploy และส่งมอบงาน (Deployment Protocol)
* **ต้องทำครบทุกขั้นตอนเสมอ ห้ามข้ามเด็ดขาด:**
  1. ทำการแก้ไขโค้ดและทดสอบความถูกต้อง
  2. สั่ง **Build Docker บนเครื่อง Local** ให้ผ่าน (`docker-compose build`)
  3. สั่ง **Git Commit & Push** ขึ้น GitHub Repository `origin main` เสมอ
  4. แสดงคำสั่งสำหรับรันบน **VPS Hostinger** ให้ User อย่างชัดเจน:
     ```bash
     cd /var/www/Irm
     git pull origin main
     docker compose build --no-cache irm-backend irm-frontend
     docker compose up -d
     ```

### 2. กฎ Routing ของ FastAPI (Route Precedence Rule)
* ใน FastAPI ต้องประกาศ Route ที่เป็น **Literal Path** (เช่น `/bulk-update`, `/send-all-portal-emails`, `/sync-sap`) **ก่อน (Before)** Route ที่มี **Path Parameter** (เช่น `/{supplier_id}`, `/{item_id}`, `/{user_id}`) เสมอ เพื่อป้องกันไม่ให้ FastAPI ตีความคำว่า `bulk-update` เป็น ID ที่ไม่ใช่ Integer จนเกิด Error 422

---

## 🔑 สรุปข้อตกลง Business Logic & System Standards

### 1. การนำเข้า/ส่งออก Master (Supplier Master & Item Master)
* ใช้ไฟล์ **`.xlsx` (Excel Native)** แทน CSV เพื่อรองรับภาษาไทย 100%
* **Supplier Master XLSX:** สามารถแก้ไข `Email`, `Allow Over Delivery (ใช่/ไม่ใช่)`, `Accept (Accept/รอ Accept)` แล้ว Import กลับเข้ามาเพื่ออัปเดตและปลดสถานะ NEW ได้ทันที
* **Item Master XLSX:** สามารถแก้ไข `Lead Time`, `Notify Alert`, `Description`, `Group`, `Accept (Accept/รอ Accept)` แล้ว Import กลับเข้ามาเพื่ออัปเดตและปลดสถานะ NEW ได้ทันที

### 2. กลไก Supplier Portal Token & Auto-Revocation
* **One-Time Token:** ลิงก์ Portal มีการเข้ารหัสเฉพาะตัว
* **Auto-Revocation:** เมื่อจัดซื้อกดส่งอีเมลรอบใหม่ หรือกด Copy Link ใหม่ ระบบจะ **สั่งยกเลิก (Revoke & Expire) Token เก่าทั้งหมดของ Supplier รายนั้นทันที** เพื่อป้องกันไม่ให้เปิดลิงก์เก่าจากอีเมลฉบับก่อนหน้า
* **One-Time Submit Lock:** เมื่อกดยืนยันแล้ว ลิงก์จะถูกล็อคเป็น Read-Only ทันที

### 3. การจัดเรียงลำดับรายการ (Sequence Synchronization)
* ลำดับรายการสินค้าในแต่ละ PO บนหน้า **Supplier Portal** จะต้องตรงกันกับหน้า **Operation** แบบ 100% บรรทัดต่อบรรทัด โดยเรียงลำดับด้วย:
  ```python
  .order_by(POHeader.po_number.desc(), POItem.id.asc())
  ```

### 4. ปฏิทินรอบส่งมอบ (Calendar Visual Standards)
* แสดงทั้งรายการที่ **🟢 ยืนยันแล้ว (`Confirmed`)** และ **🟠 ประมาณการ (`Estimate`)**
* แสดง **Delivery Date** และ **Qty** ชัดเจนบนการ์ด
* แสดง **ชื่อผู้รับผิดชอบ (Buyer Name)** เช่น `ภิญญาดา`, `พัชชา` บนการ์ดและ Modal โดย **ไม่ต้องมีคำว่า Buyer นำหน้า**

### 5. QMS Integration API Channel
* **Endpoint:** `GET /api/external/qms/inbound-deliveries`
* **Authentication:** ส่งผ่าน Header `X-API-Key: irm_qms_secure_key_2026`
* **Data Scope:** คืนเฉพาะข้อมูลที่ **Confirmed** แล้วเท่านั้น
* **Audit Trail:** ทุกครั้งที่มีการยิงเข้ามา ระบบจะบันทึก IP, เวลา, และจำนวน Record ลงใน `transaction_logs` หมวด `qms_integration` เสมอ
* **Documentation:** จัดทำคู่มือไว้ที่ [QMS_API_INTEGRATION_GUIDE.md](file:///d:/Python/IRM/QMS_API_INTEGRATION_GUIDE.md)

---

## 🛠️ รายการคำสั่งสำคัญ (Essential Commands)

### บนเครื่อง Local (Windows PowerShell):
```powershell
# รันระบบ Local ทั้งหมด
docker-compose up -d --build

# ดูสถานะ Containers
docker-compose ps

# ดูกล่องข้อความ Log
docker-compose logs -f irm-backend
```

### บนเซิร์ฟเวอร์ VPS Hostinger (`/var/www/Irm`):
```bash
# อัปเดตและ Rebuild ทันที
cd /var/www/Irm
git pull origin main
docker compose build --no-cache irm-backend irm-frontend
docker compose up -d

# ล้างข้อมูล Transaction & Masters เพื่อทดสอบจากศูนย์:
docker compose exec irm-db psql -U irm -d irm -c "TRUNCATE TABLE item_masters, supplier_masters, sub_items, po_item_audit_logs, po_items, po_headers, supplier_portal_tokens, transaction_logs RESTART IDENTITY CASCADE;"
docker compose exec irm-redis redis-cli flushall
```
