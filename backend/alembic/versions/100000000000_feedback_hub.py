from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '100000000000'
down_revision = 'p3q4r5s6t7u8'
branch_labels = None
depends_on = None

def upgrade():
    # Drop existing feedbacks if it exists because of incompatible schema
    op.execute("DROP TABLE IF EXISTS feedbacks CASCADE")
    
    op.create_table(
        'feedbacks',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('title', sa.String(), nullable=False, index=True),
        sa.Column('type', sa.String(), nullable=False, index=True),
        sa.Column('status', sa.String(), nullable=False, default="Active", index=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('upvotes', sa.Integer(), default=0, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
    )

    op.create_table(
        'feedback_comments',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('feedback_id', sa.Integer(), sa.ForeignKey('feedbacks.id'), nullable=False, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.text('now()')),
    )

def downgrade():
    op.drop_table('feedback_comments')
    op.drop_table('feedbacks')
