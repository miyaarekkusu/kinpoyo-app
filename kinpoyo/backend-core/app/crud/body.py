from decimal import Decimal
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.body import BodyGoal

# scripts/seed_masters.pyのGoalType/MeasurementUnitシード値と対応
# （GoalType id=1 "weight", MeasurementUnit id=1 "kg"）。
WEIGHT_GOAL_TYPE_ID = 1
KG_UNIT_ID = 1


def get_weight_goal(db: Session, user_id: int) -> Optional[BodyGoal]:
    stmt = (
        select(BodyGoal)
        .where(BodyGoal.user_id == user_id, BodyGoal.goal_type_id == WEIGHT_GOAL_TYPE_ID)
        .order_by(BodyGoal.created_at.desc())
    )
    return db.scalars(stmt).first()


def upsert_weight_goal(
    db: Session, user_id: int, target_value: Decimal, deadline=None
) -> BodyGoal:
    goal = get_weight_goal(db, user_id)
    if goal is None:
        goal = BodyGoal(
            user_id=user_id,
            goal_type_id=WEIGHT_GOAL_TYPE_ID,
            unit_id=KG_UNIT_ID,
            target_value=target_value,
            deadline=deadline,
        )
        db.add(goal)
    else:
        # 目標を変更したので達成フラグはリセットする
        goal.target_value = target_value
        goal.deadline = deadline
        goal.is_achieved = False
        goal.achieved_at = None
    db.commit()
    db.refresh(goal)
    return goal
