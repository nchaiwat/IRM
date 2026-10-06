# 📌 IRM System — HANDOFF & PROGRESS LOG

> **วันที่บันทึก:** 6 ตุลาคม 2026 (11:10 น.)  
> **สถานะโครงการ:** Production-Ready, Performance-Optimized & Feature Complete (`https://irm.windowasia.com`)  
> **Repository:** `https://github.com/nchaiwat/IRM` (Branch: `main`)  
> **VPS Hostinger Path:** `/var/www/Irm`  

---

## 🎯 1. ภาพรวมระบบ (System Overview)

ระบบ **IRM (Incoming Raw Material Management System)** ของบริษัท วินโดว์ เอเชีย จำกัด (มหาชน) ทำหน้าที่เชื่อมโยงข้อมูล PO วัตถุดิบ 7 กลุ่มหลักจาก **SAP Business One** ส่งต่อให้ Supplier ระบุวันส่งมอบผ่าน **Cryptographic Portal**, วางแผนนัดหมายลง **ปฏิทินส่งของ (Calendar)**, พิมพ์ใบตรวจรับสินค้าจริง (**Receiving Checklist**), แจ้งเตือนยอดวัตถุดิบเข้าประจำวันรายบุคคลผ่าน **Telegram Direct Message (DM)**, ส่งอีเมลสรุปงานและไฟล์แนบ Excel 2 Sheet ให้ทีมจัดซื้อ (**PU Reminder Email**), ส่งต่อข้อมูลให้ระบบ **QMS**, และรองรับการยืนยันตัวตนระดับองค์กรผ่าน **Central IAM (OAuth2 / OIDC SSO)** พร้อมทั้งการสำรองฉุกเฉินด้วย **Break-Glass Mode**

---

## 🏗️ 2. สรุปความคืบหน้าและการพัฒนางานล่าสุด (6 ตุลาคม 2026)

