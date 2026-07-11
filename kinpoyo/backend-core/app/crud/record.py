from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession, selectinload

from app.models.workout import SessionExercise, WorkoutSession
from app.schemas.record import (
    HistoryExerciseSummary,
    HistoryItem,
    HistoryPeriodKey,
    MaxWeightOut,
    MaxWeightPoint,
    PeriodKey,
    VolumeSummaryOut,
    VolumeSummaryPoint,
)

STATUS_CANCELLED = 4


def _completed_sessions_in_range(
    db: DbSession, user_id: int, start: date, end: date
) -> list[WorkoutSession]:
    stmt = select(WorkoutSession).where(
        WorkoutSession.user_id == user_id,
        WorkoutSession.status_id != STATUS_CANCELLED,
        WorkoutSession.scheduled_date.is_not(None),
        WorkoutSession.scheduled_date >= start,
        WorkoutSession.scheduled_date <= end,
    )
    return list(db.scalars(stmt).all())


def get_volume_summary(db: DbSession, user_id: int, period: PeriodKey) -> VolumeSummaryOut:
    today = date.today()

    if period == "week":
        start = today - timedelta(days=6)
        sessions = _completed_sessions_in_range(db, user_id, start, today)
        buckets: dict[date, list[WorkoutSession]] = {
            start + timedelta(days=i): [] for i in range(7)
        }
        for s in sessions:
            buckets[s.scheduled_date].append(s)
        points = [
            VolumeSummaryPoint(
                period_start=d,
                volume=sum((s.total_volume or Decimal("0")) for s in items),
                session_count=len(items),
            )
            for d, items in buckets.items()
        ]

    elif period == "month":
        start = today.replace(day=1)
        sessions = _completed_sessions_in_range(db, user_id, start, today)
        week_count = ((today.day - 1) // 7) + 1
        buckets = {i: [] for i in range(1, week_count + 1)}
        for s in sessions:
            week_no = ((s.scheduled_date.day - 1) // 7) + 1
            buckets.setdefault(week_no, []).append(s)
        points = [
            VolumeSummaryPoint(
                period_start=start + timedelta(days=(week_no - 1) * 7),
                volume=sum((s.total_volume or Decimal("0")) for s in items),
                session_count=len(items),
            )
            for week_no, items in sorted(buckets.items())
        ]

    else:  # year
        start = today.replace(month=1, day=1)
        sessions = _completed_sessions_in_range(db, user_id, start, today)
        buckets = {m: [] for m in range(1, today.month + 1)}
        for s in sessions:
            buckets.setdefault(s.scheduled_date.month, []).append(s)
        points = [
            VolumeSummaryPoint(
                period_start=date(today.year, m, 1),
                volume=sum((s.total_volume or Decimal("0")) for s in items),
                session_count=len(items),
            )
            for m, items in sorted(buckets.items())
        ]

    return VolumeSummaryOut(
        period=period,
        points=points,
        total_volume=sum((p.volume for p in points), Decimal("0")),
        total_sessions=sum(p.session_count for p in points),
    )


def get_max_weight(db: DbSession, user_id: int, exercise_id: int) -> Optional[MaxWeightOut]:
    stmt = (
        select(WorkoutSession)
        .join(WorkoutSession.session_exercises)
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status_id != STATUS_CANCELLED,
            WorkoutSession.scheduled_date.is_not(None),
            SessionExercise.exercise_id == exercise_id,
        )
        .options(
            selectinload(WorkoutSession.session_exercises).selectinload(SessionExercise.sets),
            selectinload(WorkoutSession.session_exercises).selectinload(SessionExercise.exercise),
        )
        .order_by(WorkoutSession.scheduled_date)
    )
    sessions = list(db.scalars(stmt).unique().all())
    if not sessions:
        return None

    exercise_name = None
    points: list[MaxWeightPoint] = []
    for session in sessions:
        weights = [
            se_set.weight_kg
            for se in session.session_exercises
            if se.exercise_id == exercise_id
            for se_set in se.sets
            if not se_set.is_warmup and se_set.weight_kg is not None
        ]
        if not weights:
            continue
        if exercise_name is None:
            exercise_name = next(
                se.exercise.name for se in session.session_exercises if se.exercise_id == exercise_id
            )
        points.append(MaxWeightPoint(session_date=session.scheduled_date, max_weight_kg=max(weights)))

    if exercise_name is None:
        return None

    return MaxWeightOut(exercise_id=exercise_id, exercise_name=exercise_name, points=points)


def get_history(
    db: DbSession,
    user_id: int,
    period: HistoryPeriodKey = "all",
    muscle_group_id: Optional[int] = None,
) -> list[HistoryItem]:
    today = date.today()
    stmt = select(WorkoutSession).where(
        WorkoutSession.user_id == user_id,
        WorkoutSession.status_id != STATUS_CANCELLED,
        WorkoutSession.scheduled_date.is_not(None),
    )
    if period == "week":
        stmt = stmt.where(WorkoutSession.scheduled_date >= today - timedelta(days=today.weekday()))
    elif period == "month":
        stmt = stmt.where(WorkoutSession.scheduled_date >= today.replace(day=1))

    stmt = stmt.options(
        selectinload(WorkoutSession.session_exercises).selectinload(SessionExercise.sets),
        selectinload(WorkoutSession.session_exercises).selectinload(SessionExercise.exercise),
    ).order_by(WorkoutSession.scheduled_date.desc())

    sessions = list(db.scalars(stmt).unique().all())

    results: list[HistoryItem] = []
    for session in sessions:
        exercise_summaries: list[HistoryExerciseSummary] = []
        for se in session.session_exercises:
            muscle = se.exercise.primary_muscle
            if muscle_group_id is not None and muscle.id != muscle_group_id:
                continue
            working_weights = [s.weight_kg for s in se.sets if not s.is_warmup and s.weight_kg is not None]
            exercise_summaries.append(
                HistoryExerciseSummary(
                    exercise_id=se.exercise_id,
                    exercise_name=se.exercise.name,
                    muscle_group_id=muscle.id,
                    muscle_group_name=muscle.name_ja,
                    muscle_group_color=muscle.color_hex,
                    sets_count=len(se.sets),
                    max_weight_kg=max(working_weights) if working_weights else None,
                )
            )
        if muscle_group_id is not None and not exercise_summaries:
            continue
        results.append(
            HistoryItem(
                session_id=session.id,
                scheduled_date=session.scheduled_date,
                title=session.title,
                exercises=exercise_summaries,
            )
        )

    return results
