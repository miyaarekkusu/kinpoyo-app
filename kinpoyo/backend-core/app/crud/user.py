from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.security import hash_password, verify_password
from app.crud import record as record_crud
from app.models.community import Follow
from app.models.user import User, UserProfile
from app.schemas.user import PublicProfileOut, UserCreate, UserProfileUpdate, UserSearchResult


class AlreadyFollowingError(Exception):
    pass


class CannotFollowSelfError(Exception):
    pass


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, user_in: UserCreate) -> User:
    user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=hash_password(user_in.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 1ユーザー1プロフィールなので登録と同時に空のプロフィールを作っておく
    profile = UserProfile(user_id=user.id)
    db.add(profile)
    db.commit()

    return user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if user is None or not verify_password(password, user.password_hash):
        return None
    return user


def get_profile(db: Session, user_id: int) -> Optional[UserProfile]:
    return db.query(UserProfile).filter(UserProfile.user_id == user_id).first()


def update_profile(db: Session, user_id: int, data: UserProfileUpdate) -> UserProfile:
    profile = get_profile(db, user_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


def _users_to_search_results(
    db: Session, users: list[User], viewer_id: int
) -> list[UserSearchResult]:
    """2026-08-30追加：search_users・list_followers・list_followingで共通の
    「Userのリスト→フォロー状態つきのUserSearchResultのリスト」変換をまとめた
    ヘルパー（重複実装の防止）。"""
    following_ids = set(
        db.scalars(
            select(Follow.followee_id).where(Follow.follower_id == viewer_id)
        ).all()
    )
    return [
        UserSearchResult(
            id=u.id,
            username=u.username,
            display_name=u.profile.display_name if u.profile else None,
            avatar_url=u.profile.avatar_url if u.profile else None,
            is_following=u.id in following_ids,
        )
        for u in users
    ]


def search_users(db: Session, query: str, current_user_id: int, limit: int = 20) -> list[UserSearchResult]:
    like_pattern = f"%{query}%"
    stmt = (
        select(User)
        .where(User.id != current_user_id)
        .where(
            or_(
                User.username.ilike(like_pattern),
                UserProfile.display_name.ilike(like_pattern),
            )
        )
        .join(UserProfile, UserProfile.user_id == User.id, isouter=True)
        .options(selectinload(User.profile))
        .limit(limit)
    )
    users = list(db.scalars(stmt).unique().all())
    return _users_to_search_results(db, users, current_user_id)


def list_followers(db: Session, user_id: int, viewer_id: int) -> list[UserSearchResult]:
    """2026-08-30追加：user_idをフォローしているユーザー一覧（フォロワー）。"""
    stmt = (
        select(User)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.followee_id == user_id)
        .options(selectinload(User.profile))
        .order_by(Follow.created_at.desc())
    )
    users = list(db.scalars(stmt).unique().all())
    return _users_to_search_results(db, users, viewer_id)


def list_following(db: Session, user_id: int, viewer_id: int) -> list[UserSearchResult]:
    """2026-08-30追加：user_idがフォローしているユーザー一覧（フォロー中）。"""
    stmt = (
        select(User)
        .join(Follow, Follow.followee_id == User.id)
        .where(Follow.follower_id == user_id)
        .options(selectinload(User.profile))
        .order_by(Follow.created_at.desc())
    )
    users = list(db.scalars(stmt).unique().all())
    return _users_to_search_results(db, users, viewer_id)


def get_public_profile(db: Session, user_id: int, viewer_id: int) -> Optional[PublicProfileOut]:
    """2026-08-30追加：他ユーザーのプロフィール表示画面用。存在しない
    user_idにはNoneを返す（ルーター側で404にする）。"""
    user = db.get(User, user_id)
    if user is None:
        return None
    profile = get_profile(db, user_id)
    is_following = (
        db.scalars(
            select(Follow).where(
                Follow.follower_id == viewer_id, Follow.followee_id == user_id
            )
        ).first()
        is not None
    )
    followers_count = (
        db.scalar(
            select(func.count()).select_from(Follow).where(Follow.followee_id == user_id)
        )
        or 0
    )
    following_count = (
        db.scalar(
            select(func.count()).select_from(Follow).where(Follow.follower_id == user_id)
        )
        or 0
    )
    achievements = record_crud.get_achievements(db, user_id)
    return PublicProfileOut(
        id=user.id,
        username=user.username,
        display_name=profile.display_name if profile else None,
        avatar_url=profile.avatar_url if profile else None,
        bio=profile.bio if profile else None,
        is_following=is_following,
        followers_count=followers_count,
        following_count=following_count,
        total_workouts=achievements.total_workouts,
        total_duration_sec=achievements.total_duration_sec,
        weekly_streak=achievements.weekly_streak,
    )


def follow_user(db: Session, follower_id: int, followee_id: int) -> None:
    if follower_id == followee_id:
        raise CannotFollowSelfError()
    existing = db.scalars(
        select(Follow).where(
            Follow.follower_id == follower_id, Follow.followee_id == followee_id
        )
    ).first()
    if existing is not None:
        raise AlreadyFollowingError()
    db.add(Follow(follower_id=follower_id, followee_id=followee_id))
    db.commit()


def unfollow_user(db: Session, follower_id: int, followee_id: int) -> None:
    existing = db.scalars(
        select(Follow).where(
            Follow.follower_id == follower_id, Follow.followee_id == followee_id
        )
    ).first()
    if existing is not None:
        db.delete(existing)
        db.commit()
