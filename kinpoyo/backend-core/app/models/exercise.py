from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional, TYPE_CHECKING
from sqlalchemy import (
    Table, Column, Date, Integer, SmallInteger, String, Boolean, Text,
    DateTime, Numeric, ForeignKey,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.master import MuscleGroup, MovementCategory, EquipmentType
    from app.models.user import User

# M:N 中間テーブル（マップドクラスではなく Table オブジェクト）
exercise_secondary_muscles = Table(
    "exercise_secondary_muscles",
    Base.metadata,
    Column(
        "exercise_id",
        Integer,
        ForeignKey("exercises.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "muscle_group_id",
        SmallInteger,
        ForeignKey("muscle_groups.id"),
        primary_key=True,
    ),
)


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name_en: Mapped[Optional[str]] = mapped_column(String(100))
    description: Mapped[Optional[str]] = mapped_column(Text)
    primary_muscle_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("muscle_groups.id"), nullable=False
    )
    movement_category_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("movement_categories.id"), nullable=False
    )
    equipment_type_id: Mapped[Optional[int]] = mapped_column(
        SmallInteger, ForeignKey("equipment_types.id")
    )
    is_compound: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_cardio: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mediapipe_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    primary_muscle: Mapped["MuscleGroup"] = relationship(
        foreign_keys=[primary_muscle_id]
    )
    secondary_muscles: Mapped[list["MuscleGroup"]] = relationship(
        secondary=exercise_secondary_muscles,
    )
    movement_category: Mapped["MovementCategory"] = relationship()
    equipment_type: Mapped[Optional["EquipmentType"]] = relationship()


class RepCountModel(Base, TimestampMixin):
    """種目ごとの回数カウント設定（AI回数カウント機能用）。

    model-studio（変更禁止）で較正された RepModel.config_json の移植先。
    pose_records / ai_reviews とは別テーブルのため、AI処理テーブルの変更禁止
    ルールの対象外（AGENTS.md参照）。現状はシンプル版（ヒステリシス状態機械の
    閾値のみ）を想定しており、1レップ形状テンプレート・統計ゲートは含まない。
    """
    __tablename__ = "rep_count_models"

    id: Mapped[int] = mapped_column(primary_key=True)
    exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exercises.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    config_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="model-studio", nullable=False)
    mae: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2))
    exact_match_rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 3))
    session_count: Mapped[Optional[int]] = mapped_column(Integer)

    exercise: Mapped["Exercise"] = relationship()


class AiReviewPromptPart(Base, TimestampMixin):
    """AIレビュー用の差し替えパーツ（ベース＋パーツ差し替え方式のパーツ本体）。

    codeの命名規則：`{種目コード}_{観点}_{方向}`（例：squat_depth_shallow、
    squat_depth_good、squat_tempo_fast、squat_tempo_good）。判定ロジック
    （app/core/review_judge.py）はこのサフィックス規約でパーツを検索する。
    """
    __tablename__ = "ai_review_prompt_parts"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    exercise_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("exercises.id", ondelete="CASCADE")
    )
    label_ja: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt_fragment: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    exercise: Mapped[Optional["Exercise"]] = relationship()


class UserExerciseMax(Base):
    """ユーザーが手入力で登録した自己ベスト重量（1RM）。プロフィール画面の
    「BIG3の合計(1RM)」セクション用（2026-08-25追加）。ワークアウト履歴からの
    自動推定1RM（app/core/rpe_predictor.py・Epley式）と組み合わせて、
    大きい方をそのまま採用する（判定はapp/crud/exercise_max.py）。
    """
    __tablename__ = "user_exercise_maxes"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False
    )
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    recorded_at: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship()
    exercise: Mapped["Exercise"] = relationship()
