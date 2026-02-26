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
    op.add_column('applications', sa.Column('contact_name', sa.String(), nullable=True))
    op.add_column('applications', sa.Column('contact_email', sa.String(), nullable=True))
    op.add_column('applications', sa.Column('contact_role', sa.String(), nullable=True))
    op.add_column('applications', sa.Column('source_url', sa.String(), nullable=True))
    op.add_column('applications', sa.Column('location', sa.String(), nullable=True))

def downgrade():
    op.drop_column('applications', 'location')
    op.drop_column('applications', 'source_url')
    op.drop_column('applications', 'contact_role')
    op.drop_column('applications', 'contact_email')
    op.drop_column('applications', 'contact_name')
