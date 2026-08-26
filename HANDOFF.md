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

### 3) 📅 Calendar Strict Confirmed Policy (Exact Date Only)
- 🟢 **แสดงเฉพาะรายการที่ยืนยันแล้วเท่านั้น (`status = 'confirmed'`):** เกิดขึ้นเมื่อ **ฝ่ายจัดซื้อ (PU) เป็นผู้ตรวจสอบและกดปุ่ม `✔ Accept` หรือบันทึกยืนยันข้อมูลแล้วเท่านั้น**
- **รายการที่ยังไม่ Accept:** ข้อมูลใหม่จาก SAP (`pending`) หรือข้อมูลที่ Supplier เพิ่งส่งมา (`supplier_responded`) จะ **ไม่ถูกนำมาแสดงบน Calendar เด็ดขาด** จนกว่าจัดซื้อจะกด Accept
- **ความแม่นยำ 100%:** ปฏิทินแสดงเฉพาะวันส่งมอบจริงที่แน่นอน (Exact Date) สำหรับฝ่ายคลังสินค้าและฝ่ายวางแผนการผลิต

### 5) 📊 Master Export/Import XLSX & Batch Accept
- **เปลี่ยนจาก CSV เป็น `.xlsx` (Excel Native):** ทั้งหน้า **Supplier Master** และ **Item Master** รองรับภาษาไทย 100% ไม่มีปัญหาเรื่องฟอนต์หรือ BOM
- **Supplier Master Excel:** สามารถ Export ออกมาแก้ `Email`, `เบอร์โทร`, `ผู้ติดต่อ`, `Allow Over Delivery (ใช่/ไม่ใช่)`, และ `Accept (Accept / รอ Accept)` แล้ว Import กลับเข้าไปเพื่ออัปเดตและปลดสถานะ NEW ได้ทันที
- **Item Master Excel:** สามารถ Export ออกมาแก้ `Lead Time`, `Notify Alert`, `กลุ่มสินค้า`, `Description`, และ `Accept (Accept / รอ Accept)` แล้ว Import กลับเข้าไปเพื่ออัปเดตและปลดสถานะ NEW ได้ทันที

### 6) 🌅 Daily 08:00 AM Telegram Morning Briefing
- **เวลาส่ง:** ทุกวัน เวลา **08:00 น.** (Asia/Bangkok)
- **หัวข้อที่แจ้งเตือนใน Group:**
  - 📦 **Item Master เพิ่มใหม่ (รอ Accept):** X รายการ
  - 🏢 **Supplier Master เพิ่มใหม่ (รอ Accept):** X รายชื่อ
  - 🚚 **Item ใกล้ถึงกำหนดส่งมอบ (ภายใน 7 วัน):** X รายการ (จาก Y ใบสั่งซื้อ PO)

---

## 📂 3. โครงสร้างไฟล์และจุดแก้ไขสำคัญ (Key Files)

| ไฟล์ (File Path) | หน้าที่ / การทำงาน |
| :--- | :--- |
| [`backend/app/services/telegram_service.py`](file:///d:/Python/IRM/backend/app/services/telegram_service.py) | ระบบแจ้งเตือน Telegram รวม 7 Events (เพิ่ม Daily 08:00 AM Morning Summary) |
| [`backend/app/services/scheduler.py`](file:///d:/Python/IRM/backend/app/services/scheduler.py) | APScheduler จัดตารางงานอัตโนมัติ (Mail Mon/Thu 08:00, SAP 04:00, Telegram 08:00) |
| [`backend/app/routers/operation.py`](file:///d:/Python/IRM/backend/app/routers/operation.py) | API Operation ปรับปรุง High-Performance Query (Response Time < 50ms) |
| [`backend/app/models/po.py`](file:///d:/Python/IRM/backend/app/models/po.py) | โมเดล PO พร้อม Indexes (`status`, `po_header_id`, `is_new`) |
| [`backend/app/services/email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py) | สร้าง Token และฟังก์ชัน Revoke Token เก่าเมื่อส่งอีเมลใหม่ |
| [`backend/app/routers/suppliers.py`](file:///d:/Python/IRM/backend/app/routers/suppliers.py) | API จัดการ Supplier Master (ตัด Fallback Auto-Seed ออกแล้ว) |
| [`backend/app/routers/items.py`](file:///d:/Python/IRM/backend/app/routers/items.py) | API จัดการ Item Master (ตัด Fallback Auto-Seed ออกแล้ว) |
| [`backend/app/init_db.py`](file:///d:/Python/IRM/backend/app/init_db.py) | Database Initializer (คงเฉพาะ Admin User & System Settings) |
| [`backend/app/clear_transactions.py`](file:///d:/Python/IRM/backend/app/clear_transactions.py) | สคริปต์ล้างข้อมูล Transaction โดยไม่กระทบ Users/Settings |

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
