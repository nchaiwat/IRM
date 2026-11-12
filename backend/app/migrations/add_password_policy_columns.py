"""
Database Migration: Add password_changed_at and must_change_password columns to users table.
Part of Enterprise Central IAM Integration v2.12.0 (90-Day Forced Password Rotation & Local Password Policy).
"""

import asyncio
from sqlalchemy import text
from app.database import engine


async def run_migration():
    async with engine.begin() as conn:
        print("Checking and adding password policy columns in 'users' table...")
        await conn.execute(
            text(
                """
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE users 
                SET password_changed_at = COALESCE(created_at, CURRENT_TIMESTAMP) 
                WHERE password_changed_at IS NULL;
                """
            )
        )
        print("✅ Password policy migration completed successfully.")


if __name__ == "__main__":
    asyncio.run(run_migration())
