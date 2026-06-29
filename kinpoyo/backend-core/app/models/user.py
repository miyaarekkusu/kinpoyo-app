from datetime import date
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Boolean, Date, Numeric, SmallInteger, Integer, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.master import Gender, DifficultyLevel
    from app.models.body import BodyGoal
    from app.models.workout import WorkoutSession
    from app.models.program import UserProgram
    from app.models.community import Post, PostComment, Follow


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    profile: Mapped[Optional["UserProfile"]] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    body_goals: Mapped[list["BodyGoal"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    workout_sessions: Mapped[list["WorkoutSession"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    user_programs: Mapped[list["UserProgram"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    posts: Mapped[list["Post"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    post_comments: Mapped[list["PostComment"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    following: Mapped[list["Follow"]] = relationship(
        foreign_keys="Follow.follower_id", back_populates="follower", cascade="all, delete-orphan"
    )
    followers: Mapped[list["Follow"]] = relationship(
        foreign_keys="Follow.followee_id", back_populates="followee", cascade="all, delete-orphan"
    )


class UserProfile(Base, TimestampMixin):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    display_name: Mapped[Optional[str]] = mapped_column(String(100))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    birth_date: Mapped[Optional[date]] = mapped_column(Date)
    gender_id: Mapped[Optional[int]] = mapped_column(SmallInteger, ForeignKey("genders.id"))
    height_cm: Mapped[Optional[float]] = mapped_column(Numeric(5, 1))
    weight_kg: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    body_fat_pct: Mapped[Optional[float]] = mapped_column(Numeric(4, 1))
    muscle_mass_kg: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    experience_level_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("difficulty_levels.id"), default=1
    )

    user: Mapped["User"] = relationship(back_populates="profile")
    gender: Mapped[Optional["Gender"]] = relationship()
    experience_level: Mapped["DifficultyLevel"] = relationship()
