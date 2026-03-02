"""Add source_url and location to job_postings

Revision ID: c1a2b3d4e5f6
Revises: 7d56848a4156
Create Date: 2026-02-21 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, Sequence[str]] = '7d56848a4156'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add source_url and location columns to job_postings."""
    op.add_column('job_postings', sa.Column('source_url', sa.String(), nullable=True))
    op.add_column('job_postings', sa.Column('location', sa.String(), nullable=True))


def downgrade() -> None:
    """Remove source_url and location columns from job_postings."""
    op.drop_column('job_postings', 'location')
    op.drop_column('job_postings', 'source_url')
