"""add application enrichment fields

Revision ID: n1o2p3q4r5s6
Revises: m5n6o7p8q9r0
Create Date: 2026-02-26 21:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'n1o2p3q4r5s6'
down_revision = 'm5n6o7p8q9r0'
branch_labels = None
depends_on = None

def upgrade():
    with op.batch_alter_table('applications', schema=None) as batch_op:
        batch_op.add_column(sa.Column('contact_name', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('contact_email', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('contact_role', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('source_url', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('location', sa.String(), nullable=True))

def downgrade():
    with op.batch_alter_table('applications', schema=None) as batch_op:
        batch_op.drop_column('location')
        batch_op.drop_column('source_url')
        batch_op.drop_column('contact_role')
        batch_op.drop_column('contact_email')
        batch_op.drop_column('contact_name')
