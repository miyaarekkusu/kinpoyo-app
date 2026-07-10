from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.crud import user as user_crud
from app.models.user import User
from app.schemas.user import UserProfileOut, UserProfileUpdate, UserSearchResult

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
