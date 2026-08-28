"""add workout session reports table

Revision ID: 85523731a0b2
Revises: 963b8002fa04
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '85523731a0b2'
down_revision: Union[str, None] = '963b8002fa04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('workout_session_reports',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('workout_session_id', sa.Integer(), nullable=False),
    sa.Column('feedback_text', sa.Text(), nullable=False),
    sa.Column('matched_part_codes_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('planned_vs_actual_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('compared_session_id', sa.Integer(), nullable=True),
    sa.Column('model_version', sa.String(length=50), nullable=False),
    sa.Column('prompt_tokens', sa.Integer(), nullable=True),
    sa.Column('completion_tokens', sa.Integer(), nullable=True),
    sa.Column('generated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['workout_session_id'], ['workout_sessions.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['compared_session_id'], ['workout_sessions.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('workout_session_id', name='uq_workout_session_reports_workout_session_id')
    )
    op.create_index('uq_workout_session_reports_session_id', 'workout_session_reports', ['workout_session_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('uq_workout_session_reports_session_id', table_name='workout_session_reports')
    op.drop_table('workout_session_reports')
