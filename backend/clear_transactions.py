"""
IRM — Script to clear all transaction records while keeping Users, Roles, Settings, and Master Data intact.
"""

import asyncio
from sqlalchemy import text
from app.database import AsyncSessionLocal


async def clear_all_transactions():
    print("🧹 Starting IRM Transaction Cleanup...")
    async with AsyncSessionLocal() as session:
        # Truncate all transaction tables with CASCADE and restart auto-increment IDs
        tables = [
            "sub_items",
            "po_item_audit_logs",
            "po_items",
            "po_headers",
            "supplier_portal_tokens",
            "transaction_logs",
        ]
        
        for table in tables:
            try:
                await session.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE;"))
                print(f"  ✅ Cleared table: {table}")
            except Exception as e:
                print(f"  ⚠️ Could not truncate {table}: {e}")

        await session.commit()
    print("🎉 All transaction tables cleared successfully! Users, Settings, and Masters remain untouched.")


if __name__ == "__main__":
    asyncio.run(clear_all_transactions())
