"""プロフィール画面の「BIG3の合計(1RM)」セクション用CRUD（2026-08-25追加）。
自動計算（ワークアウト履歴からのEpley式推定1RM）と手入力登録の両方を組み合わせ、
種目ごとに大きい方を採用する。判定はここで完結させる（AIには渡さない・
review系のBase+パーツ方式とは無関係の純粋な集計機能）。
"""
from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.rpe_predictor import get_prior_best_e1rm
from app.models.exercise import Exercise, UserExerciseMax
from app.schemas.record import Big3ExerciseOut, Big3Out, ExerciseMaxCreate

SQUAT_EXERCISE_ID = 17
BENCH_EXERCISE_ID = 1
DEADLIFT_EXERCISE_ID = 9


def create_exercise_max(db: Session, user_id: int, data: ExerciseMaxCreate) -> UserExerciseMax:
    from datetime import date as date_cls

    row = UserExerciseMax(
        user_id=user_id,
        exercise_id=data.exercise_id,
        weight_kg=data.weight_kg,
        recorded_at=data.recorded_at or date_cls.today(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _best_manual_max(db: Session, user_id: int, exercise_id: int) -> Optional[Decimal]:
    stmt = select(UserExerciseMax).where(
        UserExerciseMax.user_id == user_id,
        UserExerciseMax.exercise_id == exercise_id,
    )
    rows = list(db.scalars(stmt).all())
    if not rows:
        return None
    return max(r.weight_kg for r in rows)


def _big3_entry(db: Session, user_id: int, exercise_id: int) -> Big3ExerciseOut:
    exercise = db.get(Exercise, exercise_id)
    exercise_name = exercise.name if exercise is not None else "不明"

    manual_best = _best_manual_max(db, user_id, exercise_id)
    computed_best = get_prior_best_e1rm(db, user_id, exercise_id)
    computed_best_decimal = (
        Decimal(str(round(computed_best, 1))) if computed_best is not None else None
    )

    candidates = [v for v in (manual_best, computed_best_decimal) if v is not None]
    if not candidates:
        return Big3ExerciseOut(exercise_id=exercise_id, exercise_name=exercise_name)

    best = max(candidates)
    source = "manual" if manual_best is not None and best == manual_best else "workout"
    return Big3ExerciseOut(
        exercise_id=exercise_id, exercise_name=exercise_name, best_1rm_kg=best, source=source
    )


def get_big3(db: Session, user_id: int) -> Big3Out:
    squat = _big3_entry(db, user_id, SQUAT_EXERCISE_ID)
    bench = _big3_entry(db, user_id, BENCH_EXERCISE_ID)
    deadlift = _big3_entry(db, user_id, DEADLIFT_EXERCISE_ID)

    values = [e.best_1rm_kg for e in (squat, bench, deadlift)]
    total_kg = sum(values, Decimal("0")) if all(v is not None for v in values) else None

    return Big3Out(squat=squat, bench=bench, deadlift=deadlift, total_kg=total_kg)
