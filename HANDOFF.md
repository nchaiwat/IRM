# 📌 IRM System — HANDOFF & MEMORY LOG
> **วันที่บันทึก:** 21 สิงหาคม 2026  
> **สถานะโครงการ:** Production-Ready & Deployed on VPS (`https://irm.windowasia.com`)  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)

---

## 🎯 1. ภาพรวมระบบ (System Overview)
ระบบ **IRM (Inbound Raw Material Delivery Tracking & Calendar Planning)** ของบริษัท Window Asia PCL. พัฒนาขึ้นเพื่อติดตามการส่งมอบวัตถุดิบ 7 กลุ่ม (กระจก, อลูมิเนียม, UPVC, ฮาร์ดแวร์ ฯลฯ) จาก SAP Business One เชื่อมโยงกับ Supplier ผ่าน Cryptographic Portal และแสดงผลปฏิทินส่งของ (Calendar) สำหรับฝ่ายจัดซื้อ (PU), ฝ่ายวางแผนการผลิต (PC), และคลังสินค้า (WH)

---

## 🏗️ 2. สรุปฟังก์ชันและ Business Logic สำคัญที่ปรับปรุงล่าสุด

### 1) 🔑 Supplier Portal & One-Time Cryptographic Token
- **Token Security:** ลิงก์ถูกสร้างแบบ Cryptographic Token 16-20 bytes ไม่ซ้ำกัน
- **Automatic Token Revocation (ป้องกันเปิดลิงก์เก่า):** เมื่อมีการส่งอีเมลรอบใหม่หา Supplier รายเดิม ระบบจะ **สั่งยกเลิก (Revoke & Expire) Token เก่าทั้งหมดทันที** หากผู้ขายเปิดลิงก์จากอีเมลของเมื่อวานจะถูกปฏิเสธทันที
- **Permanent One-Time Submit Lock:** เมื่อผู้ขายกดยืนยันส่งข้อมูล (`is_submitted = True`):
  - ลิงก์จะถูกล็อคเป็นโหมดอ่านอย่างเดียว (Read-only) ทันที
  - ซ่อนปุ่มแก้ไข/ส่งข้อมูล และแสดงแบนเนอร์แจ้งเตือนสีเขียว
  - **Read-Only Evidence Viewer:** กรณีมีการแตกส่งหลายรอบ (`แตกส่ง X รอบ`) ผู้ขายสามารถคลิกเพื่อกางการ์ดดูรายละเอียดรอบที่ 1 และรอบที่ 2 ที่ตัวเองเคยระบุไว้เพื่อใช้เป็นหลักฐานยืนยันได้

### 2) 📦 Split Rounds (แตกส่งย่อย / Sub-Items)
- **ไม่หารตัวเลข:** รอบที่ 1 คงยอดค้างรับเต็มจำนวน (`remQty`) และวันที่เดิม ส่วนรอบที่ 2 เริ่มต้นด้วยวันที่ว่างเปล่า (`''`) และจำนวน `0` ให้ผู้ขายกรอกเอง
- **Sequential Date Validation:** วันที่ในรอบถัดไป (รอบ 2, 3...) ต้องเป็นวันหลังจากรอบก่อนหน้าเสมอ
- **Save Draft in Card:** มีปุ่ม `[บันทึก]` และ `[ยกเลิก]` ภายในการ์ด เพื่อพับเก็บสรุปยอดลงตารางก่อนกดส่งจริง

### 3) 📅 Calendar Dual-Status Flow (Exact Date vs Estimate)
- 🟢 **สีเขียว (`Confirmed - Exact Date`):** เกิดขึ้นเมื่อ **ฝ่ายจัดซื้อ (PU) เป็นผู้กดปุ่ม `✔ Accept / Confirm` เท่านั้น** เป็นวันที่แน่นอน 100% สำหรับฝ่ายคลังสินค้าและฝ่ายผลิต
- 🟠 **สีส้ม (`Estimate - รอ PU ยืนยัน`):** วันที่ที่ Supplier เสนอมาผ่าน Portal หรือวันที่ประเมินไว้เบื้องต้น ซึ่งยังไม่ผ่านการอนุมัติจากจัดซื้อ
- **Interactive Filter Tabs:** หัวปฏิทินมีปุ่มสลับดู:
  - `[ ทั้งหมด ]`
  - `[ 🟢 ยืนยันแล้ว (Confirmed - Exact Date) ]`
  - `[ 🟠 รอ PU ยืนยัน (Estimate) ]`

