# IRM (Incoming Raw Material) — Complete Technical Solutions & Architectural Q&A

เอกสารสรุปคำตอบทางเทคนิคและสถาปัตยกรรมระบบ IRM ทั้ง 13 ข้อ เพื่อความชัดเจนและพร้อมนำไปใช้งานจริง

---

## 1. การจัดการปัญหาในหน้า Operation (Operation Conflicts & Sync Strategy)

### 1.1 การ Sync ข้อมูลใหม่จาก SAP (Report 8) กับข้อมูลเดิมที่มีการแก้ไขแล้ว
- **หลักการทำงาน:**
  - ใช้ `DocNum` + `LineNum` (หรือ `ItemCode`) จาก SAP เป็น **Primary Match Key**
  - **รายการใหม่ (New Item):** เพิ่มเข้าฐานข้อมูล IRM (สถานะ `pending`) และแสดงป้าย **NEW** พร้อมคำนวณวันกำหนดส่งเบื้องต้นจาก Lead Time ใน Item Master
  - **รายการเดิมที่มีอยู่แล้ว:** ระบบจะอัปเดตเฉพาะจำนวนสั่งซื้อรวม (`quantity`), จำนวนที่รับแล้ว (`received_qty`), และจำนวนคงเหลือ (`remaining_qty`) จาก SAP **โดยจะไม่ทับ `estimate_date` และ `estimate_qty`** ที่จัดซื้อ (พัชชา / ภิญญดา) หรือ Supplier ได้ตกลงและระบุไว้เดิม
  - **กรณี PO ถูกปิดใน SAP (LineStatus = 'C'):** รายการใน IRM จะถูกย้ายไปที่หน้า **History** อัตโนมัติ

### 1.2 & 1.3 การ Merge ข้อมูลของ Supplier และการส่งข้อมูลไป QMS
- **กลไกการ Merge ข้อมูล Supplier:**
  - เมื่อ Supplier กรอกข้อมูลผ่านลิงก์ Token ➔ สถานะรายการเปลี่ยนเป็น `supplier_responded` (แสดงแถบสีส้มและไอคอน 🟡)
  - บันทึก `updated_by_name = "Supplier Name"`, `updated_by_type = "supplier"` และสร้าง Audit Log บันทึกวันเวลาประวัติย้อนหลัง
  - ในหน้า Operation จัดซื้อจะเห็นเตือน **"Supplier ตอบกลับแล้ว"** และสามารถกดปุ่ม **Accept** เพื่อรวมเข้าเป็นค่าหลักของระบบ หรือกด **Edit** เพื่อปรับแก้เพิ่มเติม
- **Trigger การส่งข้อมูลไป QMS (VPS Hostinger):**
  - **Trigger 1 (Auto-Push):** เมื่อจัดซื้อกด **Accept** หรือกด **Confirm** วันส่งสินค้า ระบบจะ Push JSON Payload ไปยัง QMS API ทันที
  - **Trigger 2 (Batch Daily Push):** ทุกวันเวลา 08:30 น. ระบบ Scheduler จะรวบรวมรายการที่มีการเปลี่ยนแปลงวันส่งล่าสุดทั้งหมด Push ไปยัง QMS ในครั้งเดียว เพื่อป้องกันการตกหล่นและไม่ต้องกดทีละรายการ

---

## 2. ความปลอดภัยของ URL สำหรับ Supplier (Secure Token URL)

- **วิธีการ:**
  - สร้าง URL แบบ **Cryptographic One-Time Token** เช่น `http://your-domain/supplier/portal/VD-0004-9a8f7e6d`
  - ลิงก์ Token ถูกผูกเฉพาะกับ `CardCode` ของ Supplier รายนั้นๆ เท่านั้น ไม่สามารถเดา URL หรือข้ามไปดู PO ของ Supplier รายอื่นได้
  - ลิงก์มีอายุขัย (Expiration Window เช่น 7 วันนับจากวันส่ง Email) หรือปิดการกรอกอัตโนมัติเมื่อกด Submit ยืนยันข้อมูลแล้ว

---

## 3. การเพิ่ม Sub Item (Partial Delivery - การส่งสินค้าเป็นงวด)

- **กลไกการทำงาน:**
  - เมื่อรายการสั่งซื้อ Qty 10,000 ชิ้น ถูกแบ่งส่ง 2 รอบ (เช่น 6,000 ชิ้น วันที่ 15/08 และ 4,000 ชิ้น วันที่ 25/08) จัดซื้อกดแตก **Sub Items** ในหน้า Operation
  - ระบบบันทึกรายการย่อยลงตาราง `sub_items` ผูกกับ `po_item_id`
  - **เมื่อ SAP Sync ข้อมูลใหม่:** SAP จะส่ง `received_qty` รวมกลับมา ระบบ IRM จะนำจำนวนรับแล้วไปหักลบกับ Sub Item งวดแรกตามลำดับ (FIFO) หากรับครบงวดแรก จะไปตัดงวดถัดไป จึงไม่เกิด Conflict กับการดึงข้อมูลจาก SAP

---

## 4. Trigger การส่ง JSON ไปแจ้ง QMS

- **กลไก:**
  - รองรับทั้ง **Event-Driven (กด Confirm/Accept)** และ **Scheduled Batch Push (08:30 น. ทุกวัน)**
  - ผู้ใช้งานไม่ต้องมานั่งกดทีละรายการ ระบบจะรวบรวมรายการที่ยืนยันแล้วส่งไป QMS โดยอัตโนมัติ

---

## 5. รูปแบบวันที่และการแสดงผลบนหน้า Calendar

