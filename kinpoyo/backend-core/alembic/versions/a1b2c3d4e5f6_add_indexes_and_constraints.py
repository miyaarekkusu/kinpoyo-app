"""add_indexes_and_constraints

Revision ID: a1b2c3d4e5f6
Revises: e2d6e0372f16
Create Date: 2026-06-29 00:00:00.000000

DATABASE.md 指定の全インデックスと user_programs の UNIQUE 制約を追加。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'e2d6e0372f16'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── body_goals ─────────────────────────────────────────────────────
    op.create_index('idx_body_goals_user_id', 'body_goals', ['user_id'])
    op.create_index('idx_body_goals_user_type', 'body_goals', ['user_id', 'goal_type_id'])

    # ── exercises ──────────────────────────────────────────────────────
    op.create_index('idx_exercises_primary_muscle_id', 'exercises', ['primary_muscle_id'])
    op.create_index('idx_exercises_movement_category_id', 'exercises', ['movement_category_id'])
    op.create_index('idx_exercises_equipment_type_id', 'exercises', ['equipment_type_id'])

    # ── exercise_secondary_muscles ─────────────────────────────────────
    op.create_index('idx_esm_exercise_id', 'exercise_secondary_muscles', ['exercise_id'])
    op.create_index('idx_esm_muscle_group_id', 'exercise_secondary_muscles', ['muscle_group_id'])

    # ── workout_sessions ───────────────────────────────────────────────
    op.create_index('idx_workout_sessions_user_id', 'workout_sessions', ['user_id'])
    op.create_index(
        'idx_workout_sessions_user_started',
        'workout_sessions',
        ['user_id', sa.text('started_at DESC')],
    )
    op.create_index('idx_workout_sessions_user_date', 'workout_sessions', ['user_id', 'scheduled_date'])
    op.create_index('idx_workout_sessions_status_id', 'workout_sessions', ['status_id'])

    # ── session_exercises ──────────────────────────────────────────────
    op.create_index('idx_session_exercises_session_id', 'session_exercises', ['session_id'])
    op.create_index('idx_session_exercises_exercise_id', 'session_exercises', ['exercise_id'])

    # ── session_sets ───────────────────────────────────────────────────
    op.create_index('idx_session_sets_session_exercise_id', 'session_sets', ['session_exercise_id'])

    # ── pose_records ───────────────────────────────────────────────────
    op.create_index('idx_pose_records_session_set_id', 'pose_records', ['session_set_id'])
    op.create_index('idx_pose_records_recorded_at', 'pose_records', ['recorded_at'])

    # ── ai_reviews ─────────────────────────────────────────────────────
    op.create_index('idx_ai_reviews_generated_at', 'ai_reviews', ['generated_at'])

    # ── programs ───────────────────────────────────────────────────────
    op.create_index('idx_programs_category_id', 'programs', ['category_id'])
    op.create_index('idx_programs_difficulty_level_id', 'programs', ['difficulty_level_id'])

    # ── program_exercises ──────────────────────────────────────────────
    op.create_index('idx_program_exercises_program_id', 'program_exercises', ['program_id'])
    op.create_index(
        'idx_program_exercises_week_day',
        'program_exercises',
        ['program_id', 'week_number', 'day_number'],
    )

    # ── user_programs ──────────────────────────────────────────────────
    op.create_unique_constraint(
        'uq_user_programs_user_program', 'user_programs', ['user_id', 'program_id']
    )
    op.create_index('idx_user_programs_user_id', 'user_programs', ['user_id'])
    op.create_index('idx_user_programs_program_id', 'user_programs', ['program_id'])

    # ── posts ──────────────────────────────────────────────────────────
    op.create_index('idx_posts_user_id', 'posts', ['user_id'])
    op.create_index('idx_posts_created_at', 'posts', [sa.text('created_at DESC')])
    op.create_index(
        'idx_posts_post_type_id',
        'posts',
        ['post_type_id', sa.text('created_at DESC')],
    )

    # ── post_likes ─────────────────────────────────────────────────────
    op.create_index('idx_post_likes_user_id', 'post_likes', ['user_id'])

    # ── post_comments ──────────────────────────────────────────────────
    op.create_index('idx_post_comments_post_id', 'post_comments', ['post_id'])
    op.create_index('idx_post_comments_user_id', 'post_comments', ['user_id'])
    op.create_index('idx_post_comments_parent_id', 'post_comments', ['parent_id'])

    # ── follows ────────────────────────────────────────────────────────
    op.create_index('idx_follows_follower_id', 'follows', ['follower_id'])
    op.create_index('idx_follows_followee_id', 'follows', ['followee_id'])


def downgrade() -> None:
    op.drop_index('idx_follows_followee_id', 'follows')
    op.drop_index('idx_follows_follower_id', 'follows')

    op.drop_index('idx_post_comments_parent_id', 'post_comments')
    op.drop_index('idx_post_comments_user_id', 'post_comments')
    op.drop_index('idx_post_comments_post_id', 'post_comments')

    op.drop_index('idx_post_likes_user_id', 'post_likes')

    op.drop_index('idx_posts_post_type_id', 'posts')
    op.drop_index('idx_posts_created_at', 'posts')
    op.drop_index('idx_posts_user_id', 'posts')

    op.drop_index('idx_user_programs_program_id', 'user_programs')
    op.drop_index('idx_user_programs_user_id', 'user_programs')
    op.drop_constraint('uq_user_programs_user_program', 'user_programs', type_='unique')

    op.drop_index('idx_program_exercises_week_day', 'program_exercises')
    op.drop_index('idx_program_exercises_program_id', 'program_exercises')

    op.drop_index('idx_programs_difficulty_level_id', 'programs')
    op.drop_index('idx_programs_category_id', 'programs')

    op.drop_index('idx_ai_reviews_generated_at', 'ai_reviews')

    op.drop_index('idx_pose_records_recorded_at', 'pose_records')
    op.drop_index('idx_pose_records_session_set_id', 'pose_records')

    op.drop_index('idx_session_sets_session_exercise_id', 'session_sets')

    op.drop_index('idx_session_exercises_exercise_id', 'session_exercises')
    op.drop_index('idx_session_exercises_session_id', 'session_exercises')

    op.drop_index('idx_workout_sessions_status_id', 'workout_sessions')
    op.drop_index('idx_workout_sessions_user_date', 'workout_sessions')
    op.drop_index('idx_workout_sessions_user_started', 'workout_sessions')
    op.drop_index('idx_workout_sessions_user_id', 'workout_sessions')

    op.drop_index('idx_esm_muscle_group_id', 'exercise_secondary_muscles')
    op.drop_index('idx_esm_exercise_id', 'exercise_secondary_muscles')

    op.drop_index('idx_exercises_equipment_type_id', 'exercises')
    op.drop_index('idx_exercises_movement_category_id', 'exercises')
    op.drop_index('idx_exercises_primary_muscle_id', 'exercises')

    op.drop_index('idx_body_goals_user_type', 'body_goals')
    op.drop_index('idx_body_goals_user_id', 'body_goals')
