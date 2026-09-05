import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.database import AsyncSessionLocal
from app.models.po import POHeader, POItem, SubItem, POItemAuditLog
from app.models.master import ItemMaster, SupplierMaster
from app.services.sap_service import _process_and_save_sap_records

async def test_fifo_sync():
    async with AsyncSessionLocal() as db:
        try:
            bkk_tz = timezone(timedelta(hours=7))
            test_id = int(datetime.now().timestamp())
            test_po_num = f"PO-TEST-{test_id}"
            test_item_code = f"ITEM-FIFO-{test_id}"
            test_sup_code = f"VD-FIFO-{test_id}"
            po_date = datetime(2026, 9, 5, 10, 0, 0, tzinfo=bkk_tz)

            itm = ItemMaster(item_code=test_item_code, description="Item Test FIFO", lead_time_days=30, notify_alert_days=3, item_group="HW")
            sup = SupplierMaster(supplier_code=test_sup_code, supplier_name="Supplier FIFO Test", email="sup@test.com")
            db.add_all([itm, sup])
            await db.flush()

            header = POHeader(po_number=test_po_num, po_date=po_date, supplier_code=test_sup_code, supplier_name="Supplier FIFO Test", buyer_name="Buyer Test", status="O")
            db.add(header)
            await db.flush()

            # PO Item: 100 pcs ordered, 0 received
            item = POItem(
                po_header_id=header.id,
                line_num=1,
                item_code=test_item_code,
                item_name="Item Test FIFO",
                quantity=100.0,
                unit="ชิ้น",
                received_qty=0.0,
                remaining_qty=100.0,
                estimate_qty=100.0,
                estimate_date=datetime(2026, 9, 10, 0, 0, 0, tzinfo=bkk_tz),
                status="confirmed",
                updated_by_name="User Test",
                updated_by_type="user",
            )
            db.add(item)
            await db.flush()

            # Split:
            # SubItem 1: 50 pcs on 10/09
            # SubItem 2: 50 pcs on 11/09
            sub1 = SubItem(po_item_id=item.id, estimate_date=datetime(2026, 9, 10, 0, 0, 0, tzinfo=bkk_tz), quantity=50.0)
            sub2 = SubItem(po_item_id=item.id, estimate_date=datetime(2026, 9, 11, 0, 0, 0, tzinfo=bkk_tz), quantity=50.0)
            db.add_all([sub1, sub2])
            await db.flush()

            print("=== INITIAL STATE (05/09) ===")
            print(f"PO: {test_po_num}")
            print(f"Item: Qty={item.quantity}, Recv={item.received_qty}, Rem={item.remaining_qty}, EstQty={item.estimate_qty}")
            print(f"SubItem 1: Qty={sub1.quantity}, Date={sub1.estimate_date.strftime('%d/%m/%Y')}")
            print(f"SubItem 2: Qty={sub2.quantity}, Date={sub2.estimate_date.strftime('%d/%m/%Y')}")

            # Evening 05/09: 60 pcs delivered. Morning 06/09 SAP sync sends received_qty = 60:
            sap_records = [
                {
                    "po_number": test_po_num,
                    "line_num": 1,
                    "po_date": po_date,
                    "supplier_code": test_sup_code,
                    "supplier_name": "Supplier FIFO Test",
                    "item_code": test_item_code,
                    "item_name": "Item Test FIFO",
                    "buyer_name": "Buyer Test",
                    "quantity": 100.0,
                    "unit": "ชิ้น",
                    "received_qty": 60.0,
                    "remaining_qty": 40.0,
                    "due_date": po_date + timedelta(days=30),
                    "item_group": "HW",
                }
            ]

            await _process_and_save_sap_records(db, sap_records, triggered_by="test")
            await db.flush()

            # Verify results
            stmt = select(POItem).options(selectinload(POItem.sub_items), selectinload(POItem.audit_logs)).where(POItem.id == item.id)
            res = (await db.execute(stmt)).scalar_one()

            print("\n=== STATE AFTER SAP SYNC (06/09) ===")
            print(f"PO Item: Qty={res.quantity}, Recv={res.received_qty}, Rem={res.remaining_qty}, EstQty={res.estimate_qty}, EstDate={res.estimate_date.strftime('%d/%m/%Y')}")
            print(f"Remaining SubItems count: {len(res.sub_items)}")
            for s in res.sub_items:
                print(f" - SubItem {s.id}: Qty={s.quantity}, Date={s.estimate_date.strftime('%d/%m/%Y')}")

            # Assertions
            assert res.received_qty == 60.0, f"Expected received_qty=60, got {res.received_qty}"
            assert res.remaining_qty == 40.0, f"Expected remaining_qty=40, got {res.remaining_qty}"
            assert len(res.sub_items) == 1, f"Expected 1 sub-item remaining, got {len(res.sub_items)}"
            assert res.sub_items[0].quantity == 40.0, f"Expected sub-item qty=40, got {res.sub_items[0].quantity}"
            assert res.sub_items[0].estimate_date.strftime('%d/%m/%Y') == "11/09/2026", f"Expected date 11/09/2026, got {res.sub_items[0].estimate_date}"
            assert res.estimate_qty == 40.0, f"Expected parent estimate_qty=40, got {res.estimate_qty}"
            assert res.estimate_date.strftime('%d/%m/%Y') == "11/09/2026", f"Expected parent estimate_date 11/09/2026, got {res.estimate_date}"

            stmt_logs = select(POItemAuditLog).where(POItemAuditLog.po_item_id == item.id).order_by(POItemAuditLog.id.asc())
            logs = (await db.execute(stmt_logs)).scalars().all()
            assert len(logs) > 0, "Expected at least 1 audit log"
            print(f"\nAudit Log: {logs[-1].changes_detail}")
            print("\n[SUCCESS] ALL FIFO RECONCILIATION ASSERTIONS PASSED 100%!")

        finally:
            await db.rollback()
            print("Rollback test transaction completed cleanly.")

if __name__ == "__main__":
    asyncio.run(test_fifo_sync())
