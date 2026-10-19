# 📌 IRM System — HANDOFF & PROGRESS LOG

> **วันที่บันทึก:** 19 ตุลาคม 2026 (11:58 น.)  
> **สถานะโครงการ:** Production-Ready, Performance-Optimized & Feature Complete (`https://irm.windowasia.com`)  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **Latest Commit:** `12ee325` (`feat(copilot): add maximize expand button and responsive fullsize layout to ai copilot widget`)  
> **VPS Hostinger Path:** `/var/www/Irm`  

---

## 🎯 1. ภาพรวมระบบ (System Overview)

ระบบ **IRM (Incoming Raw Material Management System)** ของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) ทำหน้าที่เชื่อมโยงข้อมูล PO วัตถุดิบ 7 กลุ่มหลักจาก **SAP Business One** ส่งต่อให้ Supplier ระบุวันส่งมอบผ่าน **Cryptographic Portal**, วางแผนนัดหมายลง **ปฏิทินส่งของ (Calendar)**, พิมพ์ใบตรวจรับสินค้าจริง (**Receiving Checklist**), แจ้งเตือนยอดวัตถุดิบเข้าประจำวันรายบุคคลผ่าน **Telegram Direct Message (DM)**, ส่งอีเมลสรุปงานและไฟล์แนบ Excel 2 Sheet ให้ทีมจัดซื้อ (**PU Reminder Email**), ส่งต่อข้อมูลให้ระบบ **QMS**, รองรับการยืนยันตัวตนระดับองค์กรผ่าน **Central IAM (OAuth2 / OIDC SSO)** พร้อม Break-Glass Mode, และมีระบบ **In-App AI Copilot & Read-Only MCP Tools (Enterprise Standard v2.8.0)** สำหรับวิเคราะห์และสรุปข้อมูลงานอย่างปลอดภัย พร้อมระบบ Fullsize Maximize UI

---

## 🏗️ 2. สรุปความคืบหน้าและการพัฒนางานล่าสุด (19 ตุลาคม 2026)

