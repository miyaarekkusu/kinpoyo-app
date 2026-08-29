from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class WeightGoalUpdate(BaseModel):
    target_value: Decimal
    deadline: Optional[date] = None


class WeightGoalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    target_value: Decimal
    current_value: Optional[Decimal] = None
    deadline: Optional[date] = None
    is_achieved: bool
