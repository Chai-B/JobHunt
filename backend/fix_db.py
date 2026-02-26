import sys
import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text, inspect
from loguru import logger

# Ensure we can import app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append("/app")

try:
    from app.core.config import settings
    from app.db.base import Base
    # Import all models to ensure Base metadata is fully populated
    from app.db.models import user, resume, email_template, job_posting, contact, application, setting, action_log
except ImportError as e:
    print(f"Import Error: {e}. Ensure script is run from backend directory.")
    sys.exit(1)

async def sync_db_schema():
    """
    Forcefully syncs the physical Postgres schema with SQLAlchemy models.
    Bypasses Alembic for critical hotfixes like the job_id constraint.
    """
    db_url = settings.DATABASE_URL
    if not db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")
    
    engine = create_async_engine(
        db_url,
        connect_args={"prepared_statement_cache_size": 0, "statement_cache_size": 0}
    )

    async with engine.begin() as conn:
        print("\n" + "="*40)
        print("DATABASE SCHEMA RECOVERY TOOL")
        print("="*40)
        
        # 1. Critical Hotfix: applications.job_id NOT NULL
        print("\nStep 1: Checking applications table constraints...")
        try:
            # Using raw SQL to be absolutely certain we bypass any SQLAlchemy cached state
            await conn.execute(text("ALTER TABLE applications ALTER COLUMN job_id DROP NOT NULL;"))
            print("SUCCESS: 'job_id' is now NULLABLE (if it wasn't already).")
        except Exception as e:
            print(f"INFO: Constraint modification skipped: {e}")

        # 2. Synchronize missing columns
        print("\nStep 2: Checking for missing columns across all tables...")
        
        def sync_inspect(connection):
            inspector = inspect(connection)
            updates = []
            
            # Type mapping from SQLAlchemy to Postgres representation
            type_map = {
                "INTEGER": "INTEGER",
                "VARCHAR": "VARCHAR",
                "TEXT": "TEXT",
                "BOOLEAN": "BOOLEAN",
                "TIMESTAMP": "TIMESTAMP WITH TIME ZONE",
                "JSONB": "JSONB",
                "BYTEA": "BYTEA",
                "FLOAT": "DOUBLE PRECISION"
            }

            for table_name, table in Base.metadata.tables.items():
                if not inspector.has_table(table_name):
                    continue
                    
                existing_columns = {col['name'] for col in inspector.get_columns(table_name)}
                
                for column in table.columns:
                    if column.name not in existing_columns:
                        # Extract base type name
                        col_type = str(column.type).split("(")[0].upper()
                        pg_type = type_map.get(col_type, col_type)
                        
                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {column.name} {pg_type};"
                        updates.append(alter_sql)
            
            return updates

        missing_sqls = await conn.run_sync(sync_inspect)
        
        if not missing_sqls:
            print("Result: No missing columns detected.")
        else:
            print(f"Found {len(missing_sqls)} missing column(s). Applying...")
            for sql in missing_sqls:
                try:
                    print(f"  > Executing: {sql}")
                    await conn.execute(text(sql))
                except Exception as loop_e:
                    print(f"  ! Failed to apply {sql}: {loop_e}")

        print("\n" + "="*40)
        print("SCHEMA RECOVERY COMPLETE")
        print("="*40 + "\n")

if __name__ == "__main__":
    asyncio.run(sync_db_schema())
