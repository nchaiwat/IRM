import asyncio
from app.database import AsyncSessionLocal, engine, Base
from app.models import Menu, Group, AuthMatrix, TransactionLog
from sqlalchemy import select, text

async def setup():
    # 1. Create table transaction_logs
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("✅ Table transaction_logs created/verified.")

    # 2. Add Menu and AuthMatrix
    async with AsyncSessionLocal() as session:
        # Find Admin parent menu
        admin_menu = (await session.execute(select(Menu).where(Menu.name == "Admin", Menu.parent_id == None))).scalar_one_or_none()
        if not admin_menu:
            print("❌ Admin parent menu not found")
            return

        stmt_log_menu = select(Menu).where(Menu.path == "/admin/logs")
        log_menu = (await session.execute(stmt_log_menu)).scalar_one_or_none()
        if not log_menu:
            log_menu = Menu(
                name="Transaction Logs",
                path="/admin/logs",
                icon="Activity",
                sort_order=4,
                parent_id=admin_menu.id,
                is_active=True,
            )
            session.add(log_menu)
            await session.flush()
            print("✅ Menu 'Transaction Logs' created.")
        else:
            print("ℹ️ Menu 'Transaction Logs' already exists.")

        # Assign to Admin Group & PU User Group
        admin_group = (await session.execute(select(Group).where(Group.name == "Admin"))).scalar_one_or_none()
        if admin_group:
            stmt_auth = select(AuthMatrix).where(AuthMatrix.group_id == admin_group.id, AuthMatrix.menu_id == log_menu.id)
            if not (await session.execute(stmt_auth)).scalar_one_or_none():
                session.add(AuthMatrix(
                    group_id=admin_group.id,
                    menu_id=log_menu.id,
                    can_view=True,
                    can_create=True,
                    can_edit=True,
                    can_delete=True,
                ))
                print("✅ Granted Admin group permissions for Transaction Logs.")

        await session.commit()

        # 3. Seed some initial sample transaction logs for immediate display
        from app.services.log_service import record_transaction_log
        await record_transaction_log(
            category="sap_sync",
            action="sync_open_pos",
            status="success",
            message="ซิงค์ข้อมูล PO ค้างรับจาก SAP B1 สำเร็จ (301 รายการ)",
            details={"source": "SAP B1 MSSQL", "total_records": 301, "new_items": 0, "closed_items": 0},
            records_count=301,
            duration_ms=420,
            triggered_by="system_cron",
            db=session,
        )
        await record_transaction_log(
            category="supplier_email",
            action="send_single_email",
            status="success",
            message="ส่ง Email แจ้งลิงก์ Portal หา บริษัท กบินทร์บุรีกล๊าส อินดัสทรี จำกัด (n.chaiwat@gmail.com) สำเร็จ",
            details={"supplier_code": "VD-0004", "email": "n.chaiwat@gmail.com", "total_pos": 40},
            records_count=1,
            duration_ms=850,
            triggered_by="user:admin",
            db=session,
        )
        await record_transaction_log(
            category="qms_export",
            action="push_qms_json",
            status="success",
            message="ส่งข้อมูล JSON แพลนส่งวัตถุดิบให้ระบบ QMS สำเร็จ (301 รายการ)",
            details={"target_endpoint": "http://qms-api.internal/api/irm/receive-schedule", "status_code": 200},
            records_count=301,
            duration_ms=310,
            triggered_by="user:admin",
            db=session,
        )
        await session.commit()
        print("✅ Sample Transaction Logs seeded.")

asyncio.run(setup())
