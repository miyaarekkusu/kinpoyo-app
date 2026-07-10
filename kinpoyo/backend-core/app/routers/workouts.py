from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.crud import workout as workout_crud
from app.models.user import User
from app.models.workout import WorkoutSession
from app.schemas.workout import (
    SessionExerciseCreate,
    SessionExerciseOut,
    SessionSetCreate,
    SessionSetOut,
    WorkoutSessionCreate,
    WorkoutSessionOut,
    WorkoutSessionUpdate,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])


def _get_owned_session(db: Session, session_id: int, user: User) -> WorkoutSession:
    session = workout_crud.get_session(db, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="セッションが見つかりません")
    return session


@router.post("", response_model=WorkoutSessionOut, status_code=status.HTTP_201_CREATED)
def create_workout(
    data: WorkoutSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = workout_crud.create_session(db, current_user.id, data)
    return workout_crud.session_to_out(session)


@router.get("", response_model=list[WorkoutSessionOut])
def list_workouts_by_date(
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = workout_crud.get_sessions_by_date(db, current_user.id, date)
    return [workout_crud.session_to_out(s) for s in sessions]


@router.get("/{session_id}", response_model=WorkoutSessionOut)
def get_workout(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user)
    return workout_crud.session_to_out(session)


@router.put("/{session_id}", response_model=WorkoutSessionOut)
def update_workout(
    session_id: int,
    data: WorkoutSessionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user)
    session = workout_crud.update_session(db, session, data)
    return workout_crud.session_to_out(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user)
    workout_crud.cancel_session(db, session)


@router.post("/{session_id}/start", response_model=WorkoutSessionOut)
def start_workout(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user)
    if session.status_id != workout_crud.STATUS_SCHEDULED:
        raise HTTPException(status_code=400, detail="予定済みのセッションのみ開始できます")
    session = workout_crud.start_session(db, session)
    return workout_crud.session_to_out(session)


@router.post("/{session_id}/end", response_model=WorkoutSessionOut)
def end_workout(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user)
    if session.status_id != workout_crud.STATUS_IN_PROGRESS:
        raise HTTPException(status_code=400, detail="実施中のセッションのみ終了できます")
    session = workout_crud.end_session(db, session)
    return workout_crud.session_to_out(session)


@router.post(
    "/{session_id}/exercises", response_model=SessionExerciseOut, status_code=status.HTTP_201_CREATED
)
def add_workout_exercise(
    session_id: int,
    data: SessionExerciseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user)
    session_exercise = workout_crud.add_exercise(db, session.id, data)
    return SessionExerciseOut(
        id=session_exercise.id,
        exercise_id=session_exercise.exercise_id,
        exercise_name=session_exercise.exercise.name,
        order_index=session_exercise.order_index,
        target_sets=session_exercise.target_sets,
        rest_interval_sec=session_exercise.rest_interval_sec,
        memo=session_exercise.memo,
        sets=[SessionSetOut.model_validate(s) for s in session_exercise.sets],
    )


@router.post(
    "/{session_id}/exercises/{exercise_id}/sets",
    response_model=SessionSetOut,
    status_code=status.HTTP_201_CREATED,
)
def add_workout_set(
    session_id: int,
    exercise_id: int,
    data: SessionSetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_session(db, session_id, current_user)
    session_exercise = workout_crud.get_session_exercise(db, session_id, exercise_id)
    if session_exercise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="種目が見つかりません")
    return workout_crud.add_set(db, session_exercise, data)
