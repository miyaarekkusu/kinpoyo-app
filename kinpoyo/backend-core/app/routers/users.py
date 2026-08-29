from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.uploads import save_avatar_image
from app.crud import body as body_crud
from app.crud import user as user_crud
from app.models.user import User
from app.schemas.body import WeightGoalOut, WeightGoalUpdate
from app.schemas.user import (
    AvatarUploadOut,
    PublicProfileOut,
    UserProfileOut,
    UserProfileUpdate,
    UserSearchResult,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/profile", response_model=UserProfileOut)
def read_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user_crud.get_profile(db, current_user.id)


@router.put("/me/profile", response_model=UserProfileOut)
def update_my_profile(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user_crud.update_profile(db, current_user.id, data)


@router.post("/me/avatar", response_model=AvatarUploadOut, status_code=status.HTTP_201_CREATED)
def upload_my_avatar(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """画像を保存してprofile.avatar_urlに保存するところまで行う
    （posts/imagesと違い、アバターは1枚だけなのでアップロードと同時に確定する）。"""
    url = save_avatar_image(image)
    user_crud.update_profile(db, current_user.id, UserProfileUpdate(avatar_url=url))
    return AvatarUploadOut(avatar_url=url)


@router.get("/me/weight-goal", response_model=Optional[WeightGoalOut])
def read_my_weight_goal(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return body_crud.get_weight_goal(db, current_user.id)


@router.put("/me/weight-goal", response_model=WeightGoalOut)
def update_my_weight_goal(
    data: WeightGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return body_crud.upsert_weight_goal(db, current_user.id, data.target_value, data.deadline)


@router.get("/search", response_model=list[UserSearchResult])
def search_users(
    q: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user_crud.search_users(db, q, current_user.id)


@router.post("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def follow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        user_crud.follow_user(db, current_user.id, user_id)
    except user_crud.CannotFollowSelfError:
        raise HTTPException(status_code=400, detail="自分自身をフォローすることはできません")
    except user_crud.AlreadyFollowingError:
        raise HTTPException(status_code=400, detail="既にフォローしています")


@router.delete("/{user_id}/follow", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_crud.unfollow_user(db, current_user.id, user_id)


# 2026-08-30追加：フォロー機能拡充（他ユーザーのプロフィール表示・フォロワー/
# フォロー中一覧）。`/{user_id}`は`/search`より後ろに定義すること
# （FastAPI/Starletteはルート登録順に一致を試みるため、先に書かないと
# `GET /users/search`が`{user_id}`側に飲まれて422になる）。


@router.get("/{user_id}/followers", response_model=list[UserSearchResult])
def read_followers(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user_crud.list_followers(db, user_id, current_user.id)


@router.get("/{user_id}/following", response_model=list[UserSearchResult])
def read_following(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user_crud.list_following(db, user_id, current_user.id)


@router.get("/{user_id}", response_model=PublicProfileOut)
def read_public_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = user_crud.get_public_profile(db, user_id, current_user.id)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ユーザーが見つかりません")
    return profile
