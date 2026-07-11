from typing import Optional
from pydantic import BaseModel


class ExerciseOut(BaseModel):
    id: int
    name: str
    movement: str
    muscle: str
    muscle_color: Optional[str] = None
