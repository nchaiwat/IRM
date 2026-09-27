# Product Requirements Document (PRD)
# IRM — Incoming Raw Material Management System

> **Document Version:** 1.2.0  
> **Target Project:** IRM (Incoming Raw Material Management System)  
> **Organization:** Window Asia Public Company Limited (Window Asia PCL.)  
> **Status:** Production-Ready & Active Maintenance  
> **Production URL:** `https://irm.windowasia.com`  
> **VPS Hostinger Path:** `/var/www/Irm`  
> **Last Updated:** 2026-09-27  
> **Related Documents:** [`MEMORY.md`](file:///d:/Python/IRM/MEMORY.md), [`HANDOFF.md`](file:///d:/Python/IRM/HANDOFF.md), [`README.md`](file:///d:/Python/IRM/README.md), [`docs/DOCS_SOLUTIONS.md`](file:///d:/Python/IRM/docs/DOCS_SOLUTIONS.md)

---

## 1. บทนำและวิสัยทัศน์โครงการ (Project Overview & Vision)

### 1.1 ที่มาและความสำคัญ (Problem Statement)
เดิมการติดตามการส่งมอบวัตถุดิบ 7 กลุ่มหลักของ บริษัท วินโดว์ เอเชีย จำกัด (มหาชน) (กระจก, อลูมิเนียม, UPVC, ฮาร์ดแวร์, Sparepart, เหล็กดัด, Partner) ระหว่างฝ่ายจัดซื้อ (Purchasing), ฝ่ายวางแผนการผลิต (Production Planning), คลังสินค้า (Warehouse), และฝ่ายตรวจสอบคุณภาพ (QC) ดำเนินการผ่านการโทรศัพท์, ส่งอีเมล, และการสอบถามรายวัน ซึ่งก่อให้เกิดความล่าช้า, ข้อมูลคลาดเคลื่อน, และไม่มีศูนย์กลางในการตรวจสอบสถานะสินค้าค้างรับในระบบ SAP Business One

### 1.2 วัตถุประสงค์ (Key Objectives)
1. **เชื่อมโยงข้อมูลกับ SAP Business One:** ดึงข้อมูล PO ที่ยังเปิดอยู่ (LineStatus = 'O') ผ่าน Query Report 8 อัตโนมัติทุกวันเวลา 06:45 น. (Inbound One-Way Sync, ไม่เขียนทับ SAP)
2. **ระบบนัดหมายและวางแผนส่งมอบ (Operation & Calendar):** จัดการวันนัดหมายส่งมอบ (Estimate Date), จำนวนส่ง, และรองรับการแตกงวดส่งย่อย (Sub-items)
3. **Supplier Portal แบบความปลอดภัยสูง:** ให้คู่ค้าระบุวันส่งมอบด้วยตนเองผ่าน One-Time Cryptographic Token URLs โดยไม่ต้องมี Username/Password
4. **ใบตรวจรับสินค้าจริง (Receiving Checklist):** สรุปรายการสินค้าที่มีนัดส่งมอบประจำวัน พิมพ์เป็นกระดาษ A4 แนวนอน สำหรับ รปภ., คลังสินค้า และ QC
5. **การบูรณาการระบบระดับองค์กร (Enterprise Integration):**
   - ส่งต่อข้อมูลวัตถุดิบขาเข้าให้ระบบ **QMS** ผ่าน Pull REST API
   - รองรับการบริหารจัดการตัวตนจากศูนย์กลางผ่าน **Central IAM** (Directory API / Instant Offboarding)
   - แจ้งเตือนยอดวัตถุดิบขาเข้าประจำวันรายบุคคลผ่าน **Telegram DM** ตามกลุ่มสินค้าที่รับผิดชอบ
   - ส่งอีเมลสรุปงานและไฟล์แนบ Excel 2 Sheet ให้ทีมจัดซื้อทุกเช้า (**PU Reminder Email**)

---

## 2. โครงสร้างสถาปัตยกรรมระบบ (System Architecture)

### 2.1 Container Topology (Docker Compose on Port 80)
- **`irm-nginx`**: Reverse Proxy ให้บริการพอร์ต 80 รวม Frontend (`/`) และ Backend API (`/api`)
- **`irm-frontend`**: Next.js 15 (App Router, TailwindCSS, Lucide Icons)
- **`irm-backend`**: FastAPI (Python 3.11, SQLAlchemy Async, APScheduler)
- **`irm-db`**: PostgreSQL 16
- **`irm-redis`**: Redis 7 In-memory Cache & Task Queue

---

## 3. ลำดับเมนูที่เป็นทางการของระบบ (Official Menu Architecture)

1. **Dashboard (`/dashboard`):** สรุปภาพรวม PO ค้างส่ง, ยอดแยกตาม 7 กลุ่มสินค้า, และสถิติภาพรวม
2. **Operation (`/operation`):** จัดการวันนัดหมายส่งมอบ, แตกงวดส่ง (Sub-items), ฟิลเตอร์ 10 แท็บ, ล็อคการแก้ไข (Ownership Lock)
3. **Calendar (`/calendar`):** ปฏิทินส่งของ โหมดรายเดือน และรายปี (12 เดือน) พร้อม Universal Search ค้นหาได้ทุกคำข้ามปี
4. **Receiving Checklist (`/receiving-checklist`):** ใบตรวจรับสินค้าประจำวันสำหรับคลัง, รปภ., QC พร้อมพิมพ์ A4 แนวนอน
5. **Item Master (`/items`):** ฐานข้อมูลรหัสสินค้า, Lead Time Days, Notify Alert Days (ระบบ Append-Only)
6. **Supplier Master (`/suppliers`):** ฐานข้อมูลคู่ค้า, จัดการอีเมล, สิทธิ์ส่งเกิน (Allow Over-Delivery), ปุ่มส่งเชิญเข้า Portal
7. **History (`/history`):** ประวัติ PO ที่ปิดยอดรับครบใน SAP แล้ว (`LineStatus = 'C'`)
8. **System Blueprint (`/system-blueprint`):** ผังพิมพ์เขียวระบบ, ตารางสิทธิ์, กฎเกณฑ์, และ AI Prompts ภาษาไทย
9. **Admin:**
   - System Setting (`/admin/settings`)
   - User Management (`/admin/users`)
   - Group Management (`/admin/groups`)
   - Auth Matrix (`/admin/auth-matrix`)
   - Transaction Logs (`/admin/logs`)

---

## 4. กฎทางธุรกิจและมาตรฐานเชิงเทคนิค (Business Logic & Core Constraints)

### 4.1 กฎมาตรฐานวันที่บริสุทธิ์ (Pure Date Standard)
- ข้อมูลวันที่ส่งมอบและกำหนดส่งใน DB และ Python ต้องเป็น `DATE` / `datetime.date` เท่านั้น (ห้ามใช้ `TIMESTAMPTZ` หรือบวกเวลา UTC)
- การแสดงผลบน UI ทุกจุดต้องเป็น **`dd/mm/yyyy`** (ค.ศ.)

### 4.2 ระบบ Master สะสมข้อมูล (Append-Only Masters)
- Item Master และ Supplier Master มีแต่เพิ่มขึ้นเรื่อยๆ **ไม่มีการลบออก**
- สินค้าที่เพิ่งปรากฏใหม่จาก SAP ในรอบวันจะถูกระบุเป็น `is_new = True` เมื่อข้ามวันจะกลายเป็น `False`
- การซิงค์จาก SAP จะไม่แตะต้อง `lead_time_days` และ `notify_alert_days` เดิมที่จัดซื้อตั้งไว้

### 4.3 กลไก Supplier Portal Token & Reuse
- รอบวันจันทร์ 08:00 น. หมดอายุ **คืนวันพุธ 23:59:59 น.**
- รอบวันพฤหัสบดี 08:00 น. หมดอายุ **คืนวันอาทิตย์ 23:59:59 น.**
- การส่งอีเมลซ้ำหรือ Copy URL ในรอบเดียวกันจะ Reuse Active Token เดิม
- เมื่อ Supplier กด Submit สำเร็จ ลิงก์จะถูกล็อค (Expired) ทันที

### 4.4 การจัดการ Sub-items (Partial Deliveries)
- การแตกงวดส่งย่อยจะคำนวณตัดยอดรับจาก SAP แบบ FIFO ตามลำดับงวดส่ง

### 4.5 Central IAM & QMS Integration
- Central IAM: รองรับ `GET /api/v1/directory/accounts`, `PATCH /api/v1/directory/accounts/{username}/status`, และ `POST /api/v1/directory/accounts`
- QMS: ให้บริการ Pull Model ผ่าน `GET /api/external/qms/inbound-deliveries` พร้อมบันทึก Transaction Log ทุกครั้ง

### 4.6 PU Reminder Email
- ดึงอีเมลผู้รับจากสมาชิกกลุ่ม `PU User` ใน User Management โดยตรง (Zero Redundant Settings)
- สร้างไฟล์แนบ Excel 2 Sheet (Sheet 1: รอ Confirm, Sheet 2: ส่งมอบวันนี้)
- ใช้ Isolated Session Commit ในการบันทึก Transaction Log ทุกสถานะ
