from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.community import Follow, Post, PostComment, PostLike
from app.models.master import PostType
from app.models.user import User
from app.schemas.community import (
    CommentCreate,
    CommentOut,
    FeedScope,
    PostAuthor,
    PostCreate,
    PostOut,
    PostTypeKey,
    PostUpdate,
)

_POST_LOAD_OPTIONS = (
    selectinload(Post.user).selectinload(User.profile),
    selectinload(Post.post_type),
)


def _author_out(user: User) -> PostAuthor:
    profile = user.profile
    return PostAuthor(
        id=user.id,
        username=user.username,
        display_name=profile.display_name if profile else None,
        avatar_url=profile.avatar_url if profile else None,
    )


def _post_type_id(db: Session, code: PostTypeKey) -> int:
    post_type = db.scalars(select(PostType).where(PostType.code == code)).first()
    if post_type is None:
        raise ValueError(f"unknown post type code: {code}")
    return post_type.id


def post_to_out(post: Post, current_user_id: int) -> PostOut:
    liked_by_me = any(like.user_id == current_user_id for like in post.likes)
    return PostOut(
        id=post.id,
        author=_author_out(post.user),
        post_type=post.post_type.code,
        title=post.title,
        body=post.body,
        image_urls=post.image_urls or [],
        workout_session_id=post.workout_session_id,
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


def get_post(db: Session, post_id: int) -> Optional[Post]:
    stmt = (
        select(Post)
        .where(Post.id == post_id)
        .options(*_POST_LOAD_OPTIONS, selectinload(Post.likes))
    )
    return db.scalars(stmt).first()


def list_posts(
    db: Session,
    post_type: PostTypeKey,
    scope: FeedScope,
    current_user_id: int,
) -> list[Post]:
    stmt = (
        select(Post)
        .join(Post.post_type)
        .where(PostType.code == post_type)
        .options(*_POST_LOAD_OPTIONS, selectinload(Post.likes))
        .order_by(Post.is_pinned.desc(), Post.created_at.desc())
    )
    if scope == "following":
        followee_ids = select(Follow.followee_id).where(Follow.follower_id == current_user_id)
        stmt = stmt.where(Post.user_id.in_(followee_ids))
    return list(db.scalars(stmt).all())


def create_post(db: Session, user_id: int, data: PostCreate) -> Post:
    post = Post(
        user_id=user_id,
        post_type_id=_post_type_id(db, data.post_type),
        title=data.title,
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
