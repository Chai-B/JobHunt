"""add user_id to scraped_contacts and email_templates

Revision ID: o2p3q4r5s6t7
Revises: n1o2p3q4r5s6
Create Date: 2026-02-27 10:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'o2p3q4r5s6t7'
down_revision: Union[str, None] = 'n1o2p3q4r5s6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add user_id to scraped_contacts
    op.add_column('scraped_contacts', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_scraped_contacts_user_id'), 'scraped_contacts', ['user_id'], unique=False)
    op.create_foreign_key('fk_scraped_contacts_user_id_users', 'scraped_contacts', 'users', ['user_id'], ['id'])

    # Add user_id to email_templates
    op.add_column('email_templates', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_email_templates_user_id'), 'email_templates', ['user_id'], unique=False)
    op.create_foreign_key('fk_email_templates_user_id_users', 'email_templates', 'users', ['user_id'], ['id'])


def downgrade() -> None:
    # Drop from email_templates
    op.drop_constraint('fk_email_templates_user_id_users', 'email_templates', type_='foreignkey')
    op.drop_index(op.f('ix_email_templates_user_id'), table_name='email_templates')
    op.drop_column('email_templates', 'user_id')

    # Drop from scraped_contacts
    op.drop_constraint('fk_scraped_contacts_user_id_users', 'scraped_contacts', type_='foreignkey')
    op.drop_index(op.f('ix_scraped_contacts_user_id'), table_name='scraped_contacts')
    op.drop_column('scraped_contacts', 'user_id')
