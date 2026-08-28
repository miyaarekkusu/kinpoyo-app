from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.crud import exercise_max as exercise_max_crud
from app.crud import record as record_crud
from app.models.user import User
from app.schemas.record import (
    AchievementsOut,
    Big3Out,
    ExerciseMaxCreate,
    ExerciseMaxOut,
    HistoryItem,
    HistoryPeriodKey,
    MaxWeightOut,
    PeriodKey,
    VolumeSummaryOut,
)

router = APIRouter(prefix="/records", tags=["records"])


@router.get("/summary", response_model=VolumeSummaryOut)
def get_summary(
    period: PeriodKey,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return record_crud.get_volume_summary(db, current_user.id, period)


@router.get("/max-weight", response_model=MaxWeightOut)
def get_max_weight(
    exercise_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = record_crud.get_max_weight(db, current_user.id, exercise_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="この種目の記録が見つかりません"
        )
    return result


@router.get("/history", response_model=list[HistoryItem])
def get_history(
    period: HistoryPeriodKey = "all",
    muscle_group_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return record_crud.get_history(db, current_user.id, period, muscle_group_id)


@router.get("/achievements", response_model=AchievementsOut)
def get_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """プロフィール画面の「実績」セクション用（総ボリューム・合計ワークアウト数・
    トレーニング時間・週間ストリーク、いずれも全期間累計）。"""
    return record_crud.get_achievements(db, current_user.id)


@router.get("/big3", response_model=Big3Out)
def get_big3(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """プロフィール画面の「BIG3の合計(1RM)」セクション用。ワークアウト履歴からの
    推定1RMと手入力登録値のうち大きい方を種目ごとに採用する。"""
    return exercise_max_crud.get_big3(db, current_user.id)


@router.post(
    "/exercise-max",
    response_model=ExerciseMaxOut,
    status_code=status.HTTP_201_CREATED,
)
def create_exercise_max(
    data: ExerciseMaxCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """1RM（自己ベスト重量）の手入力登録。「BIG3の合計(1RM)」カードから遷移。"""
    row = exercise_max_crud.create_exercise_max(db, current_user.id, data)
    return ExerciseMaxOut.model_validate(row)