### 1) 🚀 ระบบเชื่อมต่อ Telegram อัตโนมัติด้วย Deep Linking & Webhook Sync (Zero Manual Input)
* **โจทย์ความต้องการ:** ตัดขั้นตอนที่พนักงานต้องไปค้นหาตัวเลข Chat ID ส่งให้ Admin กรอก โดยต้องการวิธีที่ High-Tech และ Automate ที่สุด พนักงานเพียงสแกน QR Code แล้วกดปุ่ม START ใน Telegram ระบบจะดึง Chat ID และผูกบัญชีให้อัตโนมัติทันที
* **การพัฒนา Backend:**
  * **Database Model ([`telegram_bind_token.py`](file:///d:/Python/IRM/backend/app/models/telegram_bind_token.py)):** สร้างตาราง `telegram_bind_tokens` สำหรับจัดเก็บ Token ผูกบัญชีแบบ One-Time (อายุ 15 นาที) พร้อม Cascade Foreign Key ไปยังตาราง `users`
  * **Telegram Router ([`telegram.py`](file:///d:/Python/IRM/backend/app/routers/telegram.py)):**
    * `POST /api/telegram/webhook`: รับ Webhook จาก Telegram Server เมื่อผู้ใช้กด `/start bind_<token>` บอทจะดึง `chat_id` มาอัปเดตลง `user.telegram_chat_id` ให้อัตโนมัติ พร้อมส่งข้อความตอบกลับต้อนรับยืนยันใน Telegram ทันที
    * `POST /api/telegram/register-webhook`: สั่ง `setWebhook` ไปยัง `https://irm.windowasia.com/api/telegram/webhook` อัตโนมัติ
    * `GET /api/telegram/webhook-info`: ดึงสถานะสุขภาพของ Webhook จาก Telegram API
  * **User Router ([`users.py`](file:///d:/Python/IRM/backend/app/routers/users.py)):**
    * `POST /api/users/me/telegram-bind-token`: สร้าง Deep Link URL (`https://t.me/PRORGBOT?start=bind_xxx`) สำหรับผู้ใช้ปัจจุบัน
    * `POST /api/users/{user_id}/telegram-bind-token`: สร้าง Deep Link สำหรับ Admin จัดการให้พนักงาน
    * `GET /api/users/telegram-bind-status`: ตรวจสอบสถานะการเชื่อมต่อแบบ Real-time Polling
* **การพัฒนา Frontend:**
  * **Dynamic QR Component ([`TelegramSyncModal.tsx`](file:///d:/Python/IRM/frontend/src/components/common/TelegramSyncModal.tsx)):** ป๊อปอัปสร้าง QR Code สดด้วยไลบรารี `qrcode` แสดงแถบ Countdown 15 นาที, ปุ่ม `เปิดแอป Telegram ทันที`, ปุ่ม `คัดลอกลิงก์`, และไฟกระพริบรอตรวจจับสถานะ เมื่อพนักงานกด Start ใน Telegram หน้าจอจะเปลี่ยนเป็นสีเขียวแจ้งเตือนความสำเร็จแบบ Real-time
  * **Header Button ([`Header.tsx`](file:///d:/Python/IRM/frontend/src/components/layout/Header.tsx)):** เพิ่มปุ่ม `[ 📱 เชื่อมต่อ Telegram ]` ที่มุมขวาบนข้างชื่อผู้ใช้ (หากเชื่อมต่อแล้วจะแสดงสถานะ `[ 🟢 Telegram ]`)
  * **Admin User Actions ([`admin/users/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/users/page.tsx)):** เพิ่มปุ่มไอคอน `QrCode` ในตารางพนักงาน ให้ Admin สามารถเปิด QR หรือคัดลอกลิงก์ส่งให้พนักงานใน LINE ได้ทันที
  * **Admin Settings Webhook Sub-Card ([`admin/settings/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/settings/page.tsx)):** เพิ่มช่องตั้งค่า `telegram_bot_username` และการ์ดควบคุม Webhook พร้อมปุ่ม `[ ลงทะเบียน Webhook อัตโนมัติ ]`

### 2) 🛡️ ปรับปรุง UX สถานะ Telegram: แสดงหน้าต่างพร้อมใช้งานทันที (Connected View) & ปุ่มทดสอบส่งข้อความ (Test Ping)
* **ปัญหาเดิม:** เมื่อพนักงานที่เชื่อมต่อ Telegram สำเร็จแล้ว (มี Chat ID แล้วและแถบเป็นสีเขียว `[ 🟢 Telegram ]`) คลิกเข้าไปดู ระบบกลับสร้าง QR Code ใหม่และขึ้นว่า *"กำลังรอการกด START จาก Telegram..."* ทำให้เกิดความเข้าใจผิดว่ายังใช้งานไม่ได้
* **การแก้ไข:**
  * **สองโหมดการแสดงผลอัตโนมัติ (Two-Mode Smart Modal in [`TelegramSyncModal.tsx`](file:///d:/Python/IRM/frontend/src/components/common/TelegramSyncModal.tsx)):**
    1. **กรณีเชื่อมต่อแล้ว (Connected View):** แสดงหน้าต่างสีเขียวชอุ่มทันที:
       * หัวข้อ: *"Telegram ของคุณพร้อมใช้งานเรียบร้อยแล้ว"*
       * แสดง Chat ID, สถานะพร้อมรับยอดวัตถุดิบรายบุคคล (07:30 น.), และชื่อบอท `@PRORGBOT`
       * ปุ่ม **`[ ⚡ ทดสอบส่งข้อความหาฉัน (Test Message) ]`**: ยิงข้อความทดสอบจริงไปยัง Telegram เพื่อตรวจสอบความพร้อมและยืนยันว่าไม่ได้เผลอบล็อกบอท
       * ปุ่ม **`[ 🔄 เปลี่ยนบัญชี Telegram หรือสแกน QR Code ใหม่ ]`**: สำหรับกรณีที่ผู้ใช้ต้องการเปลี่ยนไปใช้อุปกรณ์หรือบัญชี Telegram อื่น
    2. **กรณีผู้ใช้ใหม่ (QR Sync View):** แสดง QR Code และรอจับคู่แบบอัตโนมัติเช่นเดิม
  * **Backend ([`backend/app/routers/users.py`](file:///d:/Python/IRM/backend/app/routers/users.py)):**
    * เพิ่ม endpoint `POST /api/users/me/test-telegram` ให้ผู้ใช้งานทั่วไปสามารถทดสอบส่งข้อความยืนยันการเชื่อมต่อของตนเองได้ทันที (ไม่จำกัดเฉพาะสิทธิ์ Admin)

---

## 🏗️ 3. สรุปความคืบหน้าการพัฒนาก่อนหน้า (5 ตุลาคม 2026)

### 1) 🤖 ปรับปรุงระบบวินิจฉัยและแจ้งเตือนข้อผิดพลาด Telegram Bot API ให้เข้าใจปัญหาที่แท้จริง
* **ปัญหาเดิม:** เมื่อการส่ง Telegram DM ล้มเหลวด้วย `400 Bad Request: chat not found` ระบบแจ้งเตือนว่า *"ไม่พบ Chat ID ในระบบ Telegram (กรุณาตรวจสอบ Chat ID ให้ถูกต้อง)"* ทำให้ผู้ดูแลระบบเข้าใจผิดว่าตัวเลข ID ผิด ทั้งที่จริงแล้วเป็น ID ที่ใช้งานกับ App อื่นของบริษัทได้อยู่แล้ว แต่เกิดจากกฎความปลอดภัยของ Telegram ที่ผู้ใช้ยังไม่เคยกด `/start` กับบอทตัวของ IRM
* **การแก้ไขใน Backend ([`backend/app/services/telegram_service.py`](file:///d:/Python/IRM/backend/app/services/telegram_service.py)):**
  * ปรับข้อความ Humanized Error สำหรับกรณี `chat not found` หรือ `bot can't initiate conversation`:
    * กรณี User DM (Chat ID เป็นบวก): ระบุสาเหตุที่แท้จริงอย่างชัดเจนว่า *"ไม่พบการสนทนากับ Chat ID ... (สาเหตุหลัก: ผู้รับยังไม่เคยกดเริ่มคุย (/start) กับบอทตัวนี้ของ IRM ใน Telegram หรือหากใช้ Chat ID เดียวกับระบบอื่น ให้ตรวจสอบว่า Bot Token ตรงกับบอทตัวที่เคยเริ่มคุยหรือไม่)"*
    * กรณี Group Chat (Chat ID ติดลบ): ตรวจสอบการเชิญบอทเข้ากลุ่ม
    * กรณี User บล็อกบอท (`bot was blocked by user`): แจ้งให้ผู้ใช้ Unblock บอท
  * ปรับแยกระบุ `action="telegram_broadcast"` และ `action="telegram_dm"` ให้ตรงตามลักษณะ Chat ID อัตโนมัติ
* **การแก้ไขใน Backend Endpoints ([`backend/app/routers/users.py`](file:///d:/Python/IRM/backend/app/routers/users.py), [`backend/app/routers/settings.py`](file:///d:/Python/IRM/backend/app/routers/settings.py)):**
  * ปรับปรุง endpoint `POST /api/users/{user_id}/test-telegram` และ `POST /api/settings/test-telegram-group` ให้เรียกใช้ `send_telegram_message_detailed` จาก Service กลาง เพื่อให้ข้อความ Error ในหน้าจอ Alert และ Audit Logs มีคำอธิบายตรงกันและครอบคลุม
* **การแก้ไขใน Frontend ([`frontend/src/app/(dashboard)/admin/users/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/users/page.tsx)):**
  * เพิ่มข้อความกำกับใต้ช่อง Telegram Chat ID ทั้งใน Create Modal และ Edit Modal: `* ผู้รับต้องเคยค้นหาบอท IRM ใน Telegram แล้วกดปุ่ม /start ก่อน 1 ครั้ง บอทจึงจะมีสิทธิ์ส่ง DM ได้` เพื่อป้องกันความสับสนตั้งแต่ขั้นตอนบันทึกข้อมูลพนักงาน

---

## 🏗️ 3. สรุปความคืบหน้าการพัฒนาก่อนหน้า (2 ตุลาคม 2026)

### 1) 🚪 แก้ไขการ Logout & Session Expiration ให้กลับมาหน้า Login ของ IRM เสมอ
* **ปัญหาเดิม:** การล็อกอินผ่านหน้า Login ของ IRM เองโดยตรง (Direct/Local Login) เมื่อกด Logout หรือเมื่อ Token หมดอายุ (HTTP 401) ระบบจะ Redirect ผู้ใช้กระโดดไปยังหน้า Central IAM Portal (`https://ciam.windowasia.com/portal`) แทนที่จะกลับมาหน้า Login ของ IRM
* **Root Cause:** ใน [`frontend/src/lib/auth-context.tsx`](file:///d:/Python/IRM/frontend/src/lib/auth-context.tsx) และ [`frontend/src/lib/api.ts`](file:///d:/Python/IRM/frontend/src/lib/api.ts) เขียนเงื่อนไขผิดพลาดว่าถ้า `authProvider === 'local'` ให้ไป `/login` แต่นอกเหนือจากนั้นทั้งหมด (`else`) ให้เด้งไป CIAM Portal ส่งผลให้เมื่อค่า `authProvider` เป็น `null` (เปิดแท็บใหม่ หรือ Token ค้าง) จะถูกเตะไปหน้า CIAM ทันที
* **การแก้ไข:**
  * ปรับ Logic ให้ Invert Safeguard: **จะ Redirect ไป CIAM Portal เฉพาะเมื่อ `authProvider === 'sso'` เท่านั้น**
  * นอกเหนือจากนั้นทั้งหมด (Local, ค้นไม่พบ, หรือ SSO ถูกปิด) ให้ Redirect กลับมาที่ `/login` ของ IRM เสมอ 100%
  * ใน `auth-context.tsx` และ `login/page.tsx`: ตรวจสอบสถานะ SSO หาก SSO ปิดอยู่ จะสั่งลบ `irm_ciam_portal_url` ออกจาก Browser Storage ทันที

### 2) 🏢 ปลดล็อกการเข้าสู่ระบบด้วย Active Directory (AD) จากหน้า Login พร้อมระบบ Auto-Provisioning & Fallback
* **ปัญหาเดิม:** เมื่อผู้ใช้เข้าสู่ระบบจากหน้า Login ด้วย Username และ Password ของ Active Directory:
  * หากพนักงานยังไม่มีชื่อในตาราง `users` ของ IRM ระบบจะ Reject ทันที (ไม่มีระบบ Auto-provision บัญชีใหม่)
  * หาก Admin ลืมติ๊ก Checkbox `use_ad_auth` ใน User Management ระบบจะตรวจเทียบเฉพาะ Local Password เท่านั้น ทำให้พนักงานล็อกอินด้วยรหัส AD ไม่ได้
* **การแก้ไขใน Backend ([`backend/app/routers/auth.py`](file:///d:/Python/IRM/backend/app/routers/auth.py)):**
  * **AD Auto-Provisioning:** หากไม่พบบัญชีใน IRM แต่มีการเปิดใช้งาน AD Gateway ไว้ ระบบจะส่งคำขอไปตรวจสอบกับ AD Gateway ทันที หากรหัสผ่านถูกต้อง ระบบจะสร้างบัญชีผู้ใช้ใหม่ใน IRM ให้อัตโนมัติ (`PU User`, `use_ad_auth=True`, `is_active=True`)
  * **AD Fallback Verification:** หากพนักงานมีชื่อใน IRM แต่รหัสผ่าน Local ไม่ตรง ระบบจะตรวจสอบไปยัง AD Gateway สำรองให้ทันที หากยืนยันตัวตนสำเร็จ ระบบจะอัปเดตสถานะเป็น `use_ad_auth = True` ให้อัตโนมัติ
  * **Case-Insensitive Match:** ค้นหาชื่อผู้ใช้ด้วย `func.lower(User.username) == username_clean.lower()` เพื่อรองรับรูปแบบตัวพิมพ์เล็ก-ใหญ่ของ AD
* **การแก้ไขใน Frontend ([`frontend/src/app/login/page.tsx`](file:///d:/Python/IRM/frontend/src/app/login/page.tsx)):**
  * ปรับข้อความปุ่มและฟอร์มจาก *"เข้าสู่ระบบด้วยบัญชี Local (กรณีฉุกเฉิน)"* ให้เป็น **"เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน (AD / Local Account)"** เพื่อความเข้าใจที่ถูกต้องของผู้ใช้งาน

### 3) 🛡️ แก้ไขปัญหาสวิตช์ Disable SSO เปลี่ยนกลับเอง และแยกตัวออกจาก CIAM อย่างเด็ดขาด
* **ปัญหาเดิม:** เมื่อ Admin ปิดการใช้งาน SSO ในหน้า Admin Settings แล้วกดบันทึก เมื่อรีเฟรชหรือกลับมาที่หน้า Login พบว่าปุ่ม SSO ยังแสดงอยู่ และสวิตช์ใน Admin Settings เด้งกลับมาเปิดเอง
* **Root Cause:**
  1. ใน [`admin/settings/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/settings/page.tsx) มี State 2 ตัว (`settings` และ `ciamSettings`) เมื่อเลื่อนสวิตช์ปิด SSO ตัว State `settings` หลักไม่ได้ถูกอัปเดตตาม และเมื่อกดปุ่ม "บันทึกการตั้งค่า" หลักที่ด้านล่างสุด โค้ดส่งค่า `ciam_sso_enabled: "true"` เดิมไปทับค่าในฐานข้อมูล
  2. `bulk_update_settings` ใน Backend ไม่ได้เรียก `invalidate_ciam_cache()` ทำให้ In-memory cache ยังคงจำค่าเก่า
  3. ฟังก์ชัน `break_glass_toggle` ใน `sso.py` เดิมมีคำสั่งบังคับเขียน `ciam_sso_enabled = true` เมื่อปิด Break-Glass
* **การแก้ไข:**
  * **Frontend ([`admin/settings/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/settings/page.tsx)):**
    * กรองคีย์ `ciam_*` ออกจาก Payload ของปุ่ม `handleSave` หลัก เพื่อไม่ให้การกดบันทึกการตั้งค่าทั่วไปมารบกวนหรือทับการตั้งค่าของ CIAM SSO
    * ซิงค์ค่า `ciam_sso_enabled` และ `ciam_break_glass_active` ระหว่าง State ทั้งสองตัวตลอดเวลาทั้งตอนโหลด, ตอนสลับสวิตช์, และตอนกดบันทึก
  * **Backend ([`backend/app/routers/settings.py`](file:///d:/Python/IRM/backend/app/routers/settings.py), [`backend/app/routers/sso.py`](file:///d:/Python/IRM/backend/app/routers/sso.py)):**
    * เรียก `invalidate_ciam_cache()` ทันทีหลังการบันทึกการตั้งค่าทุกครั้ง
    * ตัดคำสั่งที่ฮาร์ดโค้ดบังคับเปิด SSO ใน `break_glass_toggle` ออก ทำให้เมื่อปิดโหมดฉุกเฉิน ค่าสถานะ SSO ที่ Admin ตั้งใจปิดไว้จะไม่ถูกทับกลับเป็นเปิดอีกต่อไป
  * **Frontend Login ([`frontend/src/app/login/page.tsx`](file:///d:/Python/IRM/frontend/src/app/login/page.tsx)):**
    * เมื่อ `sso_enabled == false`: แสดงแบบฟอร์มล็อกอินปกติ (Username & Password) ทันที 100% โดยซ่อนปุ่ม SSO, ซ่อนข้อความเตือน, และซ่อนปุ่มสลับโหมดใดๆ ทั้งสิ้น แยกตัวออกจาก CIAM อย่างเป็นทางการและสมบูรณ์

---

## 🏗️ 3. สรุปความคืบหน้าการพัฒนาก่อนหน้า (1 ตุลาคม 2026)

### 1) 🔐 มาตรฐาน Step 0 Guard สำหรับ Central IAM SSO Callback (Commit `704b646`)
* **ปัญหาเดิม:** เมื่อผู้ดูแลระบบปิดการใช้งาน SSO ในหน้าตั้งค่า IRM (`ciam_sso_enabled = false` หรือเปิด Break-Glass) หน้าจอ Login ตรงของ IRM จะซ่อนปุ่ม SSO ถูกต้อง แต่หากพนักงานคลิกปุ่มเปิดระบบ IRM มาจากหน้า Central-IAM Portal ตัว endpoint `/api/auth/sso/callback` ของ IRM ยังคงยอมรับ authorization code และทำ login สำเร็จ เนื่องจากขาดการตรวจสอบสถานะ SSO ภายใน callback
* **การแก้ไขใน Backend ([`backend/app/routers/sso.py`](file:///d:/Python/IRM/backend/app/routers/sso.py)):**
  * เพิ่ม **Step 0 Guard** ที่จุดเริ่มต้นของฟังก์ชัน `handle_sso_callback`
  * ตรวจสอบเงื่อนไข: หาก `not sso_settings.ciam_sso_enabled` หรือ `sso_settings.ciam_break_glass_active`
  * ปฏิเสธการเข้าสู่ระบบทันทีด้วย `HTTP 503 Service Unavailable`: *"Single Sign-On (Central IAM) ถูกปิดใช้งานหรืออยู่ในโหมดฉุกเฉิน (Break-Glass) กรุณาเข้าสู่ระบบด้วยบัญชี Local ของ IRM"*
  * บันทึก Transaction Audit Log หมวดหมู่ `ciam_sso` (Action: `sso_callback_rejected_inactive`)

### 2) 🔄 ระบบ Auto-Refresh ทันทีหลังอัปเดตข้อมูล Supplier Master & Item Master (Commit `704b646`)
* **ปัญหาเดิม:** เมื่อผู้ใช้งานแก้ไขข้อมูล Supplier Master หรือ Item Master แล้วกดบันทึก หน้าจอไม่รีเฟรชค่าใหม่ทันที ต้องกด F5 / Hard Reload
* **การแก้ไขใน Frontend ([`frontend/src/app/(dashboard)/suppliers/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/suppliers/page.tsx), [`frontend/src/app/(dashboard)/items/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/items/page.tsx)):**
  * **Optimistic Local State Update:** นำ object ผลลัพธ์ `res.data` ที่ได้จาก Backend มา Map อัปเดตลง State `suppliers` และ `items` ทันทีหลังการบันทึกสำเร็จ ทำให้หน้าจอสะท้อนข้อมูลใหม่ทันทีในระดับ Millisecond
  * **Anti-Cache Guard:** ปรับปรุงฟังก์ชัน `fetchSuppliers()` และ `fetchItems()` ให้ส่ง `{ params: { _t: Date.now() }, headers: { 'Cache-Control': 'no-cache' } }` เพื่อป้องกันปัญหา Browser HTTP 304 / Memory Caching อย่างเด็ดขาด

### 3) ✉️ ปลดล็อกการลบ Email, Phone, และ Contact ใน Supplier Master ให้เป็นค่าว่าง (Commit `754323e`)
* **ปัญหาเดิม:** เมื่อผู้ใช้ต้องการลบอีเมลที่ไม่ถูกต้องของ Supplier ออกให้เป็นค่าว่าง (Blank) ระบบกลับไม่ยอมเซฟค่าว่าง และยังคงแสดงอีเมลเดิมค้างอยู่
* **Root Cause:** ใน FastAPI Endpoint `update_supplier` เดิมเขียนตรวจสอบเงื่อนไข `if data.email is not None:` ทำให้เมื่อฝั่ง Frontend ส่ง `email: null` เข้ามา Python จะข้ามการอัปเดตฟิลด์ดังกล่าวไป
* **การแก้ไขใน Backend ([`backend/app/routers/suppliers.py`](file:///d:/Python/IRM/backend/app/routers/suppliers.py)):**
  * ปรับมาใช้ `update_data = data.model_dump(exclude_unset=True)` ตรวจสอบว่ามีคีย์ `email`, `phone`, `contact_person` ถูกส่งมาหรือไม่
  * หากถูกส่งมา (แม้จะเป็น `None` หรือ `""`) ระบบจะทำความสะอาดสตริงและบันทึกลงฐานข้อมูลเป็น `None` (`NULL` ใน PostgreSQL) ทันที
  * หน้าตารางจะแสดงสถานะ `ยังไม่มี Email` อย่างถูกต้องตามที่ผู้ใช้ต้องการ

### 4) ⚡ ระบบ Realtime Auto-Refresh & Global Anti-Cache ทุกหน้าจอ
* **ปัญหาเดิม:** เมื่อผู้ใช้คลิกสลับหน้าไป-มา เช่น จาก Dashboard ไปหน้าอื่นแล้วกลับมา หรือ Supplier เพิ่งกดยืนยันวันส่งมอบ ข้อมูลไม่เปลี่ยนทันที ต้องกดปุ่ม Refresh บนเบราว์เซอร์
* **การแก้ไข:**
  * **Backend ([`backend/app/main.py`](file:///d:/Python/IRM/backend/app/main.py)):** ติดตั้ง HTTP Anti-Cache Middleware ให้ทุก endpoint `/api/*` ส่ง Response Headers `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` และ `Pragma: no-cache`
  * **Axios Interceptor ([`frontend/src/lib/api.ts`](file:///d:/Python/IRM/frontend/src/lib/api.ts)):** บังคับให้ทุกคำขอ `GET` แนบพารามิเตอร์ Cache-Buster `_t: Date.now()` และ Headers ห้ามแคชอัตโนมัติแบบครอบคลุมทั้งระบบ
  * **Next.js Router Cache ([`frontend/next.config.js`](file:///d:/Python/IRM/frontend/next.config.js)):** กำหนด `experimental.staleTimes: { dynamic: 0, static: 0 }` และตั้ง `prefetch={false}` บนทุกลิงก์ใน Sidebar ([`Sidebar.tsx`](file:///d:/Python/IRM/frontend/src/components/layout/Sidebar.tsx)) เพื่อให้ดึงข้อมูลสดทุกครั้งที่คลิกเปลี่ยนหน้า
  * **Window Focus & Silent Background Polling:** เพิ่มตัวจับสัญญาณ `window.focus` และ `visibilitychange` พร้อม Silent Background Polling ทุก 30 วินาทีใน Dashboard ([`dashboard/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/dashboard/page.tsx)), Operation ([`operation/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/operation/page.tsx)), และ Calendar ([`calendar/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/calendar/page.tsx)) โดยมี Safeguard ข้ามการรีเฟรชหากผู้ใช้กำลังเปิด Modal แก้ไขข้อมูลอยู่

---

## 🏗️ 3. สรุปความคืบหน้าการพัฒนาก่อนหน้า (27 กันยายน 2026)

### 1) 👤 แก้ไข User ID (Username) ให้ปรับตรงกับ Active Directory (AD) ได้
* **ความเป็นมา:** เดิมในหน้า User Management ไม่มีช่องแก้ไข Username ทำให้เมื่อจำเป็นต้องปรับเปลี่ยน User ID ให้สอดคล้องกับบัญชี AD ขององค์กร ผู้ดูแลระบบไม่สามารถปรับได้โดยตรงจากหน้าจอ
* **การพัฒนา Backend ([`backend/app/schemas/user.py`](file:///d:/Python/IRM/backend/app/schemas/user.py), [`backend/app/routers/users.py`](file:///d:/Python/IRM/backend/app/routers/users.py)):**
  * เพิ่ม `username: str | None = None` ใน `UserUpdate` Schema
  * ใน `PUT /api/users/{user_id}`:
    * ตรวจสอบความถูกต้องและไม่เป็นสตริงว่าง
    * ตรวจสอบความซ้ำซ้อนกับผู้ใช้อื่นในฐานข้อมูล (`select(User).where(User.username == new_username, User.id != user_id)`)
    * ป้องกันการเปลี่ยนชื่อของ root `admin`
    * บันทึก Transaction Audit Log หมวดหมู่ `user_management` (Action: `update_username`) บันทึก User ID เดิมและใหม่
* **การพัฒนา Frontend ([`frontend/src/app/(dashboard)/admin/users/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/users/page.tsx)):**
  * เพิ่มช่องกรอก **"User ID / Username"** ใน Edit Modal เป็นช่องแรก
  * กำกับข้อความช่วยเหลือ *"ปรับให้ตรงกับ Active Directory (AD) ได้"*
  * ปิดการแก้ไข (Disabled) อัตโนมัติหากผู้ใช้งานเป้าหมายคือ `admin` เพื่อความปลอดภัย

### 2) 🗑️ เพิ่มฟังก์ชันลบบัญชีผู้ใช้งานที่ไม่ใช้งานแล้ว (Delete User Account) พร้อมระบบความปลอดภัย
* **ความเป็นมา:** เดิมระบบรองรับเฉพาะการกด "ปิดใช้งาน" (Deactivate) แต่ยังไม่มีปุ่มสำหรับลบบัญชีที่ไม่ใช้งานแล้วหรือบัญชีทดสอบออกจากฐานข้อมูล
* **การพัฒนา Backend ([`backend/app/routers/users.py`](file:///d:/Python/IRM/backend/app/routers/users.py)):**
  * สร้าง Endpoint `DELETE /api/users/{user_id}` ควบคุมสิทธิ์ด้วย `require_permission("/admin/users", "delete")`
  * **กลไกความปลอดภัย (Safety Safeguards):**
    * ป้องกันไม่ให้ผู้ใช้ลบบัญชีของตนเองที่กำลังล็อกอินอยู่ (`user.id == current_user.id`)
    * ป้องกันไม่ให้ลบบัญชีผู้ดูแลระบบหลัก (`admin`)
  * ลบข้อมูลออกจากฐานข้อมูลอย่างสมบูรณ์ (`await db.delete(user)`)
  * บันทึก Transaction Audit Log หมวดหมู่ `user_management` (Action: `delete_user`) พร้อมข้อมูลชื่อผู้ใช้งานและผู้สั่งลบ
* **การพัฒนา Frontend ([`frontend/src/app/(dashboard)/admin/users/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/users/page.tsx)):**
  * เพิ่มปุ่มไอคอนถังขยะ (`Trash2`) ในคอลัมน์ "การจัดการ" (Actions) ด้านขวาสุดของตาราง
  * ปุ่มจะ Disable อัตโนมัติและแสดง Tooltip เตือนหากเป็นบัญชี `admin` หรือบัญชีของตนเอง
  * เพิ่ม **Modal ยืนยันการลบ (Delete Confirmation Modal)** โทนสะอาด ปลอดภัย แสดงรายละเอียดบัญชี (User ID, ชื่อ-นามสกุล, แผนก, อีเมล) อย่างชัดเจนก่อนกดยืนยัน

### 3) 📄 จัดทำเอกสารข้อกำหนดระบบที่เป็นทางการ ([`PRD.md`](file:///d:/Python/IRM/PRD.md))
* รวบรวมและจัดหมวดหมู่ข้อกำหนด สถาปัตยกรรม 5 คอนเทนเนอร์, กฎความปลอดภัย, ลำดับเมนูที่เป็นทางการ 9 หน้า, กฎ Pure Date Standard, กลไก Append-Only Masters, ตารางเวลาอัตโนมัติ และข้อตกลงการเชื่อมโยงระบบ SAP B1 / Central IAM / QMS ไว้ในเอกสาร [`PRD.md`](file:///d:/Python/IRM/PRD.md) อย่างสมบูรณ์

---

## 🏗️ 3. สรุปความคืบหน้าการพัฒนาก่อนหน้า (18–26 กันยายน 2026)

### 1) 🔐 ระบบ Central IAM SSO & Duplicate Token Prevention
* แก้ไขการแลกเปลี่ยน SSO Token โดยใช้ `executedRef` เพื่อป้องกันการเกิด Duplicate Token Exchange ใน React Strict Mode
* ปรับปรุงฟังก์ชัน `create_access_token` และ `create_refresh_token` ให้รองรับ Data Payload ได้ยืดหยุ่น

### 2) ✉️ ปรับปรุงระบบอีเมลสรุปงานจัดซื้อ (PU Reminder) & ปุ่มส่งทันที (Manual)
* เพิ่มปุ่ม **`[ ⚡ ส่งทันที (Manual) ]`** ใน System Settings Section 2
* ปรับปรุง `email_service.py` ให้ใช้ Isolated Session (`AsyncSessionLocal()`) ในการบันทึก Audit Log ทุกสถานะ (`SUCCESS`, `WARNING`, `FAILED`) ป้องกันการโดน Rollback จาก FastAPI Dependency

### 3) 🧹 ระบบ Log Retention Policy (15 วัน) & Auto Purge
* เพิ่ม Card กำหนดระยะเวลาจัดเก็บ Log ย้อนหลัง (Default 15 วัน) ใน System Settings Section 4
* เพิ่ม Background Job ใน `scheduler.py` เวลา 00:30 น. สั่งลบแถว `transaction_logs` ที่เก่ากว่ากำหนดอัตโนมัติ

### 4) ⚡ เพิ่มประสิทธิภาพฐานข้อมูล (PostgreSQL Performance Indexes)
* สร้าง 13 ดัชนี (Indexes) บน `po_items`, `sub_items`, `po_headers`, `po_item_audit_logs`, `users`
* เปลี่ยน Relationship จาก `lazy="selectin"` เป็น `lazy="select"` เพื่อตัด Cascade Queries ซ้ำซ้อน

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

| [`backend/app/routers/auth.py`](file:///d:/Python/IRM/backend/app/routers/auth.py) | Direct Login รองรับ AD Auto-Provisioning บัญชีใหม่อัตโนมัติ, AD Fallback เมื่อรหัส Local ไม่ตรง, และ Case-Insensitive Username match |
| [`backend/app/routers/sso.py`](file:///d:/Python/IRM/backend/app/routers/sso.py) | ตัดการฮาร์ดโค้ด override `ciam_sso_enabled = true` ใน `break_glass_toggle` ป้องกันการทับสวิตช์ SSO ของ Admin |
| [`backend/app/routers/settings.py`](file:///d:/Python/IRM/backend/app/routers/settings.py) | เพิ่ม `invalidate_ciam_cache()` ใน `bulk_update_settings` ล้าง In-memory cache ทันทีหลังบันทึก |
| [`frontend/src/lib/auth-context.tsx`](file:///d:/Python/IRM/frontend/src/lib/auth-context.tsx) | Invert Safeguard ใน `logout` เด้งไป CIAM Portal เฉพาะเมื่อ `authProvider === 'sso'` เท่านั้น นอกนั้นกลับไป `/login` ของ IRM เสมอ |
| [`frontend/src/lib/api.ts`](file:///d:/Python/IRM/frontend/src/lib/api.ts) | ปรับ 401 Response Interceptor ให้ส่งกลับ `/login` ของ IRM เสมอยกเว้นกรณี SSO session |
| [`frontend/src/app/(dashboard)/admin/settings/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/settings/page.tsx) | กรองคีย์ `ciam_*` ออกจาก `handleSave` และซิงค์ State สวิตช์ SSO ไม่ให้เด้งกลับเปิดเอง |
| [`frontend/src/app/login/page.tsx`](file:///d:/Python/IRM/frontend/src/app/login/page.tsx) | Decoupled Clean Login UI เมื่อปิด SSO ซ่อนปุ่ม SSO และการอ้างถึง CIAM พร้อมปรับข้อความปุ่มรองรับ AD/Local |
| [`backend/app/main.py`](file:///d:/Python/IRM/backend/app/main.py) | เพิ่ม HTTP Anti-Cache Response Headers Middleware สำหรับทุก `/api/*` endpoint |
| [`frontend/next.config.js`](file:///d:/Python/IRM/frontend/next.config.js) | กำหนด `experimental.staleTimes: { dynamic: 0, static: 0 }` ป้องกัน Next.js Router Cache จำหน้าจอเก่า |
| [`frontend/src/components/layout/Sidebar.tsx`](file:///d:/Python/IRM/frontend/src/components/layout/Sidebar.tsx) | เพิ่ม `prefetch={false}` ในทุกลิงก์เมนู ป้องกัน Client Router Cache เกาะข้อมูลเก่า |
| [`frontend/src/app/(dashboard)/dashboard/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/dashboard/page.tsx) | เพิ่ม Window Focus Revalidation และ 30s Background Silent Polling อัปเดตทันทีเมื่อกลับเข้าหน้าเว็บ |
| [`frontend/src/app/(dashboard)/operation/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/operation/page.tsx) | เพิ่ม Window Focus Revalidation และ 30s Background Silent Polling พร้อม Modal Editing Safeguard |
| [`frontend/src/app/(dashboard)/calendar/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/calendar/page.tsx) | เพิ่ม Window Focus Revalidation และ Silent Refresh ซิงค์วันส่งมอบทันทีเมื่อสลับแท็บ |
| [`backend/app/routers/suppliers.py`](file:///d:/Python/IRM/backend/app/routers/suppliers.py) | รองรับการล้างอีเมล/เบอร์โทรให้เป็น Blank/NULL (`model_dump(exclude_unset=True)`) |
| [`frontend/src/app/(dashboard)/suppliers/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/suppliers/page.tsx) | Optimistic State Update + Anti-Cache header ป้องกัน browser cache รีเฟรชทันทีหลังบันทึก |
| [`frontend/src/app/(dashboard)/items/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/items/page.tsx) | Optimistic State Update + Anti-Cache header รีเฟรชทันทีหลังบันทึก |
| [`backend/app/schemas/user.py`](file:///d:/Python/IRM/backend/app/schemas/user.py) | เพิ่ม `username: str | None = None` ใน `UserUpdate` |
| [`backend/app/routers/users.py`](file:///d:/Python/IRM/backend/app/routers/users.py) | รองรับการเปลี่ยน Username พร้อมตรวจซ้ำ และเพิ่ม `DELETE /api/users/{user_id}` พร้อมระบบ Safeguards |
| [`frontend/src/app/(dashboard)/admin/users/page.tsx`](file:///d:/Python/IRM/frontend/src/app/(dashboard)/admin/users/page.tsx) | ช่องกรอก User ID ใน Edit Modal, ปุ่มไอคอนถังขยะ `Trash2`, และ Modal ยืนยันการลบบัญชี |
| [`PRD.md`](file:///d:/Python/IRM/PRD.md) | เอกสาร Product Requirements Document ฉบับสมบูรณ์ของระบบ IRM |
| [`backend/app/services/log_service.py`](file:///d:/Python/IRM/backend/app/services/log_service.py) | ฟังก์ชัน `record_transaction_log` บันทึก Audit Log แบบ Isolated Session ไม่โดน Rollback |
| [`backend/app/services/email_service.py`](file:///d:/Python/IRM/backend/app/services/email_service.py) | ดึงผู้รับ PU Reminder จากกลุ่ม `PU User` ใน User Management โดยตรง พร้อมไฟล์แนบ Excel 2 Sheet |
| [`backend/app/services/scheduler.py`](file:///d:/Python/IRM/backend/app/services/scheduler.py) | Auto Purge Logs เวลา 00:30 น., Minute-Checker สำหรับ PU Reminder Email |

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
  * โค้ดทั้งหมดได้รับการตรวจสอบ Syntax และ Compile ผ่าน 100% (`python -m py_compile` & `next build` 19/19 static pages รหัสผ่าน 0)
  * บันทึก Git Commit & Push ขึ้น GitHub `main` เรียบร้อยแล้ว (`commit: eff470f` และ commit เอกสารล่าสุด)
  * ระบบ Authentication & SSO ได้รับการปรับปรุงครบทั้ง 3 จุด:
    1. Logout จาก Direct/Local Login ส่งกลับหน้า `/login` ของ IRM เสมอ (Invert Safeguard)
    2. รองรับ Active Directory (AD) Direct Login พร้อม Auto-Provisioning พนักงานใหม่ และ Fallback อัตโนมัติ
    3. ป้องกันสวิตช์ Disable SSO เด้งกลับมาเปิดเอง พร้อมหน้า Login แบบ Clean Standalone เมื่อแยกตัวออกจาก CIAM
* **ขั้นตอนถัดไปเมื่อกลับมาเริ่มงาน (Next Steps):**
  1. **Deploy ขึ้น Production:** รันคำสั่งในข้อ 6 บน VPS Production Hostinger
  2. **ทดสอบผลการทำงานบน Production:**
     - ทดสอบกด Logout จากบัญชี Local หรือ AD ว่ากลับมาหน้า Login ของ IRM โดยไม่กระโดดไป CIAM Portal
     - ทดสอบล็อกอินด้วย AD Account ทั้งบัญชีที่มีอยู่แล้วและบัญชีใหม่
     - ทดสอบปิด SSO ในหน้า Settings ตรวจสอบว่าสวิตช์ไม่เปลี่ยนกลับเอง และหน้า Login แสดงแบบ Standalone สะอาดตา
  3. **ดำเนินงานต่อตามโจทย์ใหม่:** พร้อมรับ Requirements ถัดไปจากผู้ใช้ได้ทันทีครับ
