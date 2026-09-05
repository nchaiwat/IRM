"""
Migration script:
1. Ensure `created_at` column exists on `po_items` and `po_headers`.
2. Clear `is_new = False` on all existing items that were created before today or during earlier initial imports.
3. Keep only items created today with is_new = True (if any).
"""

import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from app.database import engine, AsyncSessionLocal

async def run_migration():
    print("🚀 Starting fix_is_new_migration...")
    async with engine.begin() as conn:
        # Check and add created_at column to po_items if not present
        await conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'po_items' AND column_name = 'created_at'
                ) THEN
                    ALTER TABLE po_items ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
                    RAISE NOTICE 'Added created_at column to po_items';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'po_headers' AND column_name = 'created_at'
                ) THEN
                    ALTER TABLE po_headers ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
                    RAISE NOTICE 'Added created_at column to po_headers';
                END IF;
            END $$;
        """))
        print("✅ Columns verified.")

    # Now update po_items: set is_new = False for all existing records that are older than today
    async with AsyncSessionLocal() as session:
        bkk_tz = timezone(timedelta(hours=7))
        now_bkk = datetime.now(bkk_tz)
        today_start = now_bkk.replace(hour=0, minute=0, second=0, microsecond=0)

        # Update items
        result = await session.execute(text("""
            UPDATE po_items 
            SET is_new = false 
            WHERE is_new = true AND (created_at IS NULL OR created_at < :today_start)
        """), {"today_start": today_start})
        
        await session.commit()
        print(f"✅ Reset {result.rowcount} po_items to is_new = false.")

        # Update sap_sync_time to 06:45
        await session.execute(text("""
            UPDATE system_settings
            SET value = '06:45'
            WHERE key = 'sap_sync_time' AND value = '04:00'
        """))
        await session.commit()

        # Check current counts
        res_new = await session.execute(text("SELECT count(*) FROM po_items WHERE is_new = true"))
        res_unconf = await session.execute(text("SELECT count(*) FROM po_items WHERE is_new = false AND status != 'confirmed'"))
        res_conf = await session.execute(text("SELECT count(*) FROM po_items WHERE status = 'confirmed'"))
        
        new_cnt = res_new.scalar()
        unconf_cnt = res_unconf.scalar()
        conf_cnt = res_conf.scalar()
        print(f"📊 Current PO Items Status: New Today = {new_cnt}, Unconfirmed = {unconf_cnt}, Confirmed = {conf_cnt}")

if __name__ == "__main__":
    asyncio.run(run_migration())
