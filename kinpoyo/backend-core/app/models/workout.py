from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import (
    Integer, SmallInteger, Numeric, Boolean, Date, DateTime,
    Text, String, ForeignKey,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.master import WorkoutSessionStatus
    from app.models.exercise import Exercise


def _now() -> datetime:
    return datetime.now(timezone.utc)


class WorkoutSession(Base, TimestampMixin):
    __tablename__ = "workout_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("workout_session_statuses.id"), default=1, nullable=False
    )
    title: Mapped[Optional[str]] = mapped_column(String(100))
    memo: Mapped[Optional[str]] = mapped_column(Text)
    scheduled_date: Mapped[Optional[date]] = mapped_column(Date)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    duration_sec: Mapped[Optional[int]] = mapped_column(Integer)
    total_volume: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))

    user: Mapped["User"] = relationship(back_populates="workout_sessions")
    status: Mapped["WorkoutSessionStatus"] = relationship()
    session_exercises: Mapped[list["SessionExercise"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class SessionExercise(Base):
    __tablename__ = "session_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workout_sessions.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exercises.id"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    target_sets: Mapped[Optional[int]] = mapped_column(SmallInteger)
    rest_interval_sec: Mapped[Optional[int]] = mapped_column(Integer)
    memo: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )

    session: Mapped["WorkoutSession"] = relationship(back_populates="session_exercises")
    exercise: Mapped["Exercise"] = relationship()
    sets: Mapped[list["SessionSet"]] = relationship(
        back_populates="session_exercise", cascade="all, delete-orphan"
    )
    ai_review: Mapped[Optional["AiReview"]] = relationship(
        back_populates="session_exercise", uselist=False
    )


class SessionSet(Base):
    __tablename__ = "session_sets"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("session_exercises.id", ondelete="CASCADE"), nullable=False
    )
    set_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    weight_kg: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    reps: Mapped[Optional[int]] = mapped_column(SmallInteger)
    rpe: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 1))
    duration_sec: Mapped[Optional[int]] = mapped_column(Integer)
    is_warmup: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ai_counted_reps: Mapped[Optional[int]] = mapped_column(SmallInteger)
    rep_cycles_json: Mapped[Optional[list]] = mapped_column(JSONB)
    # このセットの後に取る休憩時間（秒）。2026-08-24、セットごとにカスタムな休憩を
    # 挟めるようにするため session_exercises.rest_interval_sec（種目単位・一律）から
    # こちらへ移行。未設定ならworkout-camera.tsx側は手動再開ボタンにフォールバックする。
    rest_after_sec: Mapped[Optional[int]] = mapped_column(Integer)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )

    session_exercise: Mapped["SessionExercise"] = relationship(back_populates="sets")
    pose_records: Mapped[list["PoseRecord"]] = relationship(
        back_populates="session_set", cascade="all, delete-orphan"
    )


# ── AI処理テーブル — 変更禁止 ────────────────────────────────────

class PoseRecord(Base):
    """MediaPipe ポーズデータ — AI処理テーブル（変更禁止）"""
    __tablename__ = "pose_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_set_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("session_sets.id", ondelete="CASCADE"), nullable=False
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    landmarks_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    joint_angles_json: Mapped[Optional[dict]] = mapped_column(JSONB)
    rep_count_snapshot: Mapped[Optional[int]] = mapped_column(SmallInteger)
    frame_index: Mapped[int] = mapped_column(Integer, nullable=False)

    session_set: Mapped["SessionSet"] = relationship(back_populates="pose_records")


class AiReview(Base):
    """DeepSeek API フォームレビュー"""
    __tablename__ = "ai_reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("session_exercises.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    model_version: Mapped[str] = mapped_column(
        String(50), default="deepseek-chat", nullable=False
    )
    prompt_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    completion_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    overall_score: Mapped[Optional[int]] = mapped_column(SmallInteger)
    feedback_text: Mapped[str] = mapped_column(Text, nullable=False)
    strengths_json: Mapped[Optional[dict]] = mapped_column(JSONB)
    improvements_json: Mapped[Optional[dict]] = mapped_column(JSONB)
    injury_risk_level: Mapped[Optional[str]] = mapped_column(String(10))
    matched_part_codes_json: Mapped[Optional[dict]] = mapped_column(JSONB)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )

    session_exercise: Mapped["SessionExercise"] = relationship(back_populates="ai_review")


class WorkoutSessionReport(Base):
    """DeepSeek API 筋トレ全体（複数種目にまたがる）のAIレビュー・実績レポート。
    DATABASE.md 4.20参照。種目ごとのAiReviewとは別テーブル。"""
    __tablename__ = "workout_session_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    workout_session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workout_sessions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    feedback_text: Mapped[str] = mapped_column(Text, nullable=False)
    matched_part_codes_json: Mapped[Optional[list]] = mapped_column(JSONB)
    planned_vs_actual_json: Mapped[Optional[dict]] = mapped_column(JSONB)
    compared_session_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("workout_sessions.id", ondelete="SET NULL")
    )
    model_version: Mapped[str] = mapped_column(
        String(50), default="deepseek-chat", nullable=False
    )
    prompt_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    completion_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, nullable=False
    )

    workout_session: Mapped["WorkoutSession"] = relationship(foreign_keys=[workout_session_id])
    compared_session: Mapped[Optional["WorkoutSession"]] = relationship(foreign_keys=[compared_session_id])
