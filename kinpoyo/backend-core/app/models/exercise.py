from datetime import datetime, timezone
from typing import Optional, TYPE_CHECKING
from sqlalchemy import (
    Table, Column, Integer, SmallInteger, String, Boolean, Text,
    DateTime, ForeignKey,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.master import MuscleGroup, MovementCategory, EquipmentType

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
