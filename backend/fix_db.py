import sys
sys.path.append("/app")
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text, inspect
from app.core.config import settings
from app.db.base import Base
# Import all models to ensure Base metadata is fully populated
from app.db.models import user, resume, template, scraper, job, contact, application, setting, action_log

async def migrate_missing_columns():
    async_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    engine = create_async_engine(
        async_url,
        connect_args={"prepared_statement_cache_size": 0, "statement_cache_size": 0}
    )

    async def _inspect_and_alter(conn):
        def sync_inspect(connection):
            inspector = inspect(connection)
            updates = []
            
            # Type mapping from SQLAlchemy to Postgres representation
            type_map = {
                "INTEGER": "INTEGER",
                "VARCHAR": "VARCHAR",
                "TEXT": "TEXT",
                "BOOLEAN": "BOOLEAN",
                "TIMESTAMP": "TIMESTAMP WITH TIME ZONE", # For DateTime(timezone=True)
                "DATETIME": "TIMESTAMP WITHOUT TIME ZONE",
                "JSONB": "JSONB",
                "BYTEA": "BYTEA",
                "FLOAT": "DOUBLE PRECISION"
            }

            for table_name, table in Base.metadata.tables.items():
                if not inspector.has_table(table_name):
                    print(f"Skipping missing table: {table_name}")
                    continue
                    
                existing_columns = {col['name'] for col in inspector.get_columns(table_name)}
                
                for column in table.columns:
                    if column.name not in existing_columns:
                        # Best effort type resolution
                        col_type = str(column.type).split("(")[0].upper()
                        pg_type = type_map.get(col_type, col_type)
                        
                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {pg_type};"
                        updates.append(alter_sql)
            
            return updates

        return await conn.run_sync(sync_inspect)

    try:
        async with engine.begin() as conn:
            missing_sqls = await _inspect_and_alter(conn)
            
            if not missing_sqls:
                print("Database is perfectly synced! No missing columns found.")
            else:
                for sql in missing_sqls:
                    print(f"Executing: {sql}")
                    await conn.execute(text(sql))
                print("\nSuccessfully applied all missing columns!")
                
    except Exception as e:
        print(f"Migration script crashed: {e}")

if __name__ == "__main__":
    asyncio.run(migrate_missing_columns())
