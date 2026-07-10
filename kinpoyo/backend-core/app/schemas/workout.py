from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SessionSetCreate(BaseModel):
    set_number: Optional[int] = None
    weight_kg: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=2, examples=[62.5])
    reps: Optional[int] = None
    rpe: Optional[Decimal] = Field(default=None, max_digits=3, decimal_places=1, examples=[8.5])
    duration_sec: Optional[int] = None
    is_warmup: bool = False


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
    completed_at: Optional[datetime] = None


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
