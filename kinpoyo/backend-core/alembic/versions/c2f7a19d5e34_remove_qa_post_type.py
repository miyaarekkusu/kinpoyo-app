"""remove qa post type and its posts (community redesign)

Revision ID: c2f7a19d5e34
Revises: b1c9e4f6a2d7
Create Date: 2026-08-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c2f7a19d5e34'
down_revision: Union[str, None] = 'b1c9e4f6a2d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema.

    コミュニティー再設計（AGENTS.md参照）：投稿を「その日の完了済み
    トレーニング記録」に限定する方針に伴い、Q&A投稿を廃止する。
    ユーザーの明示的な承認により、Q&A投稿データ・post_typesのqaレコードごと
    削除する（post_likes/post_commentsはpostsへのON DELETE CASCADEで
    連鎖削除される）。
    """
    op.execute(
        "DELETE FROM posts WHERE post_type_id = (SELECT id FROM post_types WHERE code = 'qa')"
    )
    op.execute("DELETE FROM post_types WHERE code = 'qa'")


def downgrade() -> None:
    """Downgrade schema.

    post_typesのqaレコードのみ復元する（削除済みの投稿データそのものは
    復元できない）。
    """
    op.execute(
        "INSERT INTO post_types (id, code, name_ja, sort_order) "
        "VALUES (2, 'qa', 'Q&A', 2) ON CONFLICT (id) DO NOTHING"
    )
