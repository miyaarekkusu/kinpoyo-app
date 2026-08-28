from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.crud import workout as workout_crud
from app.crud import workout_template as template_crud
from app.models.user import User
from app.models.workout_template import WorkoutTemplate
from app.schemas.workout import WorkoutSessionOut
from app.schemas.workout_template import (
    WorkoutTemplateApply,
    WorkoutTemplateCreate,
    WorkoutTemplateListItem,
    WorkoutTemplateOut,
)

router = APIRouter(prefix="/workout-templates", tags=["workout-templates"])


def _get_owned_template(db: Session, template_id: int, user: User) -> WorkoutTemplate:
    template = template_crud.get_template(db, template_id)
    if template is None or template.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="テンプレートが見つかりません")
    return template


@router.post("", response_model=WorkoutTemplateOut, status_code=status.HTTP_201_CREATED)
def create_workout_template(
    data: WorkoutTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    template = template_crud.create_template(db, current_user.id, data)
    return template_crud.template_to_out(template)


@router.get("", response_model=list[WorkoutTemplateListItem])
def list_workout_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return template_crud.list_templates(db, current_user.id)


@router.get("/{template_id}", response_model=WorkoutTemplateOut)
def get_workout_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    template = _get_owned_template(db, template_id, current_user)
    return template_crud.template_to_out(template)


@router.put("/{template_id}", response_model=WorkoutTemplateOut)
def update_workout_template(
    template_id: int,
    data: WorkoutTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    template = _get_owned_template(db, template_id, current_user)
    template = template_crud.update_template(db, template, data)
    return template_crud.template_to_out(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    template = _get_owned_template(db, template_id, current_user)
    template_crud.delete_template(db, template)


@router.post(
    "/{template_id}/apply",
    response_model=WorkoutSessionOut,
    status_code=status.HTTP_201_CREATED,
)
def apply_workout_template(
    template_id: int,
    data: WorkoutTemplateApply,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """テンプレートの内容で、指定日に新しい筋トレセッションを作成する
    （カレンダーの空き日から「My筋トレから登録」で呼ばれる想定）。"""
    template = _get_owned_template(db, template_id, current_user)
    session = template_crud.apply_template(db, template, current_user.id, data.scheduled_date)
    return workout_crud.session_to_out(session)
