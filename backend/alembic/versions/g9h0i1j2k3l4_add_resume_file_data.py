"""Add resume file_data Postgres

Revision ID: g9h0i1j2k3l4
Revises: f8g9h0i1j2k3
Create Date: 2026-02-26 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g9h0i1j2k3l4'
down_revision: Union[str, None] = 'f8g9h0i1j2k3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add LargeBinary column to the resumes table for PostgreSQL natively
    # Using LargeBinary maps to BYTEA in Postgres.
    op.add_column('resumes', sa.Column('file_data', sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    # Remove the file_data column
    op.drop_column('resumes', 'file_data')
