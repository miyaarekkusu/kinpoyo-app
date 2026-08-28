from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

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
    duration_sec: Optional[int] = None
    exercises: list[HistoryExerciseSummary]


class AchievementsOut(BaseModel):
    """プロフィール画面の「実績」セクション用。全期間（累計）の集計値。"""
    total_volume: Decimal = Field(max_digits=10, decimal_places=2, examples=[1100.0])
    total_workouts: int
    total_duration_sec: int
    # 今週を含めて連続で、完了済みワークアウトが1回以上あった週の数
    weekly_streak: int


class ExerciseMaxCreate(BaseModel):
    """1RMの手入力登録（プロフィール画面のBIG3セクション「ここから登録」用）。"""
    exercise_id: int
    weight_kg: Decimal = Field(max_digits=6, decimal_places=2, examples=[100.0])
    recorded_at: Optional[date] = None  # 未指定なら今日の日付を使う


class ExerciseMaxOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercise_id: int
    weight_kg: Decimal = Field(max_digits=6, decimal_places=2, examples=[100.0])
    recorded_at: date


class Big3ExerciseOut(BaseModel):
    exercise_id: int
    exercise_name: str
    best_1rm_kg: Optional[Decimal] = Field(
        default=None, max_digits=6, decimal_places=2, examples=[100.0]
    )
    # 採用元。"workout"=ワークアウト履歴からの推定1RM、"manual"=手入力登録値
    source: Optional[Literal["workout", "manual"]] = None


class Big3Out(BaseModel):
    squat: Big3ExerciseOut
    bench: Big3ExerciseOut
    deadlift: Big3ExerciseOut
    # 3種目すべての自己ベストが分かっている場合のみ計算する（1つでも不明ならNone）
    total_kg: Optional[Decimal] = Field(
        default=None, max_digits=7, decimal_places=2, examples=[300.0]
    )