- **Format วันที่:** กำหนดให้ทุกส่วนในระบบแสดงผลในรูปแบบ `dd/MM/yyyy` (เช่น `13/08/2026`)
- **Calendar View:** ปฏิทินแสดงตารางรายเดือน 7 วัน (อาทิตย์ - เสาร์) แยกสีสัญลักษณ์ชัดเจน:
  - 🟡 **Estimate / Responded (สีส้ม/เหลือง):** รอยืนยัน
  - 🟢 **Confirmed (สีเขียว):** ยืนยันแล้ว
  - 🔴 **Delay (สีแดง):** ส่งล่าช้า
  - คลิกช่องวันที่เพื่อดู Popup รายละเอียดสินค้าทั้งหมดในวันนั้น

---

## 6. ระบบ Authentication และการยกเลิกสิทธิ์ (User Session Management)

- **การ Authen:** ใช้ **JWT (JSON Web Token)**
  - **Access Token:** อายุกิจกรรม 1 ชั่วโมง
  - **Refresh Token:** อายุ 7 วัน (รองรับ Remember Me)
- **การยกเลิกสิทธิ์ผู้ใช้ทันที (Revoke User):**
  - Admin สามารถกดปุ่ม **"ปิดใช้งาน (Disable User)"** ในหน้า User Management
  - ระบบจะยกเลิกสิทธิ์ทันที โทเค็นเดิมของผู้ใช้คนนั้นจะไม่สามารถเรียก API ใดๆ ได้อีก

---

## 7. วิธีการ Query ข้อมูลจาก SAP B1 (`wa-dbs2.wa.net`)

- **คำแนะนำ:** ใช้ **Direct SQL Read-Only Query (หรือ SQL View บน SQL Server)**
  - สร้าง SQL Read-Only User บน MS SQL Server (`wa-dbs2.wa.net:1433`)
  - IRM ทำหน้าที่อ่านข้อมูลด้วยคำสั่ง `SELECT` เท่านั้น (ไม่มีการเขียนทับลง SAP) ปลอดภัย 100%

---

## 8. ภาษาและเทคโนโลยีที่ใช้พัฒนา (Infrastructure บน Windows Server 2016)

กรณีไม่มี Docker บน Windows Server 2016 สามารถติดตั้งและรันระบบได้ง่ายดาย:
- **Backend:** Python 3.11 (FastAPI) รันเป็น Windows Service ผ่าน `NSSM` (Non-Sucking Service Manager)
- **Frontend:** Next.js Server / Static Export บน Node.js LTS for Windows
- **Web Server Proxy:** Nginx for Windows (พอร์ต 80 / 443)

---

## 9. การติดตั้ง PostgreSQL บน Windows Server 2016

- **การติดตั้ง:** ดาวน์โหลด **PostgreSQL for Windows Installer** (เวอร์ชัน 15 หรือ 16) ติดตั้งลงบน Windows Server 2016 โดยตรง ได้ทั้งตัวเอนจินฐานข้อมูลและเครื่องมือบริหารจัดการ **pgAdmin 4**

---

## 10. การนำ SQL Query Report 8 ไปใช้งาน

- **การทำงาน:**
  - นำคำสั่ง SQL Query Report 8 ที่เชื่อมระหว่าง `POR1`, `OPOR`, `OITM`, `PDN1`, `PCH1`, `OCRD`, `OSLP`, `OITB` กรองเฉพาะ `LineStatus = 'O'` และ `ItmsGrpCod IN (113, 115)`
  - ตั้งเป็น **Background Worker Sync** ดึงข้อมูลจาก SAP มาลงฐานข้อมูล IRM ทุกวันเวลา 04:00 น. หรือกดปุ่ม **"Sync Now"** ในหน้าตั้งค่าระบบ

---

## 11. รูปแบบ JSON Payload ที่ส่งไปหา QMS (Hostinger VPS)

```json
{
  "event": "po_delivery_confirmed",
  "timestamp": "2026-08-13T09:50:00Z",
  "po_number": "260210001",
  "po_date": "08/08/2026",
  "supplier_code": "VD-0004",
  "supplier_name": "บริษัท กรีนเทคพลัส อินเตอร์กรุ๊ป จำกัด",
  "item_code": "HW-0101-00000",
  "item_name": "กรรไกรตัดสีกษณหนาด 60 (180x110)",
  "estimate_date": "22/08/2026",
  "estimate_qty": 5000.0,
  "unit": "แผ่น",
  "buyer_name": "พัชชา สุขสวัสดิ์",
  "updated_by": "พัชชา สุขสวัสดิ์"
}
```

---

## 12. โครงสร้างไฟล์คลังเอกสารในโปรเจกต์

- **`README.md`**: คู่มือการติดตั้ง คำสั่งรันระบบ และวิธี Deploy บน Windows Server
- **`PRD.md`**: เอกสารข้อกำหนดความต้องการระบบและ Data Flow Diagram
- **`SAP_INTEGRATION.md`**: คำสั่ง SQL Report 8 และโครงสร้างการเชื่อมต่อ MS SQL Server
- **`QMS_INTEGRATION.md`**: ข้อกำหนด API Endpoint และรูปแบบ JSON Payload สำหรับ QMS

---

## 13. ธีมการออกแบบและ Skill ที่จำเป็น

- **Design Theme:** **Premium Industrial Slate / Corporate Blue** ธีมทางการ เรียบหรู สะอาดตา แยกสีสถานะชัดเจน (🟢 Confirmed, 🟡 Estimate/Responded, 🔴 Delay, 🔵 Open)
- **Skill ที่ใช้พัฒนา:** Python FastAPI, Next.js 15, TailwindCSS, PostgreSQL, PyODBC (MS SQL Server), Nginx for Windows
