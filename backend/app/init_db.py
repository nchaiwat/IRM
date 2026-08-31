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

        # Update username format to Firstname.L
        "UPDATE users SET username = 'Patcha.S' WHERE lower(username) = 'patcha';",
        "UPDATE users SET username = 'Pinyada.S' WHERE lower(username) = 'pinyada';",
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
                ("Patcha.S", "พัชชา สุขสวัสดิ์", "patcha@company.com", "PU User"),
                ("Pinyada.S", "ภิญญาดา สุขสวัสดิ์", "pinyada@company.com", "PU User"),
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
                ("telegram_morning_summary_enabled", "true", "เปิด/ปิดการส่งสรุปสถานะประจำวันเข้า Telegram (Morning Daily Briefing)", "telegram", "boolean"),
                ("telegram_morning_summary_time", "08:00", "เวลาส่งสรุปสถานะประจำวันเข้า Telegram (HH:MM)", "telegram", "string"),
                ("qms_api_key", "irm_qms_secure_key_2026", "Secret API Key สำหรับระบบ QMS ดึงข้อมูล Confirmed Inbound Deliveries", "integration", "string"),
                ("pu_remind_mail_enabled", "false", "เปิด/ปิดระบบส่งอีเมลสรุปงานและของส่งวันนี้ให้จัดซื้อพร้อมแนบไฟล์ Excel", "email", "boolean"),
                ("pu_remind_mail_time", "08:30", "เวลาส่งอีเมลสรุปงานประจำวันให้จัดซื้อ (HH:MM)", "email", "string"),
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


if __name__ == "__main__":
    asyncio.run(seed_data())
