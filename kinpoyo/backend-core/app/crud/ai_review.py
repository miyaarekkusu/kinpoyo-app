from typing import Optional

from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.models.exercise import AiReviewPromptPart
from app.models.workout import AiReview


def get_active_prompt_parts_for_exercise(
    db: Session, exercise_id: int
) -> list[AiReviewPromptPart]:
    """種目固有パーツ（exercise_id一致）＋種目共通パーツ（exercise_id IS NULL）を
    is_active=Trueのみ取得する。"""
    stmt = select(AiReviewPromptPart).where(
        or_(
            AiReviewPromptPart.exercise_id == exercise_id,
            AiReviewPromptPart.exercise_id.is_(None),
        ),
        AiReviewPromptPart.is_active.is_(True),
    )
    return list(db.scalars(stmt).all())


def get_active_common_prompt_parts(db: Session) -> list[AiReviewPromptPart]:
    """種目共通パーツ（exercise_id IS NULL）のみ、is_active=Trueで取得する。
    筋トレレポート機能（session_プレフィックス）用。"""
    stmt = select(AiReviewPromptPart).where(
        AiReviewPromptPart.exercise_id.is_(None),
        AiReviewPromptPart.is_active.is_(True),
    )
    return list(db.scalars(stmt).all())


def get_review_by_session_exercise(
    db: Session, session_exercise_id: int
) -> Optional[AiReview]:
    stmt = select(AiReview).where(AiReview.session_exercise_id == session_exercise_id)
    return db.scalars(stmt).first()


def replace_review(
    db: Session,
    session_exercise_id: int,
    model_version: str,
    feedback_text: str,
    prompt_tokens: int,
    completion_tokens: int,
    matched_part_codes: list[str],
) -> AiReview:
    """既存レビュー（session_exercise_idでUNIQUE）があれば削除してから新規作成する
    （再生成）。"""
    existing = get_review_by_session_exercise(db, session_exercise_id)
    if existing is not None:
        db.delete(existing)
        db.flush()

    review = AiReview(
        session_exercise_id=session_exercise_id,
        model_version=model_version,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        feedback_text=feedback_text,
        matched_part_codes_json=matched_part_codes,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review
