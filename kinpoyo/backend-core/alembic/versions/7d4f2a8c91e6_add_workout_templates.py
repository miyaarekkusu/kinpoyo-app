"""add workout templates tables (My筋トレ)

Revision ID: 7d4f2a8c91e6
Revises: 3a7c9e1f5b02
Create Date: 2026-08-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7d4f2a8c91e6'
down_revision: Union[str, None] = '3a7c9e1f5b02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('workout_templates',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_workout_templates_user_id', 'workout_templates', ['user_id'])

    op.create_table('workout_template_exercises',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('template_id', sa.Integer(), nullable=False),
    sa.Column('exercise_id', sa.Integer(), nullable=False),
    sa.Column('order_index', sa.SmallInteger(), nullable=False),
    sa.ForeignKeyConstraint(['template_id'], ['workout_templates.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id']),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_workout_template_exercises_template_id', 'workout_template_exercises', ['template_id'])

    op.create_table('workout_template_sets',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('template_exercise_id', sa.Integer(), nullable=False),
    sa.Column('set_number', sa.SmallInteger(), nullable=False),
    sa.Column('weight_kg', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('reps', sa.SmallInteger(), nullable=True),
    sa.Column('rest_after_sec', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['template_exercise_id'], ['workout_template_exercises.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_workout_template_sets_template_exercise_id', 'workout_template_sets', ['template_exercise_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_workout_template_sets_template_exercise_id', table_name='workout_template_sets')
    op.drop_table('workout_template_sets')
    op.drop_index('idx_workout_template_exercises_template_id', table_name='workout_template_exercises')
    op.drop_table('workout_template_exercises')
    op.drop_index('idx_workout_templates_user_id', table_name='workout_templates')
    op.drop_table('workout_templates')
