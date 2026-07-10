from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field

PeriodKey = Literal["week", "month", "year"]
HistoryPeriodKey = Literal["all", "month", "week"]


class VolumeSummaryPoint(BaseModel):
    period_start: date
    volume: Decimal = Field(max_digits=10, decimal_places=2, examples=[1100.0])
    session_count: int


class VolumeSummaryOut(BaseModel):
    period: PeriodKey
    points: list[VolumeSummaryPoint]
    total_volume: Decimal = Field(max_digits=10, decimal_places=2, examples=[1100.0])
    total_sessions: int


class MaxWeightPoint(BaseModel):
    session_date: date
    max_weight_kg: Decimal = Field(max_digits=6, decimal_places=2, examples=[62.5])


class MaxWeightOut(BaseModel):
    exercise_id: int
    exercise_name: str
    points: list[MaxWeightPoint]


class HistoryExerciseSummary(BaseModel):
    exercise_id: int
    exercise_name: str
    muscle_group_id: int
    muscle_group_name: str
    muscle_group_color: Optional[str] = None
    sets_count: int
    max_weight_kg: Optional[Decimal] = Field(
        default=None, max_digits=6, decimal_places=2, examples=[62.5]
    )


class HistoryItem(BaseModel):
    session_id: int
    scheduled_date: Optional[date] = None
    title: Optional[str] = None
    exercises: list[HistoryExerciseSummary]
