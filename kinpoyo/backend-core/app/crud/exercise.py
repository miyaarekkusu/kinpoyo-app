from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.models.exercise import Exercise, RepCountModel
from app.schemas.exercise import ExerciseOut


def get_rep_count_model(db: Session, exercise_id: int) -> Optional[RepCountModel]:
    stmt = select(RepCountModel).where(RepCountModel.exercise_id == exercise_id)
    return db.scalars(stmt).first()


def list_exercises(db: Session, ai_ready_only: bool = False) -> list[tuple[Exercise, bool]]:
    """種目一覧を (種目, 較正済みモデルが紐づいているか) の組で返す。

    ai_ready_only=True なら、rep_count_models に紐づいている種目だけを返す
    （種目ピッカー用。紐づいていない種目を選べるとAI回数カウントが働かないため）。
    紐づけの有無は LEFT JOIN で一緒に取る——種目ごとに rep-model を引くと種目数
    だけ往復が発生する。
    """
    stmt = (
        select(Exercise, RepCountModel.id.isnot(None))
        .outerjoin(RepCountModel, RepCountModel.exercise_id == Exercise.id)
        .options(selectinload(Exercise.primary_muscle), selectinload(Exercise.movement_category))
        .order_by(Exercise.id)
    )
    if ai_ready_only:
        stmt = stmt.where(RepCountModel.id.isnot(None))
    return [(e, bool(has_model)) for e, has_model in db.execute(stmt).all()]


def exercise_to_out(e: Exercise, has_rep_model: bool = False) -> ExerciseOut:
    return ExerciseOut(
        id=e.id,
        name=e.name,
        movement=e.movement_category.code,
        muscle=e.primary_muscle.name_ja,
        muscle_color=e.primary_muscle.color_hex,
        has_rep_model=has_rep_model,
    )
