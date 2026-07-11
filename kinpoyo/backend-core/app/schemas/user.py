# app/schemas/user.py (イメージ)
from pydantic import BaseModel
from typing import Optional

class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    weight_kg: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    body_fat_pct: Optional[float] = None
    # 💡 ここを新設して users.py が受け取れるようにする
    squat_1rm: Optional[float] = None
    bench_1rm: Optional[float] = None
    deadlift_1rm: Optional[float] = None

class UserProfileOut(BaseModel):
    id: int
    user_id: int
    display_name: Optional[str] = None
    weight_kg: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    body_fat_pct: Optional[float] = None
    # 💡 レスポンスにも含める
    squat_1rm: Optional[float] = None
    bench_1rm: Optional[float] = None
    deadlift_1rm: Optional[float] = None