from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.exercise import RepCycleJson


class SessionSetCreate(BaseModel):
    set_number: Optional[int] = None
    weight_kg: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=2, examples=[62.5])
    reps: Optional[int] = None
    rpe: Optional[Decimal] = Field(default=None, max_digits=3, decimal_places=1, examples=[8.5])
    duration_sec: Optional[int] = None
    is_warmup: bool = False
    ai_counted_reps: Optional[int] = None
    rep_cycles_json: Optional[list[RepCycleJson]] = None
    rest_after_sec: Optional[int] = None


class SessionSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    set_number: int
    weight_kg: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=2, examples=[62.5])
    reps: Optional[int] = None
    rpe: Optional[Decimal] = Field(default=None, max_digits=3, decimal_places=1, examples=[8.5])
    duration_sec: Optional[int] = None
    is_warmup: bool
    ai_counted_reps: Optional[int] = None
    rep_cycles_json: Optional[list[RepCycleJson]] = None
    rest_after_sec: Optional[int] = None
    completed_at: Optional[datetime] = None


class SessionSetUpdate(BaseModel):
    """リトライ時の上書き保存用（部分更新）。未指定フィールドは変更しない。"""
    weight_kg: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=2, examples=[62.5])
    reps: Optional[int] = None
    rpe: Optional[Decimal] = Field(default=None, max_digits=3, decimal_places=1, examples=[8.5])
    duration_sec: Optional[int] = None
    is_warmup: Optional[bool] = None
    ai_counted_reps: Optional[int] = None
    rep_cycles_json: Optional[list[RepCycleJson]] = None
    rest_after_sec: Optional[int] = None


class SessionExerciseCreate(BaseModel):
    exercise_id: int
    order_index: int = 0
    target_sets: Optional[int] = None
    rest_interval_sec: Optional[int] = None
    memo: Optional[str] = None
    sets: list[SessionSetCreate] = Field(default_factory=list)


class SessionExerciseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_id: int
    exercise_name: str
    order_index: int
    target_sets: Optional[int] = None
    rest_interval_sec: Optional[int] = None
    memo: Optional[str] = None
    sets: list[SessionSetOut] = Field(default_factory=list)


class WorkoutSessionCreate(BaseModel):
    scheduled_date: date
    title: Optional[str] = None
    memo: Optional[str] = None
    exercises: list[SessionExerciseCreate] = Field(default_factory=list)


class WorkoutSessionUpdate(BaseModel):
    title: Optional[str] = None
    memo: Optional[str] = None
    scheduled_date: Optional[date] = None


class WorkoutSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status_id: int
    status_code: str
    title: Optional[str] = None
    memo: Optional[str] = None
    scheduled_date: Optional[date] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_sec: Optional[int] = None
    total_volume: Optional[Decimal] = Field(
        default=None, max_digits=10, decimal_places=2, examples=[1100.0]
    )
    exercises: list[SessionExerciseOut] = Field(default_factory=list)


class WorkoutSessionReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workout_session_id: int
    feedback_text: str
    matched_part_codes_json: Optional[list[str]] = None
    planned_vs_actual_json: Optional[dict] = None
    compared_session_id: Optional[int] = None
    model_version: str
    generated_at: datetime


class WorkoutSessionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status_id: int
    status_code: str
    title: Optional[str] = None
    scheduled_date: Optional[date] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    total_volume: Optional[Decimal] = Field(
        default=None, max_digits=10, decimal_places=2, examples=[1100.0]
    )
