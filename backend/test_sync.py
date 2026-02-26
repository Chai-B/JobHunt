import asyncio
from sqlalchemy import text
from app.db.session import AsyncSessionLocal

async def main():
    print("Initiating direct DB Constraint drop...")
    async with AsyncSessionLocal() as db:
        try:
            # Force the constraint off at the Postgres level
            await db.execute(text("ALTER TABLE applications ALTER COLUMN job_id DROP NOT NULL;"))
            await db.commit()
            print("Successfully dropped job_id NOT NULL constraint.")
        except Exception as e:
            print(f"Error dropping constraint: {e}")

if __name__ == "__main__":
    asyncio.run(main())
