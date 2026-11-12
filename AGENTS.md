# Antigravity Agent Workspace Guidelines & Operational Protocols (AGENTS.md)
**Target Workspace:** `d:\Python\IRM` (Incoming Raw Material System)  
**Organization:** Window Asia Public Company Limited  
**Related Central System:** Central IAM (`https://ciam.windowasia.com`, Local: `d:\Python\Central-IAM`)

---

## 1. กฎการเริ่มต้นบทสนทนา (Session Startup Protocol — บังคับทุกครั้งเมื่อเริ่ม Session)
เมื่อเริ่มต้นบทสนทนาใหม่, เริ่มงานใหม่, หรือผู้ใช้สลับ Project เข้ามายัง IRM AI Agent **ต้องใช้เครื่องมือเปิดอ่านและทำความเข้าใจไฟล์บริบทต่อไปนี้โดยอัตโนมัติทันที 100% ในข้อความแรก** ก่อนเริ่มตอบคำถามหรือลงมือเขียนโค้ด โดยที่ผู้ใช้ไม่ต้องคอยทวงถาม:
1. `HANDOFF.md` — สถานะความคืบหน้าล่าสุด Git Commits และ Roadmap งานที่จะทำต่อใน IRM
2. `MEMORY.md` — พอร์ต เน็ตเวิร์ก โครงสร้างฐานข้อมูล SAP B1 Integration และความปลอดภัยของ IRM
3. `CHECKPOINT_SSO.md` — สถานะการเชื่อมต่อ OIDC SSO และ M2M กับ Central IAM

---

## 2. ขั้นตอนเมื่อมีการแก้ไขโค้ด (Post-Modification & Deployment Protocol)
เมื่อมีการเพิ่มฟีเจอร์หรือแก้ไขบั๊กเสร็จสิ้นในแต่ละรอบ AI Agent **ต้องปฏิบัติตามลำดับงานต่อไปนี้อย่างเคร่งครัด**:

### ขั้นที่ 1: ตรวจสอบความถูกต้องและ Type Integrity
- **Backend:** ตรวจสอบ Python code integrity และรัน test cases ที่เกี่ยวข้อง
- **Frontend:** ตรวจสอบ TypeScript/React integrity

### ขั้นที่ 2: บันทึกประวัติและอัปเดตเอกสารระบบ
- อัปเดตบันทึกการเปลี่ยนแปลงใน `HANDOFF.md` และ `MEMORY.md`
- ทำ `git add` และ `git commit` ด้วยข้อความ Conventional Commits
- ดำเนินการ `git push origin main` หรือเตรียมคำสั่ง push ให้ผู้ใช้

### ขั้นที่ 3: สรุปคำสั่ง Deploy บน Production VPS เสมอ
> ⚠️ **กฎเหล็กการ Deploy:**
> 1. ต้องมี `git pull` นำหน้าเสมอ
> 2. แยกคำสั่งทีละบรรทัด ห้ามเชื่อมด้วย `&&` ยาวเป็นพรืด

**ตัวอย่างรูปแบบคำสั่ง Deploy สำหรับ IRM:**
```bash
cd /var/www/Irm
git pull
docker compose build
docker compose up -d
```
