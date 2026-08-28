from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.workout import WorkoutSessionReport


def get_report_by_session(db: Session, workout_session_id: int) -> Optional[WorkoutSessionReport]:
    stmt = select(WorkoutSessionReport).where(
        WorkoutSessionReport.workout_session_id == workout_session_id
    )
    return db.scalars(stmt).first()


def replace_report(
    db: Session,
    workout_session_id: int,
    model_version: str,
    feedback_text: str,
    prompt_tokens: int,
    completion_tokens: int,
    matched_part_codes: list[str],
    planned_vs_actual: dict,
    compared_session_id: Optional[int],
) -> WorkoutSessionReport:
    """既存レポート（workout_session_idでUNIQUE）があれば削除してから新規作成する
    （crud/ai_review.pyのreplace_reviewと同じ再生成パターン）。"""
    existing = get_report_by_session(db, workout_session_id)
    if existing is not None:
        db.delete(existing)
        db.flush()

    report = WorkoutSessionReport(
        workout_session_id=workout_session_id,
        model_version=model_version,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        feedback_text=feedback_text,
        matched_part_codes_json=matched_part_codes,
        planned_vs_actual_json=planned_vs_actual,
        compared_session_id=compared_session_id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report
