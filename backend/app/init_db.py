"""
Database Initialization & Seeding Script — Section-Isolated Commits for Bulletproof Data Seeding.
Each section has its own try/except so a failure in one step never blocks the rest.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, text
from app.database import Base, engine, AsyncSessionLocal
from app.models import Group, User, Menu, AuthMatrix, SystemSetting, POHeader, POItem, ItemMaster, SupplierMaster, SupplierPortalToken
from app.utils.security import hash_password


async def run_ddl_migrations(conn):
    """
    Run all DDL ALTER TABLE migrations safely with IF NOT EXISTS.
    This handles ANY existing database state — fresh install or partial schema upgrades.
    """
    migrations = [
        # users table
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;",

        # po_items table
        "ALTER TABLE po_items ADD COLUMN IF NOT EXISTS line_num INTEGER DEFAULT 0;",
        "ALTER TABLE po_items ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;",
        "ALTER TABLE po_items ADD COLUMN IF NOT EXISTS item_group VARCHAR(50);",
        "ALTER TABLE po_items ADD COLUMN IF NOT EXISTS locked_by VARCHAR(20);",
        "ALTER TABLE po_items ADD COLUMN IF NOT EXISTS lock_expires_at TIMESTAMPTZ;",
        "ALTER TABLE po_items ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE po_items ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;",

        # item_masters table
        "ALTER TABLE item_masters ADD COLUMN IF NOT EXISTS item_group VARCHAR(50);",
        "ALTER TABLE item_masters ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE item_masters ALTER COLUMN notify_alert_days SET DEFAULT 3;",

        # supplier_masters table
        "ALTER TABLE supplier_masters ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE supplier_masters ADD COLUMN IF NOT EXISTS telephone VARCHAR(50);",
        "ALTER TABLE supplier_masters ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100);",
        "ALTER TABLE supplier_masters ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ;",

        # sub_items table — ensure nullable fields are correct
        "ALTER TABLE sub_items ALTER COLUMN updated_by_name DROP NOT NULL;",
        "ALTER TABLE sub_items ALTER COLUMN updated_by_type DROP NOT NULL;",
    ]

    for sql in migrations:
        try:
            await conn.execute(text(sql))
        except Exception as e:
            print(f"  ⚠️ DDL notice (non-fatal): {sql[:60]}... → {e}")


async def seed_data():
    # ─── Phase 0: Create Tables + Run DDL Migrations ─────────────────────────
    max_retries = 15
    for attempt in range(1, max_retries + 1):
        try:
            async with engine.begin() as conn:
                # Create all tables that don't yet exist
                await conn.run_sync(Base.metadata.create_all)
                print("✅ Phase 0a: Tables created/verified.")
                # Run column-level migrations
                await run_ddl_migrations(conn)
                print("✅ Phase 0b: DDL Migrations applied.")
            break
        except Exception as err:
            if attempt == max_retries:
                print(f"❌ Failed to connect to database after {max_retries} attempts: {err}")
                raise err
            print(f"⏳ Waiting for database connection (Attempt {attempt}/{max_retries})...")
            await asyncio.sleep(2)

    # ─── Step 1: Seed Groups & Users ─────────────────────────────────────────
    try:
        async with AsyncSessionLocal() as session:
            groups_data = [
                ("Admin", "Full system administrator access"),
                ("PU User", "Purchasing department user access"),
                ("Viewer", "Read-only access to calendar and operation"),
            ]
            group_map: dict[str, Group] = {}
            for name, desc in groups_data:
                stmt = select(Group).where(Group.name == name)
                group = (await session.execute(stmt)).scalar_one_or_none()
                if not group:
                    group = Group(name=name, description=desc)
                    session.add(group)
                    await session.flush()
                group_map[name] = group

            admin_hash = hash_password("irm@2026")
            users_to_seed = [
                ("admin", "System Administrator", "admin@company.com", "Admin"),
                ("patcha", "พัชชา สุขสวัสดิ์", "patcha@company.com", "PU User"),
                ("pinyada", "ภิญญดา สุขสวัสดิ์", "pinyada@company.com", "PU User"),
            ]

            for uname, fname, email, gname in users_to_seed:
                stmt = select(User).where(User.username == uname)
                user = (await session.execute(stmt)).scalar_one_or_none()
                if not user:
                    session.add(User(
                        username=uname,
                        password_hash=admin_hash,
                        full_name=fname,
                        email=email,
                        group_id=group_map[gname].id,
                        is_active=True,
                    ))
                else:
                    user.password_hash = admin_hash
                    user.is_active = True
                    user.group_id = group_map[gname].id
            await session.commit()
            print("✅ Step 1: Groups and Users seeded.")
    except Exception as e:
        print(f"⚠️ Step 1 Error: {e}")

    # ─── Step 2: Seed Menus & Auth Matrix ────────────────────────────────────
    try:
        async with AsyncSessionLocal() as session:
            top_menus_data = [
                ("Dashboard", "/dashboard", "LayoutDashboard", 1),
                ("Operation", "/operation", "ClipboardList", 2),
                ("Calendar", "/calendar", "Calendar", 3),
                ("Item Master", "/items", "Package", 4),
                ("Supplier Master", "/suppliers", "Factory", 5),
                ("History", "/history", "ScrollText", 6),
                ("Admin", None, "Shield", 7),
            ]

            menu_map: dict[str, Menu] = {}
            for name, path, icon, sort_order in top_menus_data:
                stmt = select(Menu).where(Menu.name == name, Menu.parent_id == None)
                menu = (await session.execute(stmt)).scalar_one_or_none()
                if not menu:
                    menu = Menu(name=name, path=path, icon=icon, sort_order=sort_order, parent_id=None)
                    session.add(menu)
                    await session.flush()
                menu_map[name] = menu

            admin_menu_id = menu_map["Admin"].id
            sub_menus_data = [
                ("System Setting", "/admin/settings", "Settings", 1),
                ("User Management", "/admin/users", "Users", 2),
                ("Auth Matrix", "/admin/auth-matrix", "Lock", 3),
                ("Transaction Logs", "/admin/logs", "Activity", 4),
            ]

            for name, path, icon, sort_order in sub_menus_data:
                stmt = select(Menu).where(Menu.name == name, Menu.parent_id == admin_menu_id)
                sub_menu = (await session.execute(stmt)).scalar_one_or_none()
                if not sub_menu:
                    sub_menu = Menu(name=name, path=path, icon=icon, sort_order=sort_order, parent_id=admin_menu_id)
                    session.add(sub_menu)
                    await session.flush()
                menu_map[name] = sub_menu

            all_menus = (await session.execute(select(Menu))).scalars().all()
            admin_group = (await session.execute(select(Group).where(Group.name == "Admin"))).scalar_one()
            pu_group = (await session.execute(select(Group).where(Group.name == "PU User"))).scalar_one()

            for m in all_menus:
                stmt = select(AuthMatrix).where(AuthMatrix.group_id == admin_group.id, AuthMatrix.menu_id == m.id)
                if not (await session.execute(stmt)).scalar_one_or_none():
                    session.add(AuthMatrix(group_id=admin_group.id, menu_id=m.id, can_view=True, can_create=True, can_edit=True, can_delete=True))

                stmt = select(AuthMatrix).where(AuthMatrix.group_id == pu_group.id, AuthMatrix.menu_id == m.id)
                if not (await session.execute(stmt)).scalar_one_or_none():
                    is_admin_submenu = m.parent_id == admin_menu_id or m.id == admin_menu_id
                    session.add(AuthMatrix(
                        group_id=pu_group.id,
                        menu_id=m.id,
                        can_view=not is_admin_submenu,
                        can_create=not is_admin_submenu,
                        can_edit=not is_admin_submenu,
                        can_delete=False,
                    ))
            await session.commit()
            print("✅ Step 2: Menus & Auth Matrix seeded.")
    except Exception as e:
        print(f"⚠️ Step 2 Error: {e}")

    # ─── Step 3: Seed System Settings ────────────────────────────────────────
    try:
        async with AsyncSessionLocal() as session:
            settings_seed = [
                ("smtp_host", "smtp.gmail.com", "SMTP Mail Server Host", "smtp", "string"),
                ("smtp_port", "587", "SMTP Server Port", "smtp", "integer"),
                ("smtp_user", "itwindowasia@gmail.com", "SMTP Username", "smtp", "string"),
                ("smtp_password", "", "SMTP Password / App Password", "smtp", "string"),
                ("smtp_use_tls", "true", "Use TLS for SMTP", "smtp", "boolean"),
                ("smtp_from_name", "IRM System (No-Reply)", "Sender Name for Emails", "smtp", "string"),
                ("email_batch_size", "20", "Max emails sent per batch chunk", "smtp", "integer"),
                ("email_batch_delay_seconds", "5", "Delay in seconds between batch chunks", "smtp", "integer"),
                ("email_max_per_session", "100", "Max suppliers to send email per session", "smtp", "integer"),
                ("mail_send_days", '["monday", "thursday"]', "Days to send supplier notification emails", "schedule", "json"),
                ("mail_send_time", "08:00", "Daily automated email batch dispatch time", "email", "string"),
                ("mail_schedule_enabled", "false", "Enable automated scheduled email dispatch to suppliers (Safety locked during implementation)", "email", "boolean"),
                ("sap_sync_time", "04:00", "Time of day to sync open POs from SAP (HH:MM)", "schedule", "time"),
                ("scheduler_enabled", "true", "Enable background email and SAP sync scheduler", "schedule", "boolean"),
                ("history_retention_days", "7", "Days to retain closed PO history (7-15 days)", "general", "integer"),
                ("date_format", "dd/MM/yyyy", "System date display format", "general", "string"),
                ("app_base_url", "https://irm.windowasia.com", "System Base URL & Supplier Portal Domain", "general", "string"),
                ("sap_sync_mode", "outbound_agent", "SAP Sync Mode: 'outbound_agent' (Push via Python Script), 'sql' (Direct MS SQL), or 'api'", "sap", "string"),
                ("sap_ingest_token", "tok_irm_ingest_sec_8a39f029b4c12e87", "Secret Token for On-Premise Python Agent Ingestion", "sap", "string"),
                ("sap_agent_version", "1", "Current Version Number of On-Premise Agent Script", "sap", "integer"),
                ("sap_item_groups", "[113, 115]", "SAP Item Group Codes (113=FG-ALU, 115=FG-UPVC)", "sap", "json"),
                ("sap_host", "wa-dbs2.wa.net", "SAP B1 SQL Server Host / IP", "sap", "string"),
                ("sap_port", "1433", "SAP SQL Server Port", "sap", "integer"),
                ("sap_database", "SBO_COMPANY_DB", "SAP B1 Database Name", "sap", "string"),
                ("sap_user", "irm_readonly", "SAP SQL Read-Only Username", "sap", "string"),
                ("sap_password", "", "SAP SQL Read-Only Password", "sap", "string"),
                ("telegram_api_url", "https://api.telegram.org", "Telegram API Base URL", "telegram", "string"),
                ("telegram_bot_token", "8231754616:AAHcITgZR6_Gc8XJx-6Fxj-Cyy5bZZQG2hw", "Telegram Bot Token ID", "telegram", "string"),
                ("telegram_group_id", "-5394050672", "Telegram Group ID for Notifications", "telegram", "string"),
            ]

            for key, val, desc, cat, dtype in settings_seed:
                stmt = select(SystemSetting).where(SystemSetting.key == key)
                if not (await session.execute(stmt)).scalar_one_or_none():
                    session.add(SystemSetting(key=key, value=val, description=desc, category=cat, data_type=dtype))
            await session.commit()

            # Fix/ensure correct categories for existing settings in case they were set to general
            from sqlalchemy import update
            for key, val, desc, cat, dtype in settings_seed:
                await session.execute(
                    update(SystemSetting)
                    .where(SystemSetting.key == key)
                    .values(category=cat)
                )

            # Ensure app_base_url points to https://irm.windowasia.com
            await session.execute(
                update(SystemSetting)
                .where(SystemSetting.key == "app_base_url", SystemSetting.value.like("%localhost%"))
                .values(value="https://irm.windowasia.com")
            )
            await session.commit()
            print("✅ Step 3: System Settings seeded and categories verified.")
    except Exception as e:
        print(f"⚠️ Step 3 Error: {e}")

    # ─── Step 4: Seed Supplier Masters ───────────────────────────────────────
    try:
        async with AsyncSessionLocal() as session:
            suppliers_seed = [
                ("VD-0004", "บริษัท กรีนเทคพลัส อินเตอร์กรุ๊ป จำกัด", "n.chaiwat@gmail.com", "02-123-4567", "คุณสมชาย"),
                ("VD-0123", "บริษัท ริเวลเทค โปรดักส์ จำกัด", "info@riveltech.co.th", "02-987-6543", "คุณวิชัย"),
                ("VD-0021", "บริษัท ไทรพอยท์ อินเตอร์เทรดดิ้ง จำกัด", "contact@tripoint.co.th", "02-555-1234", "คุณสุรชัย"),
                ("VD-0088", "บริษัท คินลอง ฮาร์ดแวร์ (ประเทศไทย) จำกัด", "sales@kinlong.co.th", "02-777-8888", "คุณกิตติ"),
                ("VD-0120", "ห้างหุ้นส่วนจำกัด กระจกคิ้วเชียงเซ้ง", "sales@chiangseng.co.th", "02-444-3333", "คุณเชียง"),
                ("VD-0558", "บริษัท คิม แซนด์ อินเตอร์เนชั่นแนล จำกัด", "info@kimsand.co.th", "02-222-1111", "คุณคิม"),
                ("VD-0706", "บริษัท ฮอสเด็ค (ประเทศไทย) จำกัด", "info@hosdeck.co.th", "02-333-2222", "คุณฮอส"),
                ("VD-0044", "บริษัท ซี เจ ควิก โปรดักส์ จำกัด", "sales@cjquick.co.th", "02-666-5555", "คุณซีเจ"),
            ]

            for scode, sname, semail, sphone, scontact in suppliers_seed:
                stmt_sup = select(SupplierMaster).where(SupplierMaster.supplier_code == scode)
                sup_obj = (await session.execute(stmt_sup)).scalar_one_or_none()
                if not sup_obj:
                    session.add(SupplierMaster(
                        supplier_code=scode,
                        supplier_name=sname,
                        email=semail,
                        telephone=sphone,
                        contact_person=scontact,
                        is_new=False,  # Pre-seeded suppliers are not "new"
                    ))
                else:
                    # Update email if missing
                    if not sup_obj.email and semail:
                        sup_obj.email = semail
                    if not sup_obj.telephone and sphone:
                        sup_obj.telephone = sphone
                    if not sup_obj.contact_person and scontact:
                        sup_obj.contact_person = scontact
            await session.commit()
            print("✅ Step 4: Supplier Masters seeded.")
    except Exception as e:
        print(f"⚠️ Step 4 Error: {e}")

    # ─── Step 5: Seed Item Masters ────────────────────────────────────────────
    try:
        async with AsyncSessionLocal() as session:
            items_seed = [
                ("HW-0101-00000", "กรรไกรตัดสีกษณหนาด 60 (180x110)", "HW", 60, 3),
                ("HW-0110-00000", "ก้านบานเลื่อนอลูมิเนียม UPVC 800 mm. (PCDQWD22008)", "HW", 60, 3),
                ("HW-0118-00000", "ก้านบานเลื่อนอลูมิเนียม UPVC 400 mm. (PCDQWD22004)", "HW", 60, 3),
                ("HW-0417-02000", "ตัวล็อกกลางบานหน้าต่าง UPVC สีขาว (PYSL004-WA/PG1111)", "HW", 60, 3),
                ("HW-0418-02000", "ตัวล็อกกลางบานหน้าต่าง UPVC สีขาว (PYSL004/F)", "HW", 60, 3),
                ("HW-0419-00000", "ตัวแป้นล็อคกลางบานหน้าต่าง UPVC (PSG003)", "HW", 60, 3),
                ("HW-0420-00000", "ตัวแป้นล็อคกลางบานหน้าต่าง UPVC (PSG006)", "HW", 60, 3),
                ("HW-2110-00000", "หัวล็อกประตู UPVC (PSK206)", "HW", 60, 3),
                ("HW-2115-00000", "หัวล็อกบานเลื่อน UPVC (PSK20109)", "HW", 60, 3),
                ("HW-3307-02039", "มือจับบานกระทุ้ง R สีขาว (NQ03-R / White PG1111)", "HW", 60, 3),
                ("HW-3307-04039", "มือจับบานกระทุ้ง R (NQ03-R / Black)", "HW", 60, 3),
                ("HW-3602-15043", "ดันบานเลื่อน สำหรับประตู", "HW", 60, 3),
                ("HW-3638-02034", "ล๊อคกลางบานหน้าต่าง-ตัวเรือน ALU10 สีดำ ด้านข้าง", "HW", 60, 3),
                ("HW-3638-04039", "ล๊อคกลางบานหน้าต่าง-ตัวเรือน ALU10 สีดำ ด้านข้าง", "HW", 60, 3),
                ("HW-3639-02034", "ล๊อคกลางบานหน้าต่าง-ตัวเรือน ALU10 สีขาว ด้านข้าง", "HW", 60, 3),
                ("HW-4078-03000", "สลักเกลียว ALU ECO-PLUS เส้นหนา 4.8x12 mm.", "HW", 60, 3),
                ("HW-3008-00000", "พลาสติกใส 50\"x0.05mm.X90Y", "HW", 60, 3),
                ("HW-3009-00000", "พลาสติกใส 80\"x0.05mm.X90Y (ขอบยาง)", "HW", 60, 3),
                ("HW-3002-00000", "พลาสติกใส 80\"x0.05mm.X90Y", "HW", 60, 3),
                ("HW-3002-00000-B", "พลาสติกใส 80\"x0.05mm.X90Y (เสริม)", "HW", 60, 3),
                ("RB2-001-0772-0950", "RB F10 กระจกใส เข็มใส 772x950", "RM-กระจก", 60, 3),
                ("RBU-019-0429-0890", "RB F10 กระจกใส เข็มใส 4 mm. 429x890", "RM-กระจก", 60, 3),
                ("RB2-001-0542-0990", "RB F10 กระจกใส เข็มใส 4 mm. 542x990", "RM-กระจก", 60, 3),
                ("RB2-001-0679-0990", "RB F10 กระจกใส เข็มใส 4 mm. 679x990", "RM-กระจก", 60, 3),
                ("RB2-001-0937-0674", "RB F8 กระจกใส เข็มใส 937x674", "RM-กระจก", 60, 3),
                ("RB2-001-1137-0674", "RB F8 กระจกใส เข็มใส 1137x674", "RM-กระจก", 60, 3),
                ("RB2-001-1537-0674", "RB F8 กระจกใส เข็มใส 1537x674", "RM-กระจก", 60, 3),
                ("RB2-001-1737-0674", "RB F8 กระจกใส เข็มใส 1737x674", "RM-กระจก", 60, 3),
                ("RBU-001-0487-1317", "RB F8 กระจกใส เข็มใส 487x1317", "RM-กระจก", 60, 3),
                ("RBU-001-0517-1355", "RB F8 กระจกใส เข็มใส 517x1355", "RM-กระจก", 60, 3),
                ("RBA-014-0424-0840", "RB F8 กระจกใส เข็มใส 424x840", "RM-กระจก", 60, 3),
                ("RBA-014-0486-0960", "RB F8 กระจกใส เข็มใส 48x96 นิ้ว", "RM-กระจก", 60, 3),
                ("RBU-001-0401-0930", "RB U กระจกใส เข็มใส 401x930", "RM-กระจก", 60, 3),
                ("RBU-001-0832-0915", "RB U กระจกใส เข็มใส 832x915", "RM-กระจก", 60, 3),
                ("RBU-001-0914-0628", "RB U กระจกใส เข็มใส 914x628", "RM-กระจก", 60, 3),
                ("RBU-001-1910-0628", "RB U กระจกใส เข็มใส 1910x628", "RM-กระจก", 60, 3),
                ("RB2-002-0665-1027", "RB U กระจกใส เข็มใส 665x1027", "RM-กระจก", 60, 3),
                ("RBU-019-0503-0936", "RB U กระจกใส เข็มใส 4 mm. 503x936", "RM-กระจก", 60, 3),
            ]

            for icode, desc, grp, lt, na in items_seed:
                stmt_im = select(ItemMaster).where(ItemMaster.item_code == icode)
                itm_obj = (await session.execute(stmt_im)).scalar_one_or_none()
                if not itm_obj:
                    session.add(ItemMaster(
                        item_code=icode,
                        description=desc,
                        item_group=grp,
                        lead_time_days=lt,
                        notify_alert_days=na,
                        is_new=False,  # Pre-seeded items are not "new"
                    ))
                else:
                    if itm_obj.item_group in ["113", "115"]:
                        itm_obj.item_group = grp
            await session.commit()
            print("✅ Step 5: Item Masters seeded.")
    except Exception as e:
        print(f"⚠️ Step 5 Error: {e}")

    # ─── Step 6: Seed PO Data from SAP B1 (Simulated Report 8) ───────────────
    try:
        async with AsyncSessionLocal() as session:
            from app.services.sap_service import sync_sap_open_pos
            await sync_sap_open_pos(session, triggered_by="System Initializer")
            print("✅ Step 6: SAP Open POs seeded.")
    except Exception as e:
        print(f"⚠️ Step 6 Error: {e}")

    # ─── Step 7: Auto-Normalize Item Groups ───────────────────────────────────
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import text
            await session.execute(text("""
                UPDATE item_masters SET item_group = 'HW' WHERE item_group = '113' OR (item_group = '115' AND item_code LIKE 'HW-%');
                UPDATE item_masters SET item_group = 'RM-กระจก' WHERE (item_group IN ('113', '115') OR item_group IS NULL) AND (item_code LIKE 'RB%' OR description LIKE '%กระจก%');
                UPDATE item_masters SET item_group = 'FG-UPVC' WHERE item_group = '115';
                
                UPDATE po_items SET item_group = 'HW' WHERE item_group = '113' OR (item_group = '115' AND item_code LIKE 'HW-%');
                UPDATE po_items SET item_group = 'RM-กระจก' WHERE (item_group IN ('113', '115') OR item_group IS NULL) AND (item_code LIKE 'RB%' OR item_name LIKE '%กระจก%');
                UPDATE po_items SET item_group = 'FG-UPVC' WHERE item_group = '115';
            """))
            await session.commit()
            print("✅ Step 7: Item Groups normalized to proper names.")
    except Exception as e:
        print(f"⚠️ Step 7 Error: {e}")


if __name__ == "__main__":
    asyncio.run(seed_data())
