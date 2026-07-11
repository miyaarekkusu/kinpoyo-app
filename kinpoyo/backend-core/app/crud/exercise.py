from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.models.exercise import Exercise
from app.schemas.exercise import ExerciseOut


def list_exercises(db: Session) -> list[Exercise]:
    stmt = (
        select(Exercise)
        .options(selectinload(Exercise.primary_muscle), selectinload(Exercise.movement_category))
        .order_by(Exercise.id)
    )
    return list(db.scalars(stmt).all())


def exercise_to_out(e: Exercise) -> ExerciseOut:
    return ExerciseOut(
        id=e.id,
        name=e.name,
        movement=e.movement_category.code,
        muscle=e.primary_muscle.name_ja,
        muscle_color=e.primary_muscle.color_hex,
    )
