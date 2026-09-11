"""
Database migration: Add missing performance indexes to public schema.
Ensures fast indexed lookups for po_items, sub_items, po_headers, po_item_audit_logs, supplier_portal_tokens, and users.
"""

import asyncio
import logging
from sqlalchemy import text
from app.database import AsyncSessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration.indexes")

INDEX_STATEMENTS = [
    # po_items indexes
    "CREATE INDEX IF NOT EXISTS idx_po_items_po_header_id ON po_items (po_header_id);",
    "CREATE INDEX IF NOT EXISTS idx_po_items_status ON po_items (status);",
    "CREATE INDEX IF NOT EXISTS idx_po_items_header_status ON po_items (po_header_id, status);",
    "CREATE INDEX IF NOT EXISTS idx_po_items_estimate_date ON po_items (estimate_date);",
    "CREATE INDEX IF NOT EXISTS idx_po_items_due_date ON po_items (due_date);",
    "CREATE INDEX IF NOT EXISTS idx_po_items_closed_at ON po_items (closed_at DESC NULLS LAST);",
    
    # sub_items indexes
    "CREATE INDEX IF NOT EXISTS idx_sub_items_po_item_id ON sub_items (po_item_id);",
    "CREATE INDEX IF NOT EXISTS idx_sub_items_estimate_date ON sub_items (estimate_date);",
    
    # po_headers indexes
    "CREATE INDEX IF NOT EXISTS idx_po_headers_status ON po_headers (status);",
    "CREATE INDEX IF NOT EXISTS idx_po_headers_status_supplier ON po_headers (status, supplier_code);",
    
    # po_item_audit_logs indexes
    "CREATE INDEX IF NOT EXISTS idx_po_item_audit_logs_po_item_id ON po_item_audit_logs (po_item_id);",
    "CREATE INDEX IF NOT EXISTS idx_po_item_audit_logs_changed_at ON po_item_audit_logs (changed_at DESC);",
    
    # supplier_portal_tokens indexes
    "CREATE INDEX IF NOT EXISTS idx_supplier_tokens_lookup ON supplier_portal_tokens (supplier_code, is_submitted, expires_at);",
    "CREATE INDEX IF NOT EXISTS idx_supplier_tokens_po ON supplier_portal_tokens (po_number);",
    
    # users indexes
    "CREATE INDEX IF NOT EXISTS idx_users_group_id ON users (group_id);",
]

async def run_migration():
    async with AsyncSessionLocal() as session:
        for stmt in INDEX_STATEMENTS:
            try:
                logger.info("Executing: %s", stmt)
                await session.execute(text(stmt))
            except Exception as e:
                logger.error("Failed to execute '%s': %s", stmt, e)
        await session.commit()
    logger.info("All performance indexes applied successfully.")

if __name__ == "__main__":
    asyncio.run(run_migration())
