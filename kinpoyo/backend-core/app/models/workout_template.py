from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Integer, SmallInteger, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.exercise import Exercise


def _now() -> datetime:
    return datetime.now(timezone.utc)


class WorkoutTemplate(Base):
    """「My筋トレ」：よく行う筋トレメニューを保存し、カレンダーからワンタップで
    その日に登録できるようにする機能（2026-08-25追加）。

    既存のProgram/UserProgramは「1ユーザー1アクティブプログラムまで」という
    制約（app/crud/program.pyのAlreadyHasActiveProgramError）があり、繰り返し
    自由に適用したいテンプレートとは用途が競合するため、Program系とは独立した
    新規テーブルにした（AGENTS.md『My筋トレ』参照）。AIレビュー等には一切
    関連しない、単なる「よく使うセット構成のコピー元」。
    """
    __tablename__ = "workout_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )

    user: Mapped["User"] = relationship()
    exercises: Mapped[list["WorkoutTemplateExercise"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="WorkoutTemplateExercise.order_index",
    )


class WorkoutTemplateExercise(Base):
    __tablename__ = "workout_template_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    template_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workout_templates.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[int] = mapped_column(Integer, ForeignKey("exercises.id"), nullable=False)
    order_index: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)

    template: Mapped["WorkoutTemplate"] = relationship(back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship()
    sets: Mapped[list["WorkoutTemplateSet"]] = relationship(
        back_populates="template_exercise",
        cascade="all, delete-orphan",
        order_by="WorkoutTemplateSet.set_number",
    )


class WorkoutTemplateSet(Base):
    __tablename__ = "workout_template_sets"

    id: Mapped[int] = mapped_column(primary_key=True)
    template_exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workout_template_exercises.id", ondelete="CASCADE"), nullable=False
    )
    set_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    weight_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    reps: Mapped[Optional[int]] = mapped_column(SmallInteger)
    rest_after_sec: Mapped[Optional[int]] = mapped_column(Integer)

    template_exercise: Mapped["WorkoutTemplateExercise"] = relationship(back_populates="sets")
