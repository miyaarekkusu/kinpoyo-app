"""add rest_after_sec to session_sets

Revision ID: 9f4c2b7e1a3d
Revises: 85523731a0b2
Create Date: 2026-08-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '9f4c2b7e1a3d'
down_revision: Union[str, None] = '85523731a0b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('session_sets', sa.Column('rest_after_sec', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('session_sets', 'rest_after_sec')
