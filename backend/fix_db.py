import sys
sys.path.append("/app")
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def main():
    # Force the asyncpg driver into the URL string to bypass psycopg2 requirement
    async_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(
        async_url, 
        connect_args={"prepared_statement_cache_size": 0, "statement_cache_size": 0}
    )
    async with engine.begin() as conn:
        try:
            await conn.execute(sa.text("ALTER TABLE resumes ADD COLUMN file_data BYTEA;"))
            print("Successfully added resumes.file_data column!")
        except Exception as e:
            print(f"Error (column might already exist): {e}")

if __name__ == "__main__":
    import sqlalchemy as sa
    asyncio.run(main())
