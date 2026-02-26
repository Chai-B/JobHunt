import sys
sys.path.append("/app")
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        try:
            await conn.execute(sa.text("ALTER TABLE user_settings ADD COLUMN last_inbox_sync_time TIMESTAMP WITH TIME ZONE;"))
            print("Successfully added last_inbox_sync_time column!")
        except Exception as e:
            print(f"Error (column might already exist): {e}")

if __name__ == "__main__":
    import sqlalchemy as sa
    asyncio.run(main())
