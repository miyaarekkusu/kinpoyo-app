"""add ai review feature tables

Revision ID: 963b8002fa04
Revises: f3a1c9b2e7d4
Create Date: 2026-08-24 09:53:08.210444

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '963b8002fa04'
down_revision: Union[str, None] = 'f3a1c9b2e7d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 手動で整理: autogenerateが検出した大量のインデックスdrop/createは、既存の
    # インデックス群がSQLAlchemyモデル側にIndex()として宣言されておらず、過去の
    # マイグレーション（a1b2c3d4e5f6_add_indexes_and_constraints.py）でop.create_index()
    # により直接作成されたことによる無関係な検出漏れ（drift）のため除去し、
    # このタスクで実際に必要な変更のみを残した。
    op.create_table('ai_review_prompt_parts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=50), nullable=False),
    sa.Column('exercise_id', sa.Integer(), nullable=True),
    sa.Column('label_ja', sa.String(length=100), nullable=False),
    sa.Column('prompt_fragment', sa.Text(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code', name='uq_ai_review_prompt_parts_code')
    )
    op.create_index('idx_ai_review_prompt_parts_exercise_id', 'ai_review_prompt_parts', ['exercise_id'])
    op.add_column('ai_reviews', sa.Column('matched_part_codes_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('session_sets', sa.Column('rep_cycles_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('session_sets', 'rep_cycles_json')
    op.drop_column('ai_reviews', 'matched_part_codes_json')
    op.drop_index('idx_ai_review_prompt_parts_exercise_id', table_name='ai_review_prompt_parts')
    op.drop_table('ai_review_prompt_parts')
