from typing import Optional
from sqlalchemy import SmallInteger, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Gender(Base):
    __tablename__ = "genders"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    name_ja: Mapped[str] = mapped_column(String(20), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)


class DifficultyLevel(Base):
    __tablename__ = "difficulty_levels"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name_ja: Mapped[str] = mapped_column(String(30), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)


class MuscleGroup(Base):
    __tablename__ = "muscle_groups"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name_ja: Mapped[str] = mapped_column(String(50), nullable=False)
    name_en: Mapped[str] = mapped_column(String(50), nullable=False)
    body_region: Mapped[str] = mapped_column(String(10), nullable=False)
    color_hex: Mapped[Optional[str]] = mapped_column(String(7))
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)


class MovementCategory(Base):
    __tablename__ = "movement_categories"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name_ja: Mapped[str] = mapped_column(String(30), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)


class EquipmentType(Base):
    __tablename__ = "equipment_types"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name_ja: Mapped[str] = mapped_column(String(50), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)


class MeasurementUnit(Base):
    __tablename__ = "measurement_units"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    symbol: Mapped[str] = mapped_column(String(5), nullable=False)
    unit_type: Mapped[str] = mapped_column(String(20), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)


class GoalType(Base):
    __tablename__ = "goal_types"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name_ja: Mapped[str] = mapped_column(String(50), nullable=False)
    default_unit_id: Mapped[Optional[int]] = mapped_column(
        SmallInteger, ForeignKey("measurement_units.id")
    )
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)

    default_unit: Mapped[Optional["MeasurementUnit"]] = relationship()


class ProgramCategory(Base):
    __tablename__ = "program_categories"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name_ja: Mapped[str] = mapped_column(String(50), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)


class UserProgramStatus(Base):
    __tablename__ = "user_program_statuses"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name_ja: Mapped[str] = mapped_column(String(30), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)


class PostType(Base):
    __tablename__ = "post_types"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name_ja: Mapped[str] = mapped_column(String(30), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)


class WorkoutSessionStatus(Base):
    __tablename__ = "workout_session_statuses"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name_ja: Mapped[str] = mapped_column(String(30), nullable=False)
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)
