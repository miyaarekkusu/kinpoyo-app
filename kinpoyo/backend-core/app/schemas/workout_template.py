from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class WorkoutTemplateSetCreate(BaseModel):
    weight_kg: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=2, examples=[62.5])
    reps: Optional[int] = None
    rest_after_sec: Optional[int] = None


class WorkoutTemplateSetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    set_number: int
    weight_kg: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=2, examples=[62.5])
    reps: Optional[int] = None
    rest_after_sec: Optional[int] = None


class WorkoutTemplateExerciseCreate(BaseModel):
    exercise_id: int
    order_index: int = 0
    sets: list[WorkoutTemplateSetCreate] = Field(default_factory=list)


class WorkoutTemplateExerciseOut(BaseModel):
    id: int
    exercise_id: int
    exercise_name: str
    order_index: int
    sets: list[WorkoutTemplateSetOut] = Field(default_factory=list)


class WorkoutTemplateCreate(BaseModel):
    name: str
    exercises: list[WorkoutTemplateExerciseCreate] = Field(default_factory=list)


class WorkoutTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime
    exercises: list[WorkoutTemplateExerciseOut] = Field(default_factory=list)


class WorkoutTemplateListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime
    exercise_count: int


class WorkoutTemplateApply(BaseModel):
    scheduled_date: date
