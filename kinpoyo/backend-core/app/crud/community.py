from datetime import date, timezone
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.community import Follow, Post, PostComment, PostLike
from app.models.user import User
from app.models.workout import SessionExercise, WorkoutSession
from app.schemas.community import (
    CommentCreate,
    CommentOut,
    FeedScope,
    PostAuthor,
    PostableSessionExercise,
    PostableSessionOut,
    PostCreate,
    PostOut,
    PostUpdate,
    PostWorkoutExercise,
    PostWorkoutSummary,
)

# workout.py・record.py・program.pyと同じローカル定数（DBの
# workout_session_statusesマスタと対応。共通の定数モジュールが無いため踏襲）。
STATUS_COMPLETED = 3

_POST_LOAD_OPTIONS = (
    selectinload(Post.user).selectinload(User.profile),
    selectinload(Post.workout_session)
    .selectinload(WorkoutSession.session_exercises)
    .selectinload(SessionExercise.exercise),
    selectinload(Post.workout_session)
    .selectinload(WorkoutSession.session_exercises)
    .selectinload(SessionExercise.sets),
)


class WorkoutSessionNotFoundError(Exception):
    pass


class WorkoutSessionNotOwnedError(Exception):
    pass


class WorkoutSessionNotCompletedError(Exception):
    pass


class WorkoutSessionNotTodayError(Exception):
    pass


class AlreadyPostedError(Exception):
    """2026-08-30追加：1トレーニング記録につき投稿は1件まで（同じ記録を
    何度も投稿できてしまうと「その日の記録」という前提が崩れるため）。"""
    pass


def _author_out(user: User) -> PostAuthor:
    profile = user.profile
    return PostAuthor(
        id=user.id,
        username=user.username,
        display_name=profile.display_name if profile else None,
        avatar_url=profile.avatar_url if profile else None,
    )


def _workout_summary_out(session: Optional[WorkoutSession]) -> Optional[PostWorkoutSummary]:
    """2026-08-30追加：投稿に紐づくWorkoutSessionから、投稿カード表示用の
    サマリーを決定的に組み立てる（AIには生成させない。判定と文章生成の分離は
    AIレビュー機能と同じ方針）。"""
    if session is None:
        return None
    exercises: list[PostWorkoutExercise] = []
    for se in sorted(session.session_exercises, key=lambda e: e.order_index):
        sets = se.sets
        total_reps = sum((s.reps or 0) for s in sets)
        weights = [float(s.weight_kg) for s in sets if s.weight_kg is not None]
        exercises.append(
            PostWorkoutExercise(
                exercise_name=se.exercise.name,
                sets_count=len(sets),
                total_reps=total_reps,
                max_weight_kg=max(weights) if weights else None,
            )
        )
    return PostWorkoutSummary(
        scheduled_date=session.scheduled_date,
        duration_sec=session.duration_sec,
        total_volume=float(session.total_volume) if session.total_volume is not None else None,
        exercises=exercises,
    )


def post_to_out(post: Post, current_user_id: int) -> PostOut:
    liked_by_me = any(like.user_id == current_user_id for like in post.likes)
    return PostOut(
        id=post.id,
        author=_author_out(post.user),
        title=post.title,
        body=post.body,
        image_urls=post.image_urls or [],
        workout_session_id=post.workout_session_id,
        workout_summary=_workout_summary_out(post.workout_session),
        is_pinned=post.is_pinned,
        likes_count=post.likes_count,
        comments_count=post.comments_count,
        liked_by_me=liked_by_me,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


def comment_to_out(comment: PostComment) -> CommentOut:
    return CommentOut(
        id=comment.id,
        post_id=comment.post_id,
        author=_author_out(comment.user),
        parent_id=comment.parent_id,
        body=comment.body,
        likes_count=comment.likes_count,
        created_at=comment.created_at,
    )


def list_postable_sessions(db: Session, user_id: int) -> list[WorkoutSession]:
    """2026-08-30追加：投稿作成画面用。今日の自分の完了済みトレーニング記録の
    うち、まだ投稿していないものだけを返す（1記録1投稿までのため、既に
    投稿済みの記録は選択肢から除外する）。"""
    posted_session_ids = select(Post.workout_session_id).where(
        Post.workout_session_id.is_not(None)
    )
    stmt = (
        select(WorkoutSession)
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status_id == STATUS_COMPLETED,
            WorkoutSession.scheduled_date == date.today(),
            WorkoutSession.id.not_in(posted_session_ids),
        )
        .options(
            selectinload(WorkoutSession.session_exercises).selectinload(
                SessionExercise.exercise
            ),
            selectinload(WorkoutSession.session_exercises).selectinload(
                SessionExercise.sets
            ),
        )
        .order_by(WorkoutSession.ended_at.desc())
    )
    return list(db.scalars(stmt).all())


