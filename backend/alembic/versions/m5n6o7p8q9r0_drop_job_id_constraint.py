"""drop job_id not null constraint

Revision ID: m5n6o7p8q9r0
Revises: b2c3d4e5f6g7
Create Date: 2026-02-26 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm5n6o7p8q9r0'
down_revision: Union[str, None] = 'g9h0i1j2k3l4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the NOT NULL constraint on job_id using asyncpg/postgresql syntax
    op.alter_column('applications', 'job_id',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade() -> None:
    # Re-add the NOT NULL constraint (though this might fail if data exists)
    op.alter_column('applications', 'job_id',
               existing_type=sa.INTEGER(),
               nullable=False)
