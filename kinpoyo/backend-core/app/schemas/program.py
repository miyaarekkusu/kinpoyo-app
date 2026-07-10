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
