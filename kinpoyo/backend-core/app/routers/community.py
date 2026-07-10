from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.crud import community as community_crud
from app.models.community import Post
from app.models.user import User
from app.schemas.community import (
    CommentCreate,
    CommentOut,
    FeedScope,
    PostCreate,
    PostOut,
    PostTypeKey,
    PostUpdate,
)

router = APIRouter(prefix="/posts", tags=["community"])


def _get_post_or_404(db: Session, post_id: int) -> Post:
    post = community_crud.get_post(db, post_id)
    if post is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="投稿が見つかりません")
    return post


@router.post("", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = community_crud.create_post(db, current_user.id, data)
    return community_crud.post_to_out(post, current_user.id)


@router.get("", response_model=list[PostOut])
def list_posts(
    type: PostTypeKey = "feed",
    scope: FeedScope = "all",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    posts = community_crud.list_posts(db, type, scope, current_user.id)
    return [community_crud.post_to_out(p, current_user.id) for p in posts]


@router.put("/{post_id}", response_model=PostOut)
def update_post(
    post_id: int,
    data: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _get_post_or_404(db, post_id)
    if post.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="自分の投稿のみ編集できます")
    post = community_crud.update_post(db, post, data)
    return community_crud.post_to_out(post, current_user.id)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _get_post_or_404(db, post_id)
    if post.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="自分の投稿のみ削除できます")
    community_crud.delete_post(db, post)


@router.post("/{post_id}/likes", response_model=PostOut)
def like_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _get_post_or_404(db, post_id)
    post = community_crud.like_post(db, post, current_user.id)
    return community_crud.post_to_out(post, current_user.id)


@router.delete("/{post_id}/likes", response_model=PostOut)
def unlike_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _get_post_or_404(db, post_id)
    post = community_crud.unlike_post(db, post, current_user.id)
    return community_crud.post_to_out(post, current_user.id)


@router.post(
    "/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED
)
def add_comment(
    post_id: int,
    data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = _get_post_or_404(db, post_id)
    comment = community_crud.add_comment(db, post, current_user.id, data)
    return community_crud.comment_to_out(comment)


@router.get("/{post_id}/comments", response_model=list[CommentOut])
def list_comments(
    post_id: int,
    db: Session = Depends(get_db),
):
    _get_post_or_404(db, post_id)
    comments = community_crud.list_comments(db, post_id)
    return [community_crud.comment_to_out(c) for c in comments]
