"""add_resume_file_data

Revision ID: g9h0i1j2k3l4
Revises: a1b2c3d4e5f7
Create Date: 2024-05-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g9h0i1j2k3l4'
down_revision: Union[str, None] = 'a1b2c3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Intentionally left blank. This is a stub to repair a broken migration tree.
    pass


def downgrade() -> None:
    pass
