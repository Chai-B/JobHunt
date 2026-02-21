"""add_llm_provider_fields

Revision ID: f8g9h0i1j2k3
Revises: e7f8g9h0i1j2
Create Date: 2026-02-21 14:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8g9h0i1j2k3'
down_revision: Union[str, Sequence[str], None] = 'e7f8g9h0i1j2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('user_settings', sa.Column('llm_provider', sa.String(), nullable=True, server_default='gemini'))
    op.add_column('user_settings', sa.Column('openai_api_key', sa.String(), nullable=True))
    op.add_column('user_settings', sa.Column('llm_base_url', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('user_settings', 'llm_base_url')
    op.drop_column('user_settings', 'openai_api_key')
    op.drop_column('user_settings', 'llm_provider')
