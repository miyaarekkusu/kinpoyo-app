from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.workout import SessionExercise, SessionSet, WorkoutSession
from app.schemas.workout import (
    SessionExerciseCreate,
    SessionExerciseOut,
    SessionSetCreate,
    SessionSetOut,
    WorkoutSessionCreate,
    WorkoutSessionOut,
    WorkoutSessionUpdate,
)

STATUS_SCHEDULED = 1
STATUS_IN_PROGRESS = 2
STATUS_COMPLETED = 3
STATUS_CANCELLED = 4

_SESSION_LOAD_OPTIONS = (
    selectinload(WorkoutSession.status),
    selectinload(WorkoutSession.session_exercises).selectinload(SessionExercise.exercise),
    selectinload(WorkoutSession.session_exercises).selectinload(SessionExercise.sets),
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def session_to_out(session: WorkoutSession) -> WorkoutSessionOut:
    return WorkoutSessionOut(
        id=session.id,
        status_id=session.status_id,
        status_code=session.status.code,
        title=session.title,
        memo=session.memo,
        scheduled_date=session.scheduled_date,
        started_at=session.started_at,
        ended_at=session.ended_at,
        duration_sec=session.duration_sec,
        total_volume=session.total_volume,
        exercises=[
            SessionExerciseOut(
                id=se.id,
                exercise_id=se.exercise_id,
                exercise_name=se.exercise.name,
                order_index=se.order_index,
                target_sets=se.target_sets,
                rest_interval_sec=se.rest_interval_sec,
                memo=se.memo,
                sets=[SessionSetOut.model_validate(s) for s in se.sets],
            )
            for se in sorted(session.session_exercises, key=lambda x: x.order_index)
        ],
    )


def get_session(db: Session, session_id: int) -> Optional[WorkoutSession]:
    stmt = (
        select(WorkoutSession)
        .where(WorkoutSession.id == session_id)
        .options(*_SESSION_LOAD_OPTIONS)
    )
    return db.scalars(stmt).first()


def get_sessions_by_date(db: Session, user_id: int, target_date: date) -> list[WorkoutSession]:
    stmt = (
        select(WorkoutSession)
        .where(WorkoutSession.user_id == user_id, WorkoutSession.scheduled_date == target_date)
        .options(*_SESSION_LOAD_OPTIONS)
        .order_by(WorkoutSession.created_at)
    )
    return list(db.scalars(stmt).all())


def create_session(db: Session, user_id: int, data: WorkoutSessionCreate) -> WorkoutSession:
    session = WorkoutSession(
        user_id=user_id,
        status_id=STATUS_SCHEDULED,
        title=data.title,
        memo=data.memo,
        scheduled_date=data.scheduled_date,
    )
    db.add(session)
    db.flush()  # session.id を確定させる

    for ex_index, ex_in in enumerate(data.exercises):
        session_exercise = SessionExercise(
            session_id=session.id,
            exercise_id=ex_in.exercise_id,
            order_index=ex_in.order_index or ex_index,
            target_sets=ex_in.target_sets,
            rest_interval_sec=ex_in.rest_interval_sec,
            memo=ex_in.memo,
        )
        db.add(session_exercise)
        db.flush()

        for set_index, set_in in enumerate(ex_in.sets, start=1):
            db.add(
                SessionSet(
                    session_exercise_id=session_exercise.id,
                    set_number=set_in.set_number or set_index,
                    weight_kg=set_in.weight_kg,
                    reps=set_in.reps,
                    rpe=set_in.rpe,
                    duration_sec=set_in.duration_sec,
                    is_warmup=set_in.is_warmup,
                )
            )

    db.commit()
    return get_session(db, session.id)


def update_session(db: Session, session: WorkoutSession, data: WorkoutSessionUpdate) -> WorkoutSession:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(session, field, value)
    db.commit()
    return get_session(db, session.id)


def cancel_session(db: Session, session: WorkoutSession) -> None:
    # 履歴を残すため物理削除ではなくキャンセル状態にする（DATABASE.md 4.6 状態遷移ルール）
    session.status_id = STATUS_CANCELLED
    db.commit()


def start_session(db: Session, session: WorkoutSession) -> WorkoutSession:
    session.status_id = STATUS_IN_PROGRESS
    session.started_at = _now()
    db.commit()
    return get_session(db, session.id)


def end_session(db: Session, session: WorkoutSession) -> WorkoutSession:
    ended_at = _now()
    started_at = session.started_at or ended_at
    duration_sec = int((ended_at - started_at).total_seconds())

    total_volume = Decimal("0")
    for se in session.session_exercises:
        for s in se.sets:
            if s.is_warmup or s.weight_kg is None or s.reps is None:
                continue
            total_volume += s.weight_kg * s.reps

    session.status_id = STATUS_COMPLETED
    session.ended_at = ended_at
    session.duration_sec = duration_sec
    session.total_volume = total_volume
    db.commit()
    return get_session(db, session.id)


def add_exercise(db: Session, session_id: int, data: SessionExerciseCreate) -> SessionExercise:
    session_exercise = SessionExercise(
        session_id=session_id,
        exercise_id=data.exercise_id,
        order_index=data.order_index,
        target_sets=data.target_sets,
        rest_interval_sec=data.rest_interval_sec,
        memo=data.memo,
    )
    db.add(session_exercise)
    db.flush()

    for set_index, set_in in enumerate(data.sets, start=1):
        db.add(
            SessionSet(
                session_exercise_id=session_exercise.id,
                set_number=set_in.set_number or set_index,
                weight_kg=set_in.weight_kg,
                reps=set_in.reps,
                rpe=set_in.rpe,
                duration_sec=set_in.duration_sec,
                is_warmup=set_in.is_warmup,
            )
        )
    db.commit()
    db.refresh(session_exercise)
    return session_exercise


def get_session_exercise(db: Session, session_id: int, session_exercise_id: int) -> Optional[SessionExercise]:
    stmt = select(SessionExercise).where(
        SessionExercise.id == session_exercise_id,
        SessionExercise.session_id == session_id,
    )
    return db.scalars(stmt).first()


def add_set(db: Session, session_exercise: SessionExercise, data: SessionSetCreate) -> SessionSet:
    next_number = data.set_number or (len(session_exercise.sets) + 1)
    session_set = SessionSet(
        session_exercise_id=session_exercise.id,
        set_number=next_number,
        weight_kg=data.weight_kg,
        reps=data.reps,
        rpe=data.rpe,
        duration_sec=data.duration_sec,
        is_warmup=data.is_warmup,
    )
    db.add(session_set)
    db.commit()
    db.refresh(session_set)
    return session_set
