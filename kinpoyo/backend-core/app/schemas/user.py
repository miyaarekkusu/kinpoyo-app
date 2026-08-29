from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    username: str
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str
    is_active: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    birth_date: Optional[date] = None
    gender_id: Optional[int] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    body_fat_pct: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    experience_level_id: int
    training_goal: Optional[str] = None


class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    birth_date: Optional[date] = None
    gender_id: Optional[int] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    body_fat_pct: Optional[float] = None
    muscle_mass_kg: Optional[float] = None
    experience_level_id: Optional[int] = None
    training_goal: Optional[str] = None


class AvatarUploadOut(BaseModel):
    avatar_url: str


class UserSearchResult(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_following: bool


class PublicProfileOut(BaseModel):
    """2026-08-30追加：他ユーザーのプロフィール表示画面用。自分専用の
    UserProfileOut（身体情報・目標体重等プライベートな項目を含む）とは別に、
    公開してよい範囲だけに絞って新設した。"""
    id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    is_following: bool
    followers_count: int
    following_count: int
    total_workouts: int
    total_duration_sec: int
    weekly_streak: int