def postable_session_to_out(session: WorkoutSession) -> PostableSessionOut:
    return PostableSessionOut(
        id=session.id,
        scheduled_date=session.scheduled_date,
        duration_sec=session.duration_sec,
        total_volume=float(session.total_volume) if session.total_volume is not None else None,
        exercises=[
            PostableSessionExercise(
                exercise_name=se.exercise.name,
                sets_count=len(se.sets),
            )
            for se in sorted(session.session_exercises, key=lambda e: e.order_index)
        ],
    )


def get_post(db: Session, post_id: int) -> Optional[Post]:
    stmt = (
        select(Post)
        .where(Post.id == post_id)
        .options(*_POST_LOAD_OPTIONS, selectinload(Post.likes))
    )
    return db.scalars(stmt).first()


def list_posts(db: Session, scope: FeedScope, current_user_id: int) -> list[Post]:
    stmt = (
        select(Post)
        .options(*_POST_LOAD_OPTIONS, selectinload(Post.likes))
        .order_by(Post.is_pinned.desc(), Post.created_at.desc())
    )
    if scope == "following":
        # 2026-08-30：フォロー中タブに統合するにあたり、自分自身は自分を
        # フォローしていないため自分の投稿が一覧から消えてしまう問題を回避
        # するため、自分の投稿は常に含める（AGENTS.md参照）。
        followee_ids = select(Follow.followee_id).where(Follow.follower_id == current_user_id)
        stmt = stmt.where(or_(Post.user_id.in_(followee_ids), Post.user_id == current_user_id))
    return list(db.scalars(stmt).all())


def create_post(db: Session, user_id: int, data: PostCreate) -> Post:
    """2026-08-30再設計：投稿は必ず「今日実施した、自分の完了済みトレーニング
    記録」に紐づける。過去の記録・他人の記録・未完了の記録からは投稿できない
    （AGENTS.md『コミュニティー再設計』参照）。"""
    session = db.get(WorkoutSession, data.workout_session_id)
    if session is None:
        raise WorkoutSessionNotFoundError()
    if session.user_id != user_id:
        raise WorkoutSessionNotOwnedError()
    if session.status_id != STATUS_COMPLETED:
        raise WorkoutSessionNotCompletedError()
    session_date = session.scheduled_date or (
        session.ended_at.astimezone(timezone.utc).date() if session.ended_at else None
    )
    if session_date != date.today():
        raise WorkoutSessionNotTodayError()

    existing = db.scalars(
        select(Post).where(Post.workout_session_id == data.workout_session_id)
    ).first()
    if existing is not None:
        raise AlreadyPostedError()

    post = Post(
        user_id=user_id,
        body=data.body,
        image_urls=data.image_urls or None,
        workout_session_id=data.workout_session_id,
    )
    db.add(post)
    db.commit()
    return get_post(db, post.id)


def update_post(db: Session, post: Post, data: PostUpdate) -> Post:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    db.commit()
    return get_post(db, post.id)


def delete_post(db: Session, post: Post) -> None:
    db.delete(post)
    db.commit()


def like_post(db: Session, post: Post, user_id: int) -> Post:
    existing = db.scalars(
        select(PostLike).where(PostLike.post_id == post.id, PostLike.user_id == user_id)
    ).first()
    if existing is None:
        db.add(PostLike(post_id=post.id, user_id=user_id))
        post.likes_count += 1
        db.commit()
    return get_post(db, post.id)


def unlike_post(db: Session, post: Post, user_id: int) -> Post:
    existing = db.scalars(
        select(PostLike).where(PostLike.post_id == post.id, PostLike.user_id == user_id)
    ).first()
    if existing is not None:
        db.delete(existing)
        post.likes_count = max(0, post.likes_count - 1)
        db.commit()
    return get_post(db, post.id)


def add_comment(db: Session, post: Post, user_id: int, data: CommentCreate) -> PostComment:
    comment = PostComment(
        post_id=post.id,
        user_id=user_id,
        parent_id=data.parent_id,
        body=data.body,
    )
    db.add(comment)
    post.comments_count += 1
    db.commit()
    db.refresh(comment)
    return comment


def list_comments(db: Session, post_id: int) -> list[PostComment]:
    stmt = (
        select(PostComment)
        .where(PostComment.post_id == post_id)
        .options(selectinload(PostComment.user).selectinload(User.profile))
        .order_by(PostComment.created_at)
    )
    return list(db.scalars(stmt).all())
