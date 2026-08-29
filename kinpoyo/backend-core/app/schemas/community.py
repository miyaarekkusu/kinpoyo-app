from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

FeedScope = Literal["all", "following"]


class PostCreate(BaseModel):
    """2026-08-30再設計：自由なQ&A/フィード投稿を廃止し、その日に実施した
    トレーニング記録（workout_session_id）に必ず紐づける投稿のみに限定した。
    titleは廃止（トレーニング記録が本文の代わりになるため）。bodyは任意の
    一言コメント（トレーニング記録に添える形）。
    """
    workout_session_id: int
    body: str = ""
    image_urls: list[str] = Field(default_factory=list)


class PostUpdate(BaseModel):
    """workout_session_idは投稿後に変更不可（作成時の記録と紐づいたまま）。
    編集できるのはコメント・画像のみ。"""
    body: Optional[str] = None
    image_urls: Optional[list[str]] = None


class PostAuthor(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class PostWorkoutExercise(BaseModel):
    """投稿カードに表示するトレーニング内容のサマリー（種目1件分）。"""
    exercise_name: str
    sets_count: int
    total_reps: int
    max_weight_kg: Optional[float] = None


class PostWorkoutSummary(BaseModel):
    """投稿に紐づくトレーニング記録のサマリー。workout_session_idが指す
    WorkoutSessionから決定的に組み立てる（AIには生成させない）。"""
    scheduled_date: Optional[date] = None
    duration_sec: Optional[int] = None
    total_volume: Optional[float] = None
    exercises: list[PostWorkoutExercise] = Field(default_factory=list)


class PostOut(BaseModel):
    id: int
    author: PostAuthor
    title: Optional[str] = None
    body: str
    image_urls: list[str] = Field(default_factory=list)
    workout_session_id: Optional[int] = None
    # 2026-08-30追加：投稿に紐づくトレーニング記録のサマリー。過去（再設計前）に
    # workout_session_idが無いまま作られた投稿ではNoneになる。
    workout_summary: Optional[PostWorkoutSummary] = None
    is_pinned: bool
    likes_count: int
    comments_count: int
    liked_by_me: bool
    created_at: datetime
    updated_at: datetime


class CommentCreate(BaseModel):
    body: str
    parent_id: Optional[int] = None


class CommentOut(BaseModel):
    id: int
    post_id: int
    author: PostAuthor
    parent_id: Optional[int] = None
    body: str
    likes_count: int
    created_at: datetime


class PostImageUploadOut(BaseModel):
    urls: list[str]


class PostableSessionExercise(BaseModel):
    exercise_name: str
    sets_count: int


class PostableSessionOut(BaseModel):
    """2026-08-30追加：投稿作成画面で選ばせる「今日の完了済み・未投稿の
    トレーニング記録」一覧用。"""
    id: int
    scheduled_date: Optional[date] = None
    duration_sec: Optional[int] = None
    total_volume: Optional[float] = None
    exercises: list[PostableSessionExercise] = Field(default_factory=list)
