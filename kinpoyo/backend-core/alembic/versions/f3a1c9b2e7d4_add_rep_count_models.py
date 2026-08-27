"""add_rep_count_models

Revision ID: f3a1c9b2e7d4
Revises: a1b2c3d4e5f6
Create Date: 2026-08-13 00:00:00.000000

AI回数カウント機能用。種目ごとの回数カウント設定（model-studioで較正された
RepModel.config_jsonの移植先）を保存する rep_count_models を追加。
pose_records / ai_reviews とは別テーブルのため、AI処理テーブルの変更禁止
ルール（AGENTS.md）の対象外。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'f3a1c9b2e7d4'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'rep_count_models',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column(
            'exercise_id', sa.Integer(),
            sa.ForeignKey('exercises.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('config_json', postgresql.JSONB(), nullable=False),
        sa.Column(
            'source', sa.String(length=20), nullable=False,
            server_default='model-studio',
        ),
        sa.Column('mae', sa.Numeric(5, 2), nullable=True),
        sa.Column('exact_match_rate', sa.Numeric(4, 3), nullable=True),
        sa.Column('session_count', sa.Integer(), nullable=True),
        sa.Column(
            'created_at', sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text('now()'),
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True), nullable=False,
            server_default=sa.text('now()'),
        ),
    )
    op.create_unique_constraint(
        'uq_rep_count_models_exercise_id', 'rep_count_models', ['exercise_id']
    )
    op.create_index(
        'idx_rep_count_models_exercise_id', 'rep_count_models', ['exercise_id']
    )


def downgrade() -> None:
    op.drop_index('idx_rep_count_models_exercise_id', 'rep_count_models')
    op.drop_constraint(
        'uq_rep_count_models_exercise_id', 'rep_count_models', type_='unique'
    )
    op.drop_table('rep_count_models')