### 4) 🧹 Database Clean State (No Mock Seeds)
- ตัดชุดคำสั่ง Auto-Seed ข้อมูลจำลอง (Mock Item 34 รายการ, Mock Supplier 8 รายชื่อ, Mock PO) ออกจาก:
  - `backend/app/init_db.py`
  - `backend/app/routers/suppliers.py`
  - `backend/app/routers/items.py`
- เพิ่มสคริปต์ `backend/clear_transactions.py` และคำสั่ง TRUNCATE ที่ปลอดภัย (คง Users, Roles, Settings ไว้ 100%)

---

## 📂 3. โครงสร้างไฟล์และจุดแก้ไขสำคัญ (Key Files)

| ไฟล์ | หน้าที่ / การทำงาน |
| :--- | :--- |
| [`frontend/src/app/supplier/portal/[token]/page.tsx`](file:///d:/Python/IRM/frontend/src/app/supplier/portal/%5Btoken%5D/page.tsx) | หน้าจอ Portal สำหรับ Supplier (ล็อค Read-only, ดูรอบส่งย่อย, Dual Scrollbar) |
| [`frontend/src/app/(dashboard)/calendar/page.tsx`](file:///d:/Python/IRM/frontend/src/app/%28dashboard%29/calendar/page.tsx) | หน้าปฏิทิน (แยกสีเขียว Confirmed vs ส้ม Estimate + Filter Tabs) |
| [`frontend/src/app/(dashboard)/operation/page.tsx`](file:///d:/Python/IRM/frontend/src/app/%28dashboard%29/operation/page.tsx) | หน้า Operation จัดการ PO, Sub-items, Accept รอบส่งจาก Supplier |
| [`backend/app/routers/supplier_portal.py`](file:///d:/Python/IRM/backend/app/routers/supplier_portal.py) | API รับส่งข้อมูล Portal และบันทึก `is_submitted = True` |
| [`backend/app/services/email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py) | สร้าง Token และฟังก์ชัน Revoke Token เก่าเมื่อส่งอีเมลใหม่ |
| [`backend/app/routers/suppliers.py`](file:///d:/Python/IRM/backend/app/routers/suppliers.py) | API จัดการ Supplier Master (ตัด Fallback Auto-Seed ออกแล้ว) |
| [`backend/app/routers/items.py`](file:///d:/Python/IRM/backend/app/routers/items.py) | API จัดการ Item Master (ตัด Fallback Auto-Seed ออกแล้ว) |
| [`backend/app/init_db.py`](file:///d:/Python/IRM/backend/app/init_db.py) | Database Initializer (คงเฉพาะ Admin User & System Settings) |
| [`backend/clear_transactions.py`](file:///d:/Python/IRM/backend/clear_transactions.py) | สคริปต์ล้างข้อมูล Transaction โดยไม่กระทบ Users/Settings |

---

## 🚀 4. คำสั่งจัดการระบบบน VPS Hostinger (`/var/www/Irm`)

### 🔄 ดึงโค้ดล่าสุด & Rebuild:
```bash
cd /var/www/Irm
git pull origin main
docker compose build --no-cache irm-backend irm-frontend
docker compose up -d
```

### 🧹 ล้างข้อมูล Transaction & Masters (เริ่มใหม่จากศูนย์):
```bash
docker compose exec irm-db psql -U irm -d irm -c "TRUNCATE TABLE item_masters, supplier_masters, sub_items, po_item_audit_logs, po_items, po_headers, supplier_portal_tokens, transaction_logs RESTART IDENTITY CASCADE;"
docker compose exec irm-redis redis-cli flushall
```

---

## 📌 5. สิ่งที่จะทำต่อในรอบหน้า (Next Steps)
1. **SAP Data Ingestion Test:** ทดสอบรัน Agent ซิงก์ข้อมูล PO จริงจาก SAP On-Premise เข้าสู่ระบบ IRM
2. **Review Operation Workflow:** ปรับแต่งการคลิกดู Sub-Item ในหน้า Operation ให้เปิดแบบ Review Mode ก่อนกดยืนยัน Accept
3. **End-to-End Test:** ทดสอบวงจรเต็ม: SAP Ingest ➔ ส่ง Email Supplier ➔ Supplier ตอบกลับ ➔ PU Accept ➔ แสดงผลบน Calendar แบบ Exact Date 🟢
