from datetime import date
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.crud import workout as workout_crud
from app.models.workout import WorkoutSession
from app.models.workout_template import WorkoutTemplate, WorkoutTemplateExercise, WorkoutTemplateSet
from app.schemas.workout import SessionExerciseCreate, SessionSetCreate, WorkoutSessionCreate
from app.schemas.workout_template import (
    WorkoutTemplateCreate,
    WorkoutTemplateExerciseOut,
    WorkoutTemplateListItem,
    WorkoutTemplateOut,
    WorkoutTemplateSetOut,
)

_TEMPLATE_LOAD_OPTIONS = (
    selectinload(WorkoutTemplate.exercises).selectinload(WorkoutTemplateExercise.exercise),
    selectinload(WorkoutTemplate.exercises).selectinload(WorkoutTemplateExercise.sets),
)


def template_to_out(template: WorkoutTemplate) -> WorkoutTemplateOut:
    """exercise_nameはWorkoutTemplateExerciseの直接属性ではなく
    exercise.nameのリレーション越しのため、model_validate(from_attributes)
    では埋まらない。SessionExerciseOut/session_to_outと同じく手動で組み立てる。"""
    return WorkoutTemplateOut(
        id=template.id,
        name=template.name,
        created_at=template.created_at,
        exercises=[
            WorkoutTemplateExerciseOut(
                id=te.id,
                exercise_id=te.exercise_id,
                exercise_name=te.exercise.name,
                order_index=te.order_index,
                sets=[WorkoutTemplateSetOut.model_validate(s) for s in te.sets],
            )
            for te in sorted(template.exercises, key=lambda x: x.order_index)
        ],
    )


def get_template(db: Session, template_id: int) -> Optional[WorkoutTemplate]:
    stmt = (
        select(WorkoutTemplate)
        .where(WorkoutTemplate.id == template_id)
        .options(*_TEMPLATE_LOAD_OPTIONS)
    )
    return db.scalars(stmt).first()


def _add_exercises(db: Session, template: WorkoutTemplate, data: WorkoutTemplateCreate) -> None:
    for ex_in in data.exercises:
        te = WorkoutTemplateExercise(
            template_id=template.id,
            exercise_id=ex_in.exercise_id,
            order_index=ex_in.order_index,
        )
        db.add(te)
        db.flush()

        for set_index, set_in in enumerate(ex_in.sets, start=1):
            db.add(
                WorkoutTemplateSet(
                    template_exercise_id=te.id,
                    set_number=set_index,
                    weight_kg=set_in.weight_kg,
                    reps=set_in.reps,
                    rest_after_sec=set_in.rest_after_sec,
                )
            )


def create_template(db: Session, user_id: int, data: WorkoutTemplateCreate) -> WorkoutTemplate:
    template = WorkoutTemplate(user_id=user_id, name=data.name)
    db.add(template)
    db.flush()

    _add_exercises(db, template, data)

    db.commit()
    return get_template(db, template.id)


def update_template(db: Session, template: WorkoutTemplate, data: WorkoutTemplateCreate) -> WorkoutTemplate:
    """種目・セットは丸ごと作り直す（cascade="all, delete-orphan"によりclear()で
    既存の子レコードが削除される）。順序やセット数がバラバラに変わりうるため、
    差分更新よりシンプルで確実。"""
    template.name = data.name
    template.exercises.clear()
    db.flush()

    _add_exercises(db, template, data)

    db.commit()
    return get_template(db, template.id)


def list_templates(db: Session, user_id: int) -> list[WorkoutTemplateListItem]:
    stmt = (
        select(WorkoutTemplate)
        .where(WorkoutTemplate.user_id == user_id)
        .options(selectinload(WorkoutTemplate.exercises))
        .order_by(WorkoutTemplate.created_at.desc())
    )
    templates = list(db.scalars(stmt).all())
    return [
        WorkoutTemplateListItem(
            id=t.id, name=t.name, created_at=t.created_at, exercise_count=len(t.exercises)
        )
        for t in templates
    ]


def delete_template(db: Session, template: WorkoutTemplate) -> None:
    db.delete(template)
    db.commit()


def apply_template(
    db: Session, template: WorkoutTemplate, user_id: int, scheduled_date: date
) -> WorkoutSession:
    """テンプレートの内容から新しいworkout_sessionを作る。既存の
    workout_crud.create_sessionをそのまま使う（セッション作成ロジックを
    重複させない）。target_setsはテンプレートのセット数をそのまま使う
    （AGENTS.md『達成率・実績セット数のバグ修正』と同じ理由で、実績計算の
    基準になる）。"""
    exercises_payload = [
        SessionExerciseCreate(
            exercise_id=te.exercise_id,
            order_index=te.order_index,
            target_sets=len(te.sets),
            sets=[
                SessionSetCreate(
                    weight_kg=s.weight_kg,
                    reps=s.reps,
                    rest_after_sec=s.rest_after_sec,
                )
                for s in te.sets
            ],
        )
        for te in sorted(template.exercises, key=lambda x: x.order_index)
    ]
    data = WorkoutSessionCreate(
        scheduled_date=scheduled_date, title=template.name, exercises=exercises_payload
    )
    return workout_crud.create_session(db, user_id, data)
