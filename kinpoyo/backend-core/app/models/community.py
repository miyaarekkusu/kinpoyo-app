from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, SmallInteger, Boolean, DateTime, Text, String, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.master import PostType
    from app.models.workout import WorkoutSession


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Post(Base, TimestampMixin):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    post_type_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("post_types.id"), default=1, nullable=False
    )
    title: Mapped[Optional[str]] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    image_urls: Mapped[Optional[list]] = mapped_column(JSONB)
    workout_session_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("workout_sessions.id", ondelete="SET NULL")
    )
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    comments_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    user: Mapped["User"] = relationship(back_populates="posts")
    post_type: Mapped["PostType"] = relationship()
    workout_session: Mapped[Optional["WorkoutSession"]] = relationship()
    likes: Mapped[list["PostLike"]] = relationship(
        back_populates="post", cascade="all, delete-orphan"
    )
    comments: Mapped[list["PostComment"]] = relationship(
        back_populates="post", cascade="all, delete-orphan"
    )


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_likes_post_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )

    post: Mapped["Post"] = relationship(back_populates="likes")
    user: Mapped["User"] = relationship()


class PostComment(Base, TimestampMixin):
    __tablename__ = "post_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("post_comments.id", ondelete="CASCADE")
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    post: Mapped["Post"] = relationship(back_populates="comments")
    user: Mapped["User"] = relationship(back_populates="post_comments")
    parent: Mapped[Optional["PostComment"]] = relationship(
        "PostComment",
        back_populates="replies",
        foreign_keys="[PostComment.parent_id]",
        remote_side="[PostComment.id]",
    )
    replies: Mapped[list["PostComment"]] = relationship(
        "PostComment",
        back_populates="parent",
        foreign_keys="[PostComment.parent_id]",
        cascade="all, delete-orphan",
    )


class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = (
        UniqueConstraint("follower_id", "followee_id", name="uq_follows_pair"),
        CheckConstraint("follower_id <> followee_id", name="chk_no_self_follow"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    follower_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    followee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )

    follower: Mapped["User"] = relationship(
        foreign_keys=[follower_id], back_populates="following"
    )
    followee: Mapped["User"] = relationship(
        foreign_keys=[followee_id], back_populates="followers"
    )
