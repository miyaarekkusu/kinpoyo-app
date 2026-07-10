from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.crud import record as record_crud
from app.models.user import User
from app.schemas.record import HistoryItem, HistoryPeriodKey, MaxWeightOut, PeriodKey, VolumeSummaryOut

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
