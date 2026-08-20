# 🚀 IRM — Production Deployment Guide on VPS Hostinger
> **ระบบ:** Incoming Raw Material Tracking System (IRM)  
> **โดเมนใช้งานจริง:** [https://irm.windowasia.com](https://irm.windowasia.com)  
> **Git Repository:** `https://github.com/nchaiwat/IRM.git`  
> **สภาพแวดล้อม:** VPS Hostinger (Ubuntu / Debian Linux) รันร่วมกับ Production อื่นๆ (`FleetSys`, `Qol`, `WorkSync`)

---

## 🛡️ มาตรการความปลอดภัยเพื่อไม่ให้กระทบ Production เดิม (`FleetSys`, `Qol`, `WorkSync`)

1. **ไม่แย่ง Port 80 / 443 โดยตรง:**
   * ระบบ IRM รัน Web Gateway ภายในที่พอร์ต `8088` (หรือกำหนดผ่าน `IRM_HTTP_PORT=8088` ใน `.env`)
   * ให้ Host Nginx / Nginx Proxy Manager กลางบน VPS ทำหน้าที่รับ SSL ของ `irm.windowasia.com` แล้ว Forward เข้า `http://127.0.0.1:8088`
2. **ไม่เปิด Port Database สู่ Host:**
   * PostgreSQL (Port 5432) และ Redis (Port 6379) ของ IRM อยู่ในวง Private Network `irm-prod-network` เท่านั้น จึงไม่ชนกับ PostgreSQL/MySQL ของ `FleetSys`, `Qol`, หรือ `WorkSync` แน่นอน 100%
3. **แยกชื่อ Container และ Volume ชัดเจน:**
   * Container ทุกตัวตั้งชื่อ `irm-prod-db`, `irm-prod-redis`, `irm-prod-backend`, `irm-prod-frontend`, `irm-prod-nginx`
   * Volume ใช้ชื่อ `irm_prod_pgdata` และ `irm_prod_redis`

---

## 📋 ขั้นตอนที่ 1: การ Push Code ขึ้น GitHub Repository

รันคำสั่งเหล่านี้บนเครื่อง Development (เครื่องนี้):

```bash
# 1. ตรวจสอบสถานะไฟล์
git status

# 2. เพิ่ม Remote Repository (หากยังไม่มี)
git remote remove origin 2>/dev/null
git remote add origin https://github.com/nchaiwat/IRM.git

# 3. Add และ Commit ไฟล์ทั้งหมด
git add .
git commit -m "feat: complete IRM v1.0 with SAP on-premise agent, incremental versioning, and VPS production deployment config"

# 4. Push ขึ้น GitHub (Branch main)
git branch -M main
git push -u origin main
```

---

## 📋 ขั้นตอนที่ 2: การ Clone และ Config บน VPS Hostinger

SSH เข้าไปที่ VPS Hostinger:

```bash
# 1. ไปที่โฟลเดอร์สำหรับเก็บ Project (เช่น /opt หรือ /var/www หรือ home directory)
cd /opt

# 2. Clone Repository จาก GitHub
git clone https://github.com/nchaiwat/IRM.git irm-system
cd irm-system

# 3. คัดลอกและตั้งค่า .env สำหรับ Production
cp .env.prod.example .env

# 4. แก้ไขรหัสผ่าน Database และ Secret Key ใน .env
nano .env
```

**ตัวอย่างไฟล์ `.env` บน VPS:**
```env
APP_ENV=production
APP_BASE_URL=https://irm.windowasia.com
FRONTEND_URL=https://irm.windowasia.com
BACKEND_URL=https://irm.windowasia.com/api
NEXT_PUBLIC_API_URL=https://irm.windowasia.com/api

# พอร์ตที่ IRM Nginx จะ Bind บน VPS Host (หลบพอร์ตของ FleetSys/Qol/WorkSync)
IRM_HTTP_PORT=8088

# ฐานข้อมูล PostgreSQL
DB_NAME=irm_db
DB_USER=irm_admin
DB_PASSWORD=YourSecureDbPassword2026!

# JWT Secret
JWT_SECRET_KEY=e83a9f029b4c12e87d65b1a03f49c5e2197305d8f64e28b17a59c03de421fa89
```

---

## 📋 ขั้นตอนที่ 3: สั่งรัน Docker Containers บน VPS

```bash
# สั่ง Build และรันเฉพาะ Service ของ IRM
docker compose -f docker-compose.prod.yml up -d --build

# ตรวจสอบสถานะการทำงาน
docker compose -f docker-compose.prod.yml ps

# ตรวจสอบว่า IRM ตอบสนองบน Port 8088 ภายในเครื่อง
curl http://127.0.0.1:8088/api/health
# ผลลัพธ์: {"status":"healthy"}
```

---

## 📋 ขั้นตอนที่ 4: การตั้งค่า Host Nginx & SSL Certbot (บน VPS)

### กรณีใช้ Host Nginx (แนะนำ)

สร้างไฟล์ VirtualHost สำหรับ `irm.windowasia.com`:

```bash
sudo nano /etc/nginx/sites-available/irm.windowasia.com
```

**เนื้อหาไฟล์ Config:**
```nginx
server {
    server_name irm.windowasia.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

เปิดใช้งานและออกใบรับรอง SSL ฟรี (Let's Encrypt):

```bash
# สร้าง Symlink
sudo ln -s /etc/nginx/sites-available/irm.windowasia.com /etc/nginx/sites-enabled/

# ทดสอบ Syntax Nginx
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# ขอ SSL Certificate อัตโนมัติด้วย Certbot
sudo certbot --nginx -d irm.windowasia.com
```

---

### กรณีใช้ Nginx Proxy Manager (GUI)
หาก VPS ใช้ Nginx Proxy Manager ในการจัดการโดเมนของ `FleetSys`, `Qol`, `WorkSync`:
1. เข้าเมนู **Proxy Hosts ➔ Add Proxy Host**
2. **Domain Names:** `irm.windowasia.com`
3. **Scheme:** `http`
4. **Forward Hostname / IP:** IP ของ VPS หรือ Gateway IP (เช่น `172.17.0.1` หรือ `localhost`)
5. **Forward Port:** `8088`
6. **Websockets Support:** `ON`
7. แท็บ **SSL:** เลือก **Request a new SSL Certificate**, ติ๊ก `Force SSL` และ `HTTP/2 Support` ➔ กด **Save**

---

## 📋 ขั้นตอนที่ 5: การใช้งาน On-Premise SAP Python Agent

1. เปิดเบราว์เซอร์ไปที่ [https://irm.windowasia.com](https://irm.windowasia.com)
2. เข้าสู่ระบบด้วยบัญชี Admin (`admin` / `irm@2026`)
3. ไปที่เมนู **`System Setting` (`/admin/settings`)** ➔ หมวด **`1. SAP On-Premise Sync Agent`**
4. กดปุ่ม **[📥 ดาวน์โหลด Script (irm_agent_sync_v1.py)]**
5. นำไฟล์ที่ได้ไปวางบน On-Premise Server ในโรงงาน (เช่น `C:\IRM_Agent\`)
6. รันคำสั่ง Windows Task Scheduler ตามที่ระบบแนะนำ:
   ```cmd
   schtasks /create /tn "IRM_SAP_Sync_Daily" /tr "python C:\IRM_Agent\irm_agent_sync_v1.py" /sc daily /st 04:00 /ru "SYSTEM" /f
   ```
7. เมื่อสคริปต์ทำงาน มันจะยิงข้อมูลมาที่ `https://irm.windowasia.com/api/sap/inbound-push` อัตโนมัติอย่างปลอดภัย 100%!
