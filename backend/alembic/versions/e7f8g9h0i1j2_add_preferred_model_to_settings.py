"""add_preferred_model_to_settings

Revision ID: e7f8g9h0i1j2
Revises: b594ac3d8a0c
Create Date: 2026-02-21 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7f8g9h0i1j2'
down_revision: Union[str, Sequence[str], None] = 'c1a2b3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user_settings', sa.Column('preferred_model', sa.String(), nullable=True, server_default='gemini-2.0-flash'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user_settings', 'preferred_model')
