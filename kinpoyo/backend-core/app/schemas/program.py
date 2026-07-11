from datetime import date
from typing import Optional

from pydantic import BaseModel


class ProgramOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    difficulty_level_id: Optional[int] = None
    difficulty_name: Optional[str] = None
    duration_weeks: Optional[int] = None
    frequency_per_week: Optional[int] = None
    thumbnail_url: Optional[str] = None
    is_public: bool


class UserProgramOut(BaseModel):
    id: int
    program_id: int
    program_name: str
    status_id: int
    status_code: str
    current_week: int
    current_day: int
    started_at: date
    completed_at: Optional[date] = None


class UserProgramStatusUpdate(BaseModel):
    status_id: int


class ProgramExerciseOut(BaseModel):
    id: int
    exercise_id: int
    exercise_name: str
    week_number: int
    day_number: int
    order_index: int
    sets: int
    reps_min: Optional[int] = None
    reps_max: Optional[int] = None
    rest_interval_sec: Optional[int] = None
    note: Optional[str] = None


class ProgramExerciseCreate(BaseModel):
    exercise_id: int
    sets: int
    reps_min: Optional[int] = None
    reps_max: Optional[int] = None
    note: Optional[str] = None


class ProgramCreate(BaseModel):
    name: str
    description: Optional[str] = None
    exercises: list[ProgramExerciseCreate]