### 1) 🤖 พัฒนาระบบ In-App AI Copilot & Read-Only MCP Tools (Enterprise Standard v2.8.0)
* **โจทย์ความต้องการ:** พัฒนาผู้ช่วย AI อัจฉริยะส่วนตัวประจำระบบ IRM ตามมาตรฐาน Enterprise Central IAM Integration v2.8.0 (หมวด E) โดยทำงานภายใต้กฎเหล็ก **Strict Read-Only**, **Strict Role-Based Access Control (RBAC)**, และ **Strict Zero-Training & Enterprise Data Sovereignty** (ISO/IEC 27001)
* **การพัฒนา Backend:**
  * **Database Seed ([`init_db.py`](file:///d:/Python/IRM/backend/app/init_db.py)):** เพิ่มการตั้งค่าหมวด `ai_copilot` ลงในตาราง `system_settings` (`ai_copilot_enabled`, `ai_provider`, `ai_model`, `ai_api_key`, `ai_base_url`, `ai_system_prompt`, `ai_allow_mcp_tools`)
  * **AI Copilot Service ([`ai_copilot_service.py`](file:///d:/Python/IRM/backend/app/services/ai_copilot_service.py)):**
    * **Read-Only Analytical Tools:** รวบรวมฟังก์ชันดึงและสรุปข้อมูลแบบอ่านอย่างเดียว (`irm_get_dashboard_summary`, `irm_search_open_pos`, `irm_get_delivery_calendar`, `irm_lookup_masters`, `irm_search_closed_history`, `irm_get_admin_audit_summary`) ที่กรองข้อมูลตามสิทธิ์ Item Groups และ Role ของผู้ใช้งานจริง (`get_effective_user_allowed_groups`) พร้อมฟอร์แมตวันที่แบบ Pure Date Standard (`dd/mm/yyyy`) 100%
    * **Strict Mutation Guard (`detect_mutation_intent`):** ตรวจจับคำสั่งแก้ไข/เพิ่ม/ลบ/อนุมัติข้อมูล และปฏิเสธอย่างสุภาพพร้อมจำลองข้อมูลปัจจุบัน (Preview) และแนะนำเมนูบนหน้าเว็บให้ผู้ใช้กดทำเอง
    * **DLP Scrubber & Mandatory Zero-Training Headers:** กรองรหัสผ่าน/Token/Key ออก 100% (`sanitize_context_for_privacy`) พร้อมแนบ Headers `X-No-Model-Training: true`, `X-Data-Retention: none`, `X-OpenAI-Data-Usage-Opt-Out: true`, `store: false` ไปยัง External LLM Provider (Google Gemini, OpenAI, Anthropic, Ollama)
    * **Zero-Cost Local Rule-Based Engine:** รองรับการตอบคำถามภาษาไทยจากข้อมูลจริงในฐานข้อมูลได้ทันทีแม้ยังไม่ได้ใส่ External API Key
  * **AI Copilot Router ([`ai_copilot.py`](file:///d:/Python/IRM/backend/app/routers/ai_copilot.py)):**
    * `GET /api/settings/ai`: ดึงคอนฟิก AI และสถานะความพร้อมแสดงผล Widget (Masking API Key สำหรับ User ทั่วไป และส่งคืนค่าเต็มให้ Admin พร้อมปุ่มเปิดดู)
    * `PUT /api/settings/ai`: บันทึกการตั้งค่า AI แบบ Dynamic Runtime พร้อมบันทึก Transaction Audit Log
    * `POST /api/settings/ai/test`: ทดสอบการเชื่อมต่อ API Key กับ Provider พร้อมวัด Latency (ms)
    * `POST /api/ai/chat`: เอนด์พอยต์สนทนาหลักที่ประมวลผลภายใต้บริบทสิทธิ์ของผู้ใช้
* **การพัฒนา Frontend:**
  * **Floating Chat Widget ([`SpokeCopilotWidget.tsx`](file:///d:/Python/IRM/frontend/src/components/common/SpokeCopilotWidget.tsx)):** หน้าต่างแชท AI ลอยมุมขวาล่าง มีปุ่มคำถามแนะนำด่วน (Quick Prompts), ป้ายกำกับความปลอดภัย Read-Only & Zero-Training, รองรับการย่อ/ขยาย และตรวจสอบสถานะ `enabled` จาก Backend โดยซ่อนอัตโนมัติหากยังไม่เปิดใช้งาน และซ่อนในโหมด Print
  * **Dashboard Layout ([`layout.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/layout.tsx)):** ติดตั้ง `SpokeCopilotWidget` ครอบคลุมทุกหน้าจอการทำงาน

### 2) 🛠️ แก้ไขและปรับปรุง System Settings & Floating Widget (UI/UX Refinement)
1. **ปุ่ม Quick Jump Navigation ขาดแท็บที่ 9:**
   * เพิ่มปุ่มแท็บที่ 9 `#sec-ai-copilot` ในแถบ Quick Jump แถวบนสุดของหน้า System Settings พร้อมไอคอน Bot สีม่วง ลิงก์ตรงมายัง Section 9 ทันที
2. **เปิดสวิตช์แล้ว Floating Widget ไม่แสดง:**
   * Backend ปรับ `widget_ready = bool(cfg["ai_copilot_enabled"])` ให้เปิดใช้งานได้ทันทีแม้ยังไม่ใส่ Key เนื่องจากมี Local Fallback Engine
   * Frontend ติดตั้ง Event Listener `irm_ai_settings_updated`, `storage`, และ `visibilitychange` เพื่อรีเฟรชสถานะทันทีเมื่อ Admin กด Save โดยไม่ต้องโหลดหน้าเว็บใหม่
   * ปรับ Layer Floating Widget เป็น **`z-[9999]`** เพื่อไม่ให้ถูก Footer หรือคอนเทนเนอร์อื่นบดบัง
3. **เพิ่มปุ่มลูกตา (Eye / EyeOff Toggle) สำหรับ Secret / Password ทุกช่อง:**
   * Section 1: `sap_ingest_token` (Secret Ingest Token)
   * Section 2: `smtp_password` (SMTP Password)
   * Section 3: `telegram_bot_token` (Bot Token ID)
   * Section 5: `sap_password` (SQL Read-Only Password)
   * Section 6: `ad_secret_key` (Active Directory Secret Key)
   * Section 7: `ciam_client_secret` (OIDC Client Secret)
   * Section 8: `management_api_key` (Central Management API Key)
   * Section 8: `qms_api_key` (QMS Integration API Key)
   * Section 9: `ai_api_key` (AI API Key)

### 3) 🔲 เพิ่มปุ่มขยายขนาดหน้าต่าง (Maximize / Expand) เหมือน Central IAM Copilot
* **โจทย์ความต้องการ:** ช่อง Chat มีขนาดเล็ก เมื่อมีข้อมูลตาราง PO ค้างส่งหรือสรุปรายการยาวๆ ควบคุมยาก ต้องการปุ่มขยายขนาดใหญ่ขึ้นตรงตามดีไซน์ของ **Central IAM Copilot**
* **การพัฒนาใน [`SpokeCopilotWidget.tsx`](file:///d:/Python/IRM/frontend/src/components/common/SpokeCopilotWidget.tsx):**
  * เพิ่มปุ่มไอคอน `<Maximize2 className="w-3.5 h-3.5" />` ในกรอบสี่เหลี่ยมบน Header ขวาบน ถัดจากปุ่มล้างการสนทนา
  * เมื่อกดขยายจะสลับเป็น `<Minimize2 />` และปรับขนาดหน้าต่างเป็น Responsive Fullsize:
    * **โหมดปกติ (Normal Mode):** กว้าง `440px`, สูง `590px`
    * **โหมดขยายใหญ่ (Expanded Mode):** กว้าง `720px - 840px` (หรือ `96vw` บนจอมือถือ), สูง `88vh` (สูงสุด `920px`) ทำให้การอ่านข้อความคำตอบยาวๆ หรือสรุปตารางทำได้อย่างสบายตา
    * **โหมดพับเก็บ (Docked Mode):** กว้าง `320px`, สูง `56px` พักไว้มุมขวาล่าง
  * เพิ่มปุ่ม **เริ่มบทสนทนาใหม่ (`RotateCcw`)** บน Header สำหรับล้างข้อความได้ทันที

---

## 🏗️ 3. สรุปความคืบหน้าการพัฒนาก่อนหน้า (2 - 6 ตุลาคม 2026)

### 1) 🚀 ระบบเชื่อมต่อ Telegram อัตโนมัติด้วย Deep Linking & Webhook Sync (Zero Manual Input)
* พนักงานเพียงสแกน QR Code แล้วกดปุ่ม START ใน Telegram ระบบจะดึง Chat ID และผูกบัญชีให้อัตโนมัติทันที
* **Database Model ([`telegram_bind_token.py`](file:///d:/Python/IRM/backend/app/models/telegram_bind_token.py)):** ตาราง `telegram_bind_tokens` จัดเก็บ Token ชั่วคราว (อายุ 15 นาที) พร้อม Cascade Foreign Key
* **Webhook ([`telegram.py`](file:///d:/Python/IRM/backend/app/routers/telegram.py)):** รับ Webhook `/start bind_<token>` บันทึก Chat ID และตอบกลับต้อนรับทันที
* **Adaptive Smart Modal ([`TelegramSyncModal.tsx`](file:///d:/Python/IRM/frontend/src/components/common/TelegramSyncModal.tsx)):** Two-Mode Modal แสดง Connected View ทันทีสำหรับผู้ใช้ที่เชื่อมต่อแล้ว พร้อมปุ่ม `[ ⚡ ทดสอบส่งข้อความหาฉัน ]`

### 2) 🏢 ปลดล็อกการเข้าสู่ระบบด้วย Active Directory (AD) จากหน้า Login & Auto-Provisioning
* รองรับการล็อกอินด้วย Username และ Password ของ Active Directory ทั้งสำหรับผู้ใช้ที่มีอยู่แล้วและพนักงานใหม่
* **AD Auto-Provisioning:** หากไม่พบบัญชีใน IRM แต่ AD ถูกต้อง ระบบสร้างบัญชีผู้ใช้ใหม่ให้อัตโนมัติ (`PU User`, `use_ad_auth=True`)
* **AD Fallback Verification:** หากรหัสผ่าน Local ไม่ตรง ระบบจะตรวจสอบ AD Gateway ให้อัตโนมัติ

### 3) 🚪 ปรับปรุง Logout & Session Expiration ให้กลับมาหน้า Login ของ IRM เสมอ
* ปรับ Safeguard ใน `auth-context.tsx` และ `api.ts`: จะ Redirect ไป CIAM Portal เฉพาะเมื่อ `authProvider === 'sso'` เท่านั้น นอกนั้นกลับหน้า Login ของ IRM เสมอ 100%

### 4) 🧹 ระบบ Log Retention Policy (15 วัน) & Auto Purge
* เพิ่ม Card กำหนดระยะเวลาจัดเก็บ Log ย้อนหลัง (Default 15 วัน) ใน System Settings Section 4
* Background Job ใน `scheduler.py` เวลา 00:30 น. สั่งลบแถว `transaction_logs` ที่เก่ากว่ากำหนดอัตโนมัติ

---

## 🗂️ 4. ลำดับเมนูที่เป็นทางการของระบบ (Official Menu Order)

1. **Dashboard** (`/dashboard`)
2. **Operation** (`/operation`)
3. **Calendar** (`/calendar`)
4. **Receiving Checklist** (`/receiving-checklist`)
5. **Item Master** (`/items`)
6. **Supplier Master** (`/suppliers`)
7. **History** (`/history`)
8. **System Blueprint** (`/system-blueprint`)
9. **Admin** (`/admin/settings`, `/admin/users`, `/admin/groups`, `/admin/auth-matrix`, `/admin/logs`)

---

## 📁 5. ไฟล์สำคัญที่ได้รับการปรับปรุงล่าสุด (Key Modified Files)

| ไฟล์ที่แก้ไข | วัตถุประสงค์และการเปลี่ยนแปลงสำคัญ |
| :--- | :--- |
| [`frontend/src/components/common/SpokeCopilotWidget.tsx`](file:///d:/Python/IRM/frontend/src/components/common/SpokeCopilotWidget.tsx) | **Maximize & Expand Fullsize UI:** เพิ่มปุ่มขยายหน้าจอใหญ่ (720-840px / 88vh), ปุ่ม RotateCcw บน Header, เลเยอร์ `z-[9999]`, และตัวดักจับอัปเดต Event แบบ Real-time |
| [`frontend/src/app/(dashboard)/admin/settings/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/settings/page.tsx) | เพิ่ม Quick Jump Tab ที่ 9, เพิ่มปุ่มลูกตา (Eye/EyeOff) ครบทุกช่อง Secret/Password ทั้ง 9 ส่วน, และ Dispatch Custom Event เมื่อบันทึก AI |
| [`backend/app/routers/ai_copilot.py`](file:///d:/Python/IRM/backend/app/routers/ai_copilot.py) | ปรับ `widget_ready` อิงตามสวิตช์เปิดใช้งาน, คืนค่า Real Key ให้ Admin เพื่อให้ปุ่มลูกตาสามารถดูค่าจริงได้ |
| [`backend/app/routers/settings.py`](file:///d:/Python/IRM/backend/app/routers/settings.py) | คืนค่า `ciam_client_secret` จริงให้ Admin ใน endpoint `/ciam-sso` เพื่อรองรับการเปิดดูผ่านปุ่มลูกตา |
| [`backend/app/services/ai_copilot_service.py`](file:///d:/Python/IRM/backend/app/services/ai_copilot_service.py) | Engine หลัก Enterprise v2.8.0 พร้อม Read-Only Analytical Tools, Mutation Guard, DLP Scrubber, Zero-Training Headers, และ Local Rule Fallback |
| [`backend/app/init_db.py`](file:///d:/Python/IRM/backend/app/init_db.py) | Seeding คอนฟิก AI Copilot ลงใน `system_settings` |
| [`frontend/src/app/(dashboard)/layout.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/layout.tsx) | ติดตั้ง `SpokeCopilotWidget` ครอบคลุมทุกหน้าจอการทำงาน |

---

## 🚀 6. คำสั่งอัปเดตระบบบน VPS Hostinger (`/var/www/Irm`)

```bash
# 1. ไปที่โฟลเดอร์โปรเจกต์ IRM บน VPS
cd /var/www/Irm

# 2. ดึงโค้ดล่าสุดจาก main branch
git pull origin main

# 3. สั่ง Rebuild คอนเทนเนอร์ Backend และ Frontend
docker compose up -d --build irm-backend irm-frontend

# 4. ตรวจสอบสถานะการทำงาน
docker compose ps
```

---

## 📌 7. Checkpoint สำหรับการเริ่มงานในครั้งหน้า (Next Session)

* **สถานะความพร้อมของระบบ (System Readiness):**
  * โค้ดทั้งหมดได้รับการตรวจสอบ Syntax และ Compile ผ่าน 100%:
    * `python -m py_compile` ผ่านสมบูรณ์ทุกไฟล์
    * `npm run build` static pages สำเร็จครบ 19/19 หน้า รหัสผ่าน 0
  * บันทึก Git Commit & Push ขึ้น GitHub `main` เรียบร้อยแล้ว (Latest Commit: `12ee325`)
  * ฟีเจอร์ In-App AI Copilot และ UI Settings สมบูรณ์ครบถ้วน:
    1. **Dynamic Responsive Widget:** มีปุ่ม Maximize ขยายใหญ่ (720-840px) ให้อ่านสรุป PO และตารางข้อมูลยาวๆ ได้อย่างชัดเจนเหมือน Central IAM Copilot
    2. **Secret Visibility Controls:** ทุกช่อง Secret, Password, และ API Key มีปุ่มลูกตาเปิด/ปิดการมองเห็น
    3. **Zero-Training & Read-Only Guaranteed:** ปฏิเสธการแก้ไขข้อมูลทุกชนิด และไม่นำข้อมูลองค์กรไป Train โมเดลภายนอก
    4. **Instant Toggle Reaction:** เปิด/ปิด Widget ในหน้า Settings แล้วผลลัพธ์สะท้อนทันทีโดยไม่ต้องโหลดหน้าเว็บใหม่
* **ขั้นตอนเมื่อเริ่มงานในครั้งหน้า (Next Steps):**
  1. ดำเนินการ Deploy ขึ้น VPS Hostinger ตามคำสั่งในข้อ 6
  2. ทดสอบการใช้งาน In-App AI Copilot บน Production (ทั้งโหมดหน้าต่างปกติและโหมดขยายใหญ่ Maximize)
  3. พร้อมรับฟังฟีดแบ็กหรือพัฒนาฟังก์ชันเพิ่มเติมร่วมกับทีมงานได้ทันทีครับ
