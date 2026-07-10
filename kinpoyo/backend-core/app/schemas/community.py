from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

PostTypeKey = Literal["feed", "qa"]
FeedScope = Literal["all", "following"]


class PostCreate(BaseModel):
    post_type: PostTypeKey = "feed"
    title: Optional[str] = None
    body: str
    image_urls: list[str] = Field(default_factory=list)
    workout_session_id: Optional[int] = None


class PostUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    image_urls: Optional[list[str]] = None


class PostAuthor(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


class PostOut(BaseModel):
    id: int
    author: PostAuthor
    post_type: PostTypeKey
    title: Optional[str] = None
    body: str
    image_urls: list[str] = Field(default_factory=list)
    workout_session_id: Optional[int] = None
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
