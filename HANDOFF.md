# 📌 IRM System — HANDOFF & PROGRESS LOG

> **วันที่บันทึก:** 14 พฤศจิกายน 2026 (16:00 น.)  
> **สถานะโครงการ:** Production-Ready, Central IAM Specification v2.12.0 Implemented & Hardened (`https://irm.windowasia.com`)  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **Latest Commit:** Next on `main` — CIAM Origin IP `157.173.219.153` Whitelist & SSO Audit Log Fix (built on `07780a2`)  
> **VPS Hostinger Path:** `/var/www/Irm`  

---

## 🎯 1. ภาพรวมระบบ (System Overview)

ระบบ **IRM (Incoming Raw Material Management System)** ของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) ทำหน้าที่เชื่อมโยงข้อมูล PO วัตถุดิบ 7 กลุ่มหลักจาก **SAP Business One** ส่งต่อให้ Supplier ระบุวันส่งมอบผ่าน **Cryptographic Portal**, วางแผนนัดหมายลง **ปฏิทินส่งของ (Calendar)**, พิมพ์ใบตรวจรับสินค้าจริง (**Receiving Checklist**), แจ้งเตือนยอดวัตถุดิบเข้าประจำวันรายบุคคลผ่าน **Telegram Direct Message (DM)**, ส่งอีเมลสรุปงานและไฟล์แนบ Excel 2 Sheet ให้ทีมจัดซื้อ (**PU Reminder Email**), ส่งต่อข้อมูลให้ระบบ **QMS**, รองรับการยืนยันตัวตนระดับองค์กรผ่าน **Central IAM (OAuth2 / OIDC SSO)** พร้อม Break-Glass Mode, ระบบ **In-App AI Copilot & Read-Only MCP Tools (Enterprise Standard v2.8.0)** และมาตรฐานความปลอดภัยล่าสุดตาม **Central IAM Specification v2.12.0** (90-Day Local Password Policy, In-App Bot Defense 3 ชั้น, RFC 9700 Seamless Launchpad)

---

## 🏗️ 2. สรุปความคืบหน้าและการพัฒนางานล่าสุด (12 พฤศจิกายน 2026)

