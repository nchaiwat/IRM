# 📦 IRM — Project Handoff & Technical Documentation
> **Incoming Raw Material Tracking System (ระบบติดตามการรับวัตถุดิบ)**  
> **องค์กร:** Window Asia Public Company Limited (Window Asia PCL.)  
> **เวอร์ชัน:** 1.0 Production-Ready (สิงหาคม 2026)  
> **พอร์ตบริการ:** Port 80 (HTTP Reverse Proxy)

---

## 📑 สารบัญ (Table of Contents)
1. [ภาพรวมระบบและสถาปัตยกรรม (Architecture Overview)](#1-ภาพรวมระบบและสถาปัตยกรรม)
2. [Tech Stack & Container Topology](#2-tech-stack--container-topology)
3. [ข้อมูลการเข้าสู่ระบบเริ่มต้น (Default Credentials)](#3-ข้อมูลการเข้าสู่ระบบเริ่มต้น)
4. [ฟังก์ชันการทำงานหลักและโมดูลทั้งหมด (Core Modules)](#4-ฟังก์ชันการทำงานหลักและโมดูลทั้งหมด)
   - [4.1 หน้า Operation (ตารางติดตามและจัดรอบส่ง)](#41-หน้า-operation-operation)
   - [4.2 หน้า Item Master (กลุ่มสินค้าและ Lead Time)](#42-หน้า-item-master-items)
   - [4.3 หน้า Supplier Master (จัดการผู้จำหน่ายและสิทธิ์ส่งเกิน)](#43-หน้า-supplier-master-suppliers)
   - [4.4 หน้า Supplier Portal (ลิงก์ตอบกลับของคู่ค้า)](#44-หน้า-supplier-portal-supplierportaltoken)
   - [4.5 การแจ้งเตือน Telegram (Standard Header & Rich Emojis)](#45-การแจ้งเตือน-telegram)
   - [4.6 มาตรฐานชื่อไฟล์ Export CSV](#46-มาตรฐานชื่อไฟล์-export-csv)
   - [4.7 ระบบประวัติการแก้ไข (History Audit Trail)](#47-ระบบประวัติการแก้ไข-history-audit-trail)
   - [4.8 แดชบอร์ดวิเคราะห์ผลงาน (Analytics Dashboard & Scorecard)](#48-แดชบอร์ดวิเคราะห์ผลงาน-dashboard)
5. [เมทริกซ์การจัดการ Conflict และการล็อกข้อมูล (Concurrency & Locking Model)](#5-เมทริกซ์การจัดการ-conflict-และการล็อกข้อมูล)
6. [แนวทางการ Deploy บน Cloud / On-Premise (Deployment Strategies)](#6-แนวทางการ-deploy)
7. [คำสั่งที่ใช้ในการดูแลระบบ (Operational & Docker Commands)](#7-คำสั่งที่ใช้ในการดูแลระบบ)

---

## 1. ภาพรวมระบบและสถาปัตยกรรม

ระบบ **IRM (Incoming Raw Material)** พัฒนาขึ้นสำหรับ **ฝ่ายจัดซื้อ (Purchasing Department)** เพื่อใช้ในการวางแผน ติดตาม และยืนยันกำหนดการส่งมอบวัตถุดิบจาก Supplier ตามใบสั่งซื้อ (PO) ที่เปิดค้างอยู่ใน **SAP Business One (SAP B1)** โดยลดภาระงานโทรศัพท์/อีเมลตามงาน และเปลี่ยนเป็นการให้ Supplier ยืนยันกำหนดส่งด้วยตนเองผ่าน Secure Web Portal

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           IRM SYSTEM TOPOLOGY                           │
└─────────────────────────────────────────────────────────────────────────┘
   [ SAP B1 (SQL/API) ] ──(Sync)──► [ IRM Backend (FastAPI) ]
                                            │
                                            ▼
   [ Buyer (Admin) ] ────(Port 80)────► [ Nginx ] ◄────(Port 80)──── [ Supplier ]
   (Dashboard/Operation)                    │                         (Secure Portal)
                                            ▼
                                   [ IRM Frontend (Next.js) ]
                                            │
                                   [ PostgreSQL 16 + Redis 7 ]
                                            │
                                            ▼
   [ Telegram Group & DMs ] ◄──(Notifications)── [ APScheduler ]
```

---

## 2. Tech Stack & Container Topology

ระบบทำงานบน **Docker Compose** แยกอิสระทั้งหมด 5 Containers ในวง Network `irm-network`:

| Container Name | Service | Port Mapping (Host:Container) | หน้าที่หลัก |
| :--- | :--- | :--- | :--- |
| **`irm-nginx`** | Nginx Alpine | `80:80` | Reverse Proxy รวม Route Frontend (`/`) และ API Backend (`/api`) |
| **`irm-frontend`** | Next.js 15 (App Router, TailwindCSS, Lucide) | Internal (3000) | UI สำหรับผู้ใช้งานฝ่ายจัดซื้อ, ผู้ดูแลระบบ และ Supplier Portal |
| **`irm-backend`** | FastAPI (Python 3.11, SQLAlchemy Async, APScheduler) | Internal (8000) | Business Logic, Background Jobs, SAP Sync, Real Email & Telegram Service |
| **`irm-db`** | PostgreSQL 16 Alpine | Internal (5432) | ฐานข้อมูลหลัก (PO Headers, Items, Sub-items, Masters, Audit Logs, Settings) |
| **`irm-redis`** | Redis 7 Alpine | Internal (6379) | Cache และ Fast Key-Value Store |

---

## 3. ข้อมูลการเข้าสู่ระบบเริ่มต้น

* **URL เข้าใช้งาน Web:** [http://localhost](http://localhost) (หรือตาม IP/Domain ที่ Deploy)
* **URL API Swagger Docs:** [http://localhost/docs](http://localhost/docs)
* **ผู้ดูแลระบบ (Default Super Admin):**
  * **Username:** `admin`
  * **Password:** `irm@2026`
* **ผู้ใช้งานตัวอย่างฝ่ายจัดซื้อ (Default Buyers):**
  * `patcha` / `irm@2026` (พัชชา)
  * `pinyada` / `irm@2026` (ภิญญาดา)

---

## 4. ฟังก์ชันการทำงานหลักและโมดูลทั้งหมด

### 4.1 หน้า Operation (`/operation`)
* **Dual Synchronized Scrollbars:** แถบเลื่อน Mirror Scrollbar ด้านบน ซิงค์กับตารางด้านล่าง ช่วยให้ผู้ใช้จอ 14" เลื่อนดูคอลัมน์ขวาได้ทันที
* **Sticky Columns:** ตรึง 3 คอลัมน์แรก (`#`, `PO No. / Date`, `Group`) ไม่ให้เลื่อนหลุดสายตา
* **Visual Color Strip Highlighting:**
  * 🟢 **เขียว:** รายการที่ปรับเปลี่ยนแล้ว (Est. Date / Qty ระบุแล้ว)
  * 🟠 **ส้ม:** รายการที่ Supplier ตอบกลับแล้ว รอจัดซื้อ Accept
  * ⚪ **เทา:** รายการที่ยังไม่ปรับเปลี่ยน
* **Quick Filter Tabs:** ปุ่มเม็ดยากรองด้านบน: *ทั้งหมด*, *มาใหม่วันนี้*, *ปรับเปลี่ยนแล้ว*, *ยังไม่ปรับเปลี่ยน*, *Sup ตอบกลับ*
* **Inline Sub-Item Split Editor:**
  * กดปุ่ม `+` เพื่อแตกงวดส่ง (Split) ได้สูงสุดไม่จำกัดงวด
  * รองรับสิทธิ์ **ส่งเกินยอดสั่งซื้อ (Allow Over-Delivery)**
* **ปุ่ม Accept (ยืนยันรับทราบ):**
  * เมื่อ Sup ส่งข้อมูลมา จะขึ้นปุ่ม `✓ Accept`
  * เมื่อกด Accept ปุ่มจะหายไปทันที และ **คงสถานะผู้ปรับปรุงล่าสุดเป็น `🏢 Supplier` พร้อมเวลาจริงเสมอ** (ไม่เปลี่ยนเป็น Admin)

---

### 4.2 หน้า Item Master (`/items`)
* **จำแนกครบ 7 กลุ่มสินค้า:**
  1. `RM-ALU/UPVC (เต็ม)` (สีฟ้า)
  2. `HW` (สีส้ม)
  3. `FG-Non BOI` (สีม่วง)
  4. `RM-กระจก` (สีเขียว)
  5. `SP - Sparepart` (สีชมพู)
  6. `RM-เหล็กดัด` (สีเหลือง)
  7. `HW-Partner` (สีเทา)
* **Quick Group Filter Tabs:** แท็บฟิลเตอร์ด้านบนคลิกเพื่อดูเฉพาะกลุ่มสินค้าที่ต้องการได้ทันที
* **กำหนด Lead Time & Notify Alert:** กำหนดรอบวัน Lead Time และวันแจ้งเตือนล่วงหน้าต่อรหัสสินค้า
* **Import / Export CSV:** นำเข้าและส่งออกข้อมูลรหัสสินค้า

---

### 4.3 หน้า Supplier Master (`/suppliers`)
* **การแก้ไข Email ถาวร (Safe from SAP Sync):**
  * Email ที่ผู้ใช้กรอกหรือแก้ไขในระบบ IRM จะได้รับการป้องกัน ไม่ถูกการ Sync ข้อมูลจาก SAP เขียนทับ
* **การล้างแป้นพิมพ์ภาษาไทยอัตโนมัติ (Email Auto-Sanitization):**
  * ป้องกันการพิมพ์ตกภาษาไทย เช่น `ืn.chaiwat@gmail.com` ➔ แก้เป็น `n.chaiwat@gmail.com`
* **สวิตช์อนุญาตให้ส่งเกินยอดสั่งซื้อ (Allow Over-Delivery):**
  * สามารถเปิด-ปิดสิทธิ์ `อนุญาตให้ส่งเกิน (Over-Delivery)` ราย Supplier ได้ทันที
* **การส่ง Email แบบ UTF-8:** ใช้มาตรฐาน `EmailMessage` รองรับภาษาไทย 100%
* **🛡️ Implementation Safe Lock (ระงับการส่งอีเมลอัตโนมัติ 100%):**
  * ในช่วง Implementation ระบบได้ทำการ **Hard-Lock ปิดกั้นการส่งอีเมลตามรอบ Schedule (วันจันทร์และพฤหัสบดี) โดยเด็ดขาด (`mail_schedule_enabled = false`)** ทั้งในระดับ APScheduler และ Service Layer เพื่อความปลอดภัยสูงสุด ป้องกันไม่ให้มีอีเมลจริงหลุดออกไปหาคู่ค้าภายนอกเด็ดขาด

---

### 4.4 หน้า Supplier Portal (`/supplier/portal/[token]`)
* **ขอบเขตของลิงก์ (All-PO Token Scope):**
  * ลิงก์ที่ส่งจากหน้า Supplier Master จะดึง **ทุกใบสั่งซื้อ (PO) ที่เปิดค้างอยู่ทั้งหมด** ของ Supplier รายนั้นมาแสดงในหน้าเดียว
* **การคำนวณและกรอกยอดส่งเกิน:**
  * หาก Supplier ได้รับสิทธิ์ Over-Delivery ระบบจะไม่ขึ้นบล็อกแจ้งเตือน และอนุญาตให้บันทึกทั้งร่าง (Draft) และกดยืนยันจริง
* **Full-Locking on Confirmation (ล็อกอ่านอย่างเดียวทันทีหลังกดยืนยัน):**
  * เมื่อ Supplier กดยืนยันส่งข้อมูล:
    1. ปิดช่องกรอกและปุ่มเลือกวันที่ทั้งหมดเป็น Read-only
    2. ซ่อนปุ่ม `[ 🗑️ ลบงวดส่ง ]`
    3. ซ่อนปุ่ม `[ + เพิ่มงวดส่งถัดไป ]`
    4. ซ่อนปุ่ม `[ ↳ แตกส่งหลายงวด ]`
    5. ซ่อนแถบปุ่มบันทึกด้านล่างทั้ง `[ บันทึกชั่วคราว ]` และ `[ ยืนยันส่งข้อมูลให้ฝ่ายจัดซื้อ ]`
    6. อัปเดตสถานะเป็น `🟢 ตอบกลับแล้ว`

---

### 4.5 การแจ้งเตือน Telegram
ข้อความ Telegram ทุกข้อความในระบบถูกบังคับใช้ **Standard Header Template เดียวกัน 100%** พร้อม **Rich Emojis** ในทุก Bullet Point:

```text
📦 IRM System · 19 ส.ค. 2569 16:55 น.
────────────────────────────
🟢 Supplier ยืนยันกำหนดส่งวัตถุดิบผ่าน Portal

• 🏢 ผู้จำหน่าย: บริษัท อินซูโฟม อุตสาหกรรม (สมุทรสาคร) จำกัด (VD-0720)
• 📑 เลขที่ PO: 260810099
• 📦 จำนวนที่ตอบกลับ: 1 รายการ
• 🚚 สรุปกำหนดส่งมอบ:
   - HW-3107-00000 โฟมแท่ง (10,340 ชิ้น) ➔ แตกส่ง 3 งวด (18/10, 21/10, 27/10)
• 💻 ขั้นตอนถัดไป: ฝ่ายจัดซื้อสามารถเข้าตรวจสอบที่หน้า Operation
```

#### รายการ Incident ทั้ง 7 แบบในระบบ:
1. `🔄 การ Sync ข้อมูลจาก SAP B1 สำเร็จ / ล้มเหลว`
2. `📬 รายงานการกระจาย Email แจ้งเตือน Supplier`
3. `🟢 Supplier ยืนยันกำหนดส่งวัตถุดิบผ่าน Portal`
4. `⏰ แจ้งเตือนวัตถุดิบใกล้ถึงกำหนดส่งมอบ (Upcoming Inbound)`
5. `🚨 แจ้งเตือนด่วน: รายการวัตถุดิบเกินกำหนดส่ง (Critical Overdue)`
6. `🔓 แจ้งเตือนการปลดล็อครายการโดยฝ่ายจัดซื้อ (Unlock Override)`
7. `📢 ทดสอบการส่งข้อความเข้ากลุ่ม / ส่วนตัว`

---

### 4.6 มาตรฐานชื่อไฟล์ Export CSV
ทุกไฟล์ที่ถูก Export ออกมาจากระบบ จะขึ้นต้นด้วย `IRM_` และต่อท้ายด้วย Timestamp `_YYYYMMDD_HHMMSS.csv`:

| หน้าจอ | รูปแบบชื่อไฟล์ | ตัวอย่าง |
| :--- | :--- | :--- |
| **Item Master** | `IRM_Item_Master_Export_YYYYMMDD_HHMMSS.csv` | `IRM_Item_Master_Export_20260819_172811.csv` |
| **Supplier Master** | `IRM_Supplier_Master_Export_YYYYMMDD_HHMMSS.csv` | `IRM_Supplier_Master_Export_20260819_172811.csv` |
| **Analytics Dashboard** | `IRM_Supplier_Scorecard_YYYYMMDD_HHMMSS.csv` | `IRM_Supplier_Scorecard_20260819_172811.csv` |
| **Transaction Logs** | `IRM_Transaction_Logs_YYYYMMDD_HHMMSS.csv` | `IRM_Transaction_Logs_20260819_172811.csv` |

---

### 4.7 ระบบประวัติการแก้ไข (History Audit Trail)
* หน้าต่าง Modal ประวัติการเปลี่ยนแปลง (ไอคอนนาฬิกา 🕘) ถูกจัดเรียง **เหตุการณ์ล่าสุดขึ้นมาอยู่บนสุดเสมอ (Newest First)**
* รายการบนสุดจะมีป้ายแท็กไฮไลต์ **`ล่าสุด` (สีน้ำเงินคราม)** ทำให้ผู้ใช้ทราบสถานะปัจจุบันได้ทันทีโดยไม่ต้องเลื่อน Scroll ลงไปดูด้านล่าง

---

### 4.8 แดชบอร์ดวิเคราะห์ผลงาน (Dashboard)
* **Scorecard & OTIF Tracking:** คำนวณ On-Time In-Full Rate (%) แยกตามเกรด Supplier (A, B, C, D)
* **SLA Status:** ติดตามเวลาตอบกลับของคู่ค้าเทียบกับเวลาหมดอายุของ Token
* **Lead Time Forecast Chart:** กราฟจำแนกแนวโน้มการรับเข้าวัตถุดิบล่วงหน้า 30 วัน

---

## 5. เมทริกซ์การจัดการ Conflict และการล็อกข้อมูล

| ลำดับเหตุการณ์ | ฝั่ง Supplier Portal | ฝั่ง Operation (จัดซื้อ) | ผลลัพธ์และสิ่งที่ระบบยึดถือ |
| :--- | :--- | :--- | :--- |
| **1. ส่ง Email ให้ Sup** | เรคอร์ดเข้าสู่สถานะรอตอบกลับ | ขึ้นไอคอนแม่กุญแจ `🔒 รอ Sup ตอบ` | ระบบล็อกให้สิทธิ์ Supplier ตอบก่อน |
| **2. User กดยกเลิกสิทธิ์ (Unlock)** | หากเปิดลิงก์รอบใหม่ จะเห็นข้อมูลที่ User แก้ไข | ปลดล็อค `🔓` และแก้ไขวัน/ยอดส่งได้ | **ยึดตาม User ล่าสุด** |
| **3. Sup เซฟ Draft ไว้ แล้ว User มาแก้** | เปิดรอบใหม่จะเห็นข้อมูลที่ User ปรับแก้ | เห็นค่างวดที่ Sup ร่างไว้และปรับแก้ทับได้ | **ยึดตามการแก้ไขล่าสุด** |
| **4. Sup กดยืนยันส่งจริง (Final Submit)** | หน้าจอล็อกเป็น Read-only ทันที | ขึ้นแท็บ `Sup ตอบกลับ` พร้อมปุ่ม `Accept` | **ยึดตาม Supplier** ➔ รอจัดซื้อกด Accept |
| **5. User กดปุ่ม Accept** | จอยังคงล็อกเหมือนเดิม | ปุ่ม Accept หายไป, ผู้ปรับปรุงคงเป็น Sup | ยืนยันรับแผนเข้าสู่การผลิตสมบูรณ์ |

---

## 6. แนวทางการเชื่อมต่อ SAP & Deploy บน VPS Hostinger

### 🌟 แนะนำ: สถาปัตยกรรม SAP On-Premise Outbound Push Agent (Zero Firewall Changes)
เมื่อระบบ IRM ติดตั้งอยู่บน **VPS Hostinger (Public Cloud)** และฐานข้อมูล SAP B1 อยู่ภายในโรงงาน (**On-Premise Behind Firewall/NAT**):

1. **สถาปัตยกรรม Outbound HTTPS Push (พอร์ต 443):**
   * ฝ่าย IT ไม่ต้องเปิด Port Forwarding (Port 1433) หรือแก้ Firewall ขาเข้าที่โรงงาน
   * Server ในโรงงานจะทำหน้าที่เป็น Agent ดึงข้อมูล Open POs จาก SAP MS SQL ในวง LAN และส่งคำขอแบบ **Outbound HTTPS POST** ไปยัง IRM บน VPS Hostinger ที่ Endpoint:
     `POST https://<vps-domain>/api/sap/inbound-push`
   * การส่งข้อมูลได้รับการป้องกันด้วย **Secret Ingest Token (`X-IRM-Ingest-Key`)**

2. **ระบบนับเวอร์ชันไฟล์อัตโนมัติ (`irm_agent_sync_v1.py`, `irm_agent_sync_v2.py`, ...):**
   * เข้าหน้า `System Settings` (`/admin/settings`) ➔ หมวด **`1. SAP On-Premise Sync Agent`**
   * ระบบจะแสดง Version ปัจจุบัน เช่น `v1 (irm_agent_sync_v1.py)`
   * เมื่อกดปุ่ม **[📥 ดาวน์โหลด Script (irm_agent_sync_v2.py)]** ระบบจะ:
     1. รันเลขเวอร์ชันถัดไปอัตโนมัติ (v1 ➔ v2 ➔ v3...)
     2. ฝังค่า `AGENT_VERSION = "v2"` และ `AGENT_FILENAME = "irm_agent_sync_v2.py"` ลงในไฟล์
     3. บันทึกประวัติการดาวน์โหลดลงใน **Transaction Logs** พร้อมระบุชื่อผู้ดาวน์โหลดและเวลา เพื่อให้ตรวจสอบย้อนหลังได้ว่า On-Premise ใช้ไฟล์ตรงกับเวอร์ชันปัจจุบันของ IRM หรือไม่

3. **การตั้งเวลารันอัตโนมัติบน On-Premise Server (Task Scheduler):**
   * ไฟล์ Python ที่ดาวน์โหลดเป็นแบบ Single-run (รันครั้งเดียวจบ) โดย Admin สามารถนำคำสั่งจากหน้าจอไปตั้งเวลาใน Windows Task Scheduler ได้เอง:
     ```cmd
     schtasks /create /tn "IRM_SAP_Sync_Daily" /tr "python C:\IRM_Agent\irm_agent_sync_v1.py" /sc daily /st 06:45 /ru "SYSTEM" /f
     ```
   * **Linux Crontab:**
     ```cron
     45 6 * * * /usr/bin/python3 /opt/irm/irm_agent_sync_v1.py >> /var/log/sap_sync.log 2>&1
     ```

---

## 7. คำสั่งที่ใช้ในการดูแลระบบ

### การเริ่มและหยุดระบบ (Docker)
```bash
# เริ่มระบบทั้งหมดพร้อม Build
docker-compose up -d --build

# ดูสถานะ Container ทั้ง 5 ตัว
docker-compose ps

# ดู Logs แบบ Real-time
docker-compose logs -f irm-backend
docker-compose logs -f irm-frontend

# ปิดระบบทั้งหมด
docker-compose down
```

### การ Rebuild เฉพาะ Container
```bash
# Rebuild Frontend
docker-compose up -d --build irm-frontend

# Rebuild Backend
docker-compose up -d --build irm-backend
```

### การสำรองและกู้คืนฐานข้อมูล (PostgreSQL Backup & Restore)
```bash
# Backup Database
docker-compose exec irm-db pg_dump -U irm_user irm_db > irm_backup_$(date +%Y%m%d).sql

# Restore Database
cat irm_backup_20260819.sql | docker-compose exec -T irm-db psql -U irm_user irm_db
```

---
*เอกสารฉบับนี้จัดทำขึ้นเพื่อใช้เป็นคู่มือส่งมอบงานระบบ IRM (Incoming Raw Material System) ฉบับสมบูรณ์*
