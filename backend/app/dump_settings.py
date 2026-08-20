import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.system_setting import SystemSetting

async def dump():
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(SystemSetting))
        rows = res.scalars().all()
        print("--- DATABASE SETTINGS DUMP ---")
        for row in rows:
            print(f"Key: {row.key} | Value: {row.value} | Category: {row.category}")
        print("-------------------------------")

if __name__ == "__main__":
    asyncio.run(dump())
