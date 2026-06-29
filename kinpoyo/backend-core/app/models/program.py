from datetime import date, datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, SmallInteger, Boolean, Date, DateTime, Text, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.master import ProgramCategory, DifficultyLevel, UserProgramStatus
    from app.models.exercise import Exercise


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Program(Base, TimestampMixin):
    __tablename__ = "programs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category_id: Mapped[Optional[int]] = mapped_column(
        SmallInteger, ForeignKey("program_categories.id")
    )
    difficulty_level_id: Mapped[Optional[int]] = mapped_column(
        SmallInteger, ForeignKey("difficulty_levels.id")
    )
    duration_weeks: Mapped[Optional[int]] = mapped_column(SmallInteger)
    frequency_per_week: Mapped[Optional[int]] = mapped_column(SmallInteger)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL")
    )

    category: Mapped[Optional["ProgramCategory"]] = relationship()
    difficulty_level: Mapped[Optional["DifficultyLevel"]] = relationship()
    creator: Mapped[Optional["User"]] = relationship(foreign_keys=[created_by])
    exercises: Mapped[list["ProgramExercise"]] = relationship(
        back_populates="program", cascade="all, delete-orphan"
    )
    user_programs: Mapped[list["UserProgram"]] = relationship(
        back_populates="program", cascade="all, delete-orphan"
    )


class ProgramExercise(Base):
    __tablename__ = "program_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    program_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("programs.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exercises.id"), nullable=False
    )
    week_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    day_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    order_index: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    sets: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    reps_min: Mapped[Optional[int]] = mapped_column(SmallInteger)
    reps_max: Mapped[Optional[int]] = mapped_column(SmallInteger)
    rest_interval_sec: Mapped[Optional[int]] = mapped_column(Integer)
    note: Mapped[Optional[str]] = mapped_column(Text)

    program: Mapped["Program"] = relationship(back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship()


class UserProgram(Base, TimestampMixin):
    __tablename__ = "user_programs"
    __table_args__ = (UniqueConstraint("user_id", "program_id", name="uq_user_programs_user_program"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    program_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("programs.id", ondelete="CASCADE"), nullable=False
    )
    status_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("user_program_statuses.id"), default=1, nullable=False
    )
    current_week: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    current_day: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)
    started_at: Mapped[date] = mapped_column(Date, nullable=False)
    completed_at: Mapped[Optional[date]] = mapped_column(Date)

    user: Mapped["User"] = relationship(back_populates="user_programs")
    program: Mapped["Program"] = relationship(back_populates="user_programs")
    status: Mapped["UserProgramStatus"] = relationship()
