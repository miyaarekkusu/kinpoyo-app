"""筋トレレポート機能：ユーザーの過去の記録から推定1RM（e1RM）を計算し、
今回の重量が「その人にとって何%1RMか」から予測RPEを算出する。

2026-08-25、ユーザーフィードバック「最高重量登録でRPEが予測される（ユーザーに
関連付ける）」を受けて追加。判定はここで完結させ、AIには「予測RPEと実測RPEの
差」を渡して文章化させるだけ（notes/ai-review-design-memo.txtの基本方針）。
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.workout import SessionExercise, WorkoutSession


def estimate_1rm(weight_kg: float, reps: int) -> float:
    """Epley式で推定1RMを計算する（1RM = weight * (1 + reps/30)）。
    reps<=1の場合はそのまま重量を返す。"""
    if reps <= 1:
        return weight_kg
    return weight_kg * (1 + reps / 30)


# %1RM → 予測RPEの対応表（アンカー点。区間は線形補間）。厳密な科学的根拠のある表
# ではなく、一般的なRPE/%1RM目安を簡略化したもの（ユーザー確認済み・2026-08-25）。
_RPE_ANCHORS: list[tuple[float, float]] = [
    (100.0, 10.0),
    (95.0, 9.0),
    (90.0, 8.0),
    (85.0, 7.0),
    (80.0, 6.0),
    (70.0, 5.0),
    (60.0, 4.0),
]


def predict_rpe_from_pct_1rm(pct_1rm: float) -> float:
    """%1RM（例: 92.5）から予測RPEを線形補間で算出する。範囲外はクランプする。"""
    if pct_1rm >= _RPE_ANCHORS[0][0]:
        return _RPE_ANCHORS[0][1]
    if pct_1rm <= _RPE_ANCHORS[-1][0]:
        return _RPE_ANCHORS[-1][1]
    for (p_hi, r_hi), (p_lo, r_lo) in zip(_RPE_ANCHORS, _RPE_ANCHORS[1:]):
        if p_lo <= pct_1rm <= p_hi:
            ratio = (pct_1rm - p_lo) / (p_hi - p_lo)
            return round(r_lo + ratio * (r_hi - r_lo), 1)
    return 5.0  # 到達しないはずのフォールバック


def get_prior_best_e1rm(
    db: Session, user_id: int, exercise_id: int, exclude_session_id: Optional[int] = None
) -> Optional[float]:
    """完了済みセッションから、この種目の生涯ベスト推定1RMを計算する。
    exclude_session_idを指定すると、そのセッション自体は除外する（今回のセッション
    より前の自己ベストを基準にすることで、今回がPRだった場合に%1RMが100%を
    超えるのを許容する。app/core/session_report_judge.pyでの用途）。
    Noneなら全期間のベストを返す（プロフィール画面のBIG3表示用、2026-08-25追加）。
    """
    from app.crud.workout import STATUS_COMPLETED

    conditions = [
        WorkoutSession.user_id == user_id,
        WorkoutSession.status_id == STATUS_COMPLETED,
        SessionExercise.exercise_id == exercise_id,
    ]
    if exclude_session_id is not None:
        conditions.append(WorkoutSession.id != exclude_session_id)

    stmt = (
        select(WorkoutSession)
        .join(WorkoutSession.session_exercises)
        .where(*conditions)
        .options(
            selectinload(WorkoutSession.session_exercises).selectinload(SessionExercise.sets),
        )
    )
    sessions = db.scalars(stmt).unique().all()

    best: Optional[float] = None
    for session in sessions:
        for se in session.session_exercises:
            if se.exercise_id != exercise_id:
                continue
            for s in se.sets:
                if s.is_warmup or s.weight_kg is None or s.reps is None:
                    continue
                e1rm = estimate_1rm(float(s.weight_kg), s.reps)
                if best is None or e1rm > best:
                    best = e1rm
    return best
