import asyncio
from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models.master import ItemMaster
from app.models.po import POItem

async def main():
    async with AsyncSessionLocal() as db:
        # Check item_masters
        res1 = await db.execute(select(ItemMaster.item_group, func.count(ItemMaster.id)).group_by(ItemMaster.item_group))
        print("=== item_masters table ===")
        for group, count in res1.all():
            print(f"Group in item_masters: '{group}' -> {count} items")

        # Check po_items
        res2 = await db.execute(select(POItem.item_group, func.count(POItem.id)).group_by(POItem.item_group))
        print("\n=== po_items table ===")
        for group, count in res2.all():
            print(f"Group in po_items: '{group}' -> {count} items")

if __name__ == "__main__":
    asyncio.run(main())
