"""add user_exercise_maxes table

Revision ID: 3a7c9e1f5b02
Revises: 9f4c2b7e1a3d
Create Date: 2026-08-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3a7c9e1f5b02'
down_revision: Union[str, None] = '9f4c2b7e1a3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('user_exercise_maxes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('exercise_id', sa.Integer(), nullable=False),
    sa.Column('weight_kg', sa.Numeric(precision=6, scale=2), nullable=False),
    sa.Column('recorded_at', sa.Date(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_user_exercise_maxes_user_id', 'user_exercise_maxes', ['user_id'])
    op.create_index('idx_user_exercise_maxes_exercise_id', 'user_exercise_maxes', ['exercise_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_user_exercise_maxes_exercise_id', table_name='user_exercise_maxes')
    op.drop_index('idx_user_exercise_maxes_user_id', table_name='user_exercise_maxes')
    op.drop_table('user_exercise_maxes')
