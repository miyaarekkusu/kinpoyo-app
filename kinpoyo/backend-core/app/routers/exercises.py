from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.deps import get_db
from app.crud import exercise as exercise_crud
from app.schemas.exercise import ExerciseOut

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseOut])
def list_exercises(db: Session = Depends(get_db)):
    return [exercise_crud.exercise_to_out(e) for e in exercise_crud.list_exercises(db)]