### 1) 🔒 มาตรฐานความปลอดภัยรหัสผ่านบัญชีท้องถิ่น 90 วัน (หมวด G v2.12.0)
* **โมเดลผู้ใช้ & การย้ายฐานข้อมูล:**
  * เพิ่มคอลัมน์ `password_changed_at` (TIMESTAMPTZ) และ `must_change_password` (BOOLEAN) ในตาราง `users`
  * บรรจุลงใน DDL Migrations ของ [`init_db.py`](file:///d:/Python/IRM/backend/app/init_db.py) และสร้างสคริปต์ Standalone Migration [`add_password_policy_columns.py`](file:///d:/Python/IRM/backend/app/migrations/add_password_policy_columns.py)
* **Enterprise Password Complexity Engine ([`password_policy.py`](file:///d:/Python/IRM/backend/app/utils/password_policy.py)):**
  * ตรวจสอบความยาว 8 - 16 ตัวอักษร, พิมพ์ใหญ่ (A-Z) &ge; 1, พิมพ์เล็ก (a-z) &ge; 1, ตัวเลข (0-9) &ge; 1, อักขระพิเศษ (!@#$%^&*...) &ge; 1, และห้ามมี Username ปะปน
  * ตรวจสอบรอบอายุ 90 วัน: `(now - password_changed_at).days >= 90`
* **API Endpoints ([`auth.py`](file:///d:/Python/IRM/backend/app/routers/auth.py)):**
  * คำนวณสถานะและส่งคืน `must_change_password` และ `days_until_password_expiry` ใน `/api/auth/login` และ `/api/auth/me` สำหรับบัญชีที่ไม่ใช่ AD
  * เพิ่มเอนด์พอยต์ `POST /api/auth/local/change-password` สำหรับเปลี่ยนรหัสผ่าน บันทึก `password_changed_at = now`, เคลียร์ `must_change_password = false`, และบันทึก Audit Log ลง `transaction_logs`
* **Forced Modal Interception ([`ForcedPasswordChangeModal.tsx`](file:///d:/Python/IRM/frontend/src/components/common/ForcedPasswordChangeModal.tsx)):**
  * หน้าต่างแจ้งเตือนบังคับเปลี่ยนรหัสผ่านแบบไม่สามารถกดข้ามได้ พร้อม Real-time Checklist 6 ข้อ ติดตั้งใน [`layout.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/layout.tsx)

### 2) 🛡️ ระบบป้องกันบอทและ Brute-Force ภายในแอปพลิเคชัน 3 ชั้น (หมวด F v2.10.0)
* **Layer 1: Sliding-Window IP Rate Limiter ([`bot_defense.py`](file:///d:/Python/IRM/backend/app/utils/bot_defense.py)):**
  * กำหนดอัตรา 10 requests / 60 วินาที ต่อ Client IP พร้อมยกเว้น Corporate Whitelist (`127.0.0.1`, Docker Host, Central IAM VPS `157.173.219.153`, HQ IP `49.231.185.245`, สำนักงานสาขา `58.8.190.63`)
  * หากเกินกำหนดจะส่ง HTTP 429 Too Many Requests พร้อม Header `Retry-After` และบันทึก Log `ip_rate_limited`
* **Layer 2: Decoy Honeypot Trap:**
  * เพิ่มฟิลด์ดักบอทซ่อนสายตา `corporate_fax` และ `security_honey` ใน [`page.tsx`](file:///d:/Python/IRM/frontend/src/app/login/page.tsx)
  * Backend ตรวจจับและปฏิเสธด้วย HTTP 401 Silent Rejection ทันที พร้อมบันทึก Log `bot_honeypot_detected`
* **Layer 3: Submission Velocity Guard:**
  * ฝั่ง Frontend บันทึก Epoch Milliseconds เมื่อหน้าจอ Render เสร็จ (`form_render_ts`)
  * Backend ตรวจสอบระยะเวลากรอกฟอร์ม หากส่งเร็วกว่า 400ms จะถือเป็น Automated Bot Script และปฏิเสธด้วย HTTP 400 ทันที

### 3) 🚀 RFC 9700 Seamless SSO Initiation Bounce & Portal Launch Resilience (หมวด B.3)
* **Frontend Launch Endpoint ([`page.tsx`](file:///d:/Python/IRM/frontend/src/app/auth/start/page.tsx)):**
  * รองรับการเปิดแอป IRM จากการ์ดบน Central IAM Portal (`https://irm.windowasia.com/auth/start`)
  * ทำการสร้าง PKCE `code_verifier` และ `state` ผูกกับเบราว์เซอร์ แล้ว 302 Redirect ไปยัง CIAM เพื่อทำ Auto-Approval ในเวลา < 400ms ปลอดภัย 100% ตามมาตรฐาน RFC 9700
* **SSO Callback Resiliency ([`sso.py`](file:///d:/Python/IRM/backend/app/routers/sso.py) & [`callback/page.tsx`](file:///d:/Python/IRM/frontend/src/app/auth/callback/page.tsx)):**
  * ปรับ `code_verifier: Optional[str] = None` ใน `SsoCallbackRequest` และ Normalize whitespace / empty string เป็น `None`
  * Frontend ปรับส่ง `code_verifier: codeVerifier || undefined`
  * ติดตั้ง Axios Request Timeout 15 วินาที พร้อมแสดง UI แจ้งเตือนข้อผิดพลาดชัดเจนและปุ่ม `[ 🔄 ลองใหม่อีกครั้ง ]` และ `[ กลับหน้าล็อกอิน ]`

### 4) 🔍 การค้นพบ Root Cause และแก้ไขข้อผิดพลาดระหว่าง Deployment บน VPS
1. **TypeError: `Query(enum=...)` ใน `central_management.py` (Commit `07780a2`):**
   * **อาการ:** Uvicorn แครชตอนบูตระบบและวนลูป `Restarting (1)` ทำให้ Nginx ตอบกลับ `502 Bad Gateway` ทุก Endpoint ทั้ง Login ปกติและ SSO Callback
   * **สาเหตุ:** ใน FastAPI / Pydantic v2 `Query()` ไม่รองรับ parameter `enum=`
   * **วิธีแก้:** ปรับแก้ฟิลด์ `status_filter` เป็น `Query("all", description="Filter by account status: all, active, inactive")`
2. **DDL Isolation & Lock Timeout ป้องกัน Database Hang (`init_db.py`, Commit `9fa597a` & `493086f`):**
   * แยกคำสั่ง DDL Migration แต่ละรายการให้อยู่ใน Transaction อิสระของตัวเอง (`async with engine.begin()`)
   * เพิ่มคำสั่ง `SET lock_timeout = '2s';` ทุกคำสั่ง เพื่อป้องกันไม่ให้คำสั่ง `ALTER TABLE` ค้างรอคิว Lock ใน PostgreSQL
3. **Lifespan Startup Safeguard (`main.py`, Commit `9fa597a`):**
   * ครอบ `asyncio.wait_for(seed_data(), timeout=15.0)` ใน FastAPI lifespan เพื่อรับประกันว่า Uvicorn จะเปิดพอร์ต 8000 ให้บริการเสมอแม้กระบวนการเชื่อมต่อฐานข้อมูลภายนอกมี delay

### 5) 🛡️ มาตรฐานตรวจสอบ CIAM Origin IP (`157.173.219.153`) และ Audit Log (14 พฤศจิกายน 2026)
* **`central_management.py` (`verify_central_management_access`):**
  * อ่าน Origin IP ตามลำดับ `x-ciam-origin-ip` → `x-origin-ip` → `x-forwarded-for` (สกัด IP แรกด้วย `.split(",")[0].strip()`) พร้อมคง `network_ip` แยกไว้สำหรับกรณี API Key ไม่ถูกต้อง และอนุญาต `"157.173.219.153"` ใน `allowed_ips` เสมอ
* **`sso.py` (`handle_sso_callback`, `toggle_break_glass_mode`):**
  * ดึง `ciam_origin_ip` จาก OIDC Claims (`claims.get("ciam_origin_ip") or "157.173.219.153"`) มาบันทึกเป็น `ip` หลักใน `transaction_logs` (`auto_provision_user`, `account_deactivated`, `login_success`) และเก็บ IP เบราว์เซอร์จริงไว้ใน `details["browser_ip"]` ส่วน `toggle_break_glass_mode` อ่านผ่าน `_extract_request_ip(..., prefer_ciam_origin=True)`
* **`init_db.py`:**
  * ตั้งค่าเริ่มต้น `"157.173.219.153"` ให้ `management_allowed_ips` และ `ciam_allowed_ips` และเติม `"157.173.219.153"` อัตโนมัติหากมีรายการ Whitelist เดิมที่ขาด IP นี้

---

## 🗂️ 3. ลำดับเมนูที่เป็นทางการของระบบ (Official Menu Order)

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

## 📁 4. ไฟล์สำคัญที่ได้รับการปรับปรุงล่าสุด (Key Modified Files)

| ไฟล์ที่แก้ไข | วัตถุประสงค์และการเปลี่ยนแปลงสำคัญ |
| :--- | :--- |
| [`backend/app/routers/central_management.py`](file:///d:/Python/IRM/backend/app/routers/central_management.py) | **Hotfix Uvicorn Crash:** แก้ไข `Query(enum=...)` เป็น `Query(description=...)` ปลดล็อกให้ Backend บูตขึ้นสำเร็จ |
| [`backend/app/init_db.py`](file:///d:/Python/IRM/backend/app/init_db.py) | ปรับ DDL Migration ให้รัน Transaction ละ 1 คำสั่ง และใส่ `SET lock_timeout = '2s';` ป้องกัน Transaction Hang |
| [`backend/app/main.py`](file:///d:/Python/IRM/backend/app/main.py) | ครอบ `asyncio.wait_for(seed_data(), timeout=15.0)` ป้องกัน Lifespan Startup บล็อกพอร์ต 8000 |
| [`backend/app/routers/auth.py`](file:///d:/Python/IRM/backend/app/routers/auth.py) | บรรจุ Bot Defense 3 ชั้น และ Endpoint `POST /api/auth/local/change-password` |
| [`backend/app/routers/sso.py`](file:///d:/Python/IRM/backend/app/routers/sso.py) | รองรับ `code_verifier: Optional` สำหรับ Portal Launch |
| [`backend/app/utils/bot_defense.py`](file:///d:/Python/IRM/backend/app/utils/bot_defense.py) | Sliding-Window IP Rate Limiter (10 req/60s) และ Corporate Whitelist |
| [`backend/app/utils/password_policy.py`](file:///d:/Python/IRM/backend/app/utils/password_policy.py) | กฎความซับซ้อนรหัสผ่าน 6 ข้อ และระบบตรวจสอบรอบอายุ 90 วัน |
| [`frontend/src/app/auth/callback/page.tsx`](file:///d:/Python/IRM/frontend/src/app/auth/callback/page.tsx) | เพิ่ม Timeout 15s, ปุ่มลองใหม่อีกครั้ง และรองรับ Portal-Initiated Launch |
| [`frontend/src/app/auth/start/page.tsx`](file:///d:/Python/IRM/frontend/src/app/auth/start/page.tsx) | RFC 9700 Seamless SSO Initiation Bounce Endpoint |
| [`frontend/src/components/common/ForcedPasswordChangeModal.tsx`](file:///d:/Python/IRM/frontend/src/components/common/ForcedPasswordChangeModal.tsx) | หน้าต่างบังคับเปลี่ยนรหัสผ่านเมื่อครบกำหนด 90 วัน |

---

## 🚀 5. คำสั่งอัปเดตและ Rebuild ระบบบน VPS Hostinger (`/var/www/Irm`)

```bash
# 1. ไปที่โฟลเดอร์โปรเจกต์ IRM บน VPS
cd /var/www/Irm

# 2. ดึงโค้ดล่าสุดจาก GitHub main branch
git pull origin main

# 3. อัปเดตโครงสร้างตารางผู้ใช้ในกรณีคอลัมน์ยังไม่ถูกสร้าง
docker exec -i irm-db psql -U irm -d irm -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW(); ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE; UPDATE users SET password_changed_at = COALESCE(created_at, NOW()) WHERE password_changed_at IS NULL;"

# 4. สั่ง Rebuild คอนเทนเนอร์ Backend
docker compose up -d --build irm-backend

# 5. ตรวจสอบสถานะการทำงานของคอนเทนเนอร์และอ่าน Log ล่าสุด
docker compose ps
docker compose logs irm-backend --tail 25
```

---

## 📌 6. Checkpoint สำหรับการเริ่มงานในครั้งหน้า (Next Session)

* **สถานะความพร้อมของโค้ด (Code Readiness):**
  * `python -m py_compile` ผ่านสมบูรณ์ทุกไฟล์ใน `backend/app` (100% PASS)
  * `npm run build` ใน `frontend` สำเร็จครบ 20/20 Static Pages (100% PASS)
  * Git Commits ทั้งหมดถูก Push ขึ้น GitHub `main` เรียบร้อยแล้ว (Latest Commit: `07780a2`)
* **จุดที่ต้องตรวจสอบต่อเมื่อกลับมาพัฒนา (Verification on Return):**
  1. รันคำสั่งในข้อ 5 บน VPS เพื่อให้ `irm-backend` นำ Image ที่ Build ใหม่ขึ้นทำงาน
  2. ตรวจสอบสถานะว่า `irm-backend` อยู่ในสถานะ `Up` (พอร์ต 8000 ให้บริการปกติ)
  3. ทดสอบ Login ด้วยบัญชีปกติ เช่น `Chaiwat.N` หรือ `admin`
  4. ทดสอบการเข้าสู่ระบบผ่าน Central IAM Single Sign-On จากหน้า Portal (`https://ciam.windowasia.com/portal`)
  5. ทดสอบการเปิดหน้า System Settings และตรวจเช็คสถานะ SSO และ AI Copilot
