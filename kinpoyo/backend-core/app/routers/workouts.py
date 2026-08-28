from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from dataclasses import asdict

from app.core import review_judge, review_prompt, session_report_judge, session_report_prompt
from app.core.deepseek_client import generate_review_text
from app.core.deps import get_current_user, get_db
from app.crud import ai_review as ai_review_crud
from app.crud import exercise as exercise_crud
from app.crud import program as program_crud
from app.crud import workout as workout_crud
from app.crud import workout_session_report as report_crud
from app.models.user import User
from app.models.workout import WorkoutSession
from app.schemas.exercise import AiReviewOut
from app.schemas.workout import (
    SessionExerciseCreate,
    SessionExerciseOut,
    SessionSetCreate,
    SessionSetOut,
    SessionSetUpdate,
    WorkoutSessionCreate,
    WorkoutSessionOut,
    WorkoutSessionReportOut,
    WorkoutSessionUpdate,
)

router = APIRouter(prefix="/workouts", tags=["workouts"])


def _get_owned_session(db: Session, session_id: int, user: User) -> WorkoutSession:
    session = workout_crud.get_session(db, session_id)
    if session is None or session.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="セッションが見つかりません")
    return session


@router.post("", response_model=WorkoutSessionOut, status_code=status.HTTP_201_CREATED)
def create_workout(
    data: WorkoutSessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = workout_crud.create_session(db, current_user.id, data)
    return workout_crud.session_to_out(session)


@router.get("", response_model=list[WorkoutSessionOut])
def list_workouts_by_date(
    date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = workout_crud.get_sessions_by_date(db, current_user.id, date)
    return [workout_crud.session_to_out(s) for s in sessions]


@router.get("/{session_id}", response_model=WorkoutSessionOut)
def get_workout(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user)
    return workout_crud.session_to_out(session)


@router.put("/{session_id}", response_model=WorkoutSessionOut)
def update_workout(
    session_id: int,
    data: WorkoutSessionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user)
    session = workout_crud.update_session(db, session, data)
    return workout_crud.session_to_out(session)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workout(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user)
    workout_crud.cancel_session(db, session)


@router.post("/{session_id}/start", response_model=WorkoutSessionOut)
def start_workout(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user)
    if session.status_id != workout_crud.STATUS_SCHEDULED:
        raise HTTPException(status_code=400, detail="予定済みのセッションのみ開始できます")
    session = workout_crud.start_session(db, session)
    return workout_crud.session_to_out(session)


@router.post("/{session_id}/abort", response_model=WorkoutSessionOut)
def abort_workout(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """計測を「予定済み」に戻す（＝最初からやり直せる状態）。

    2つの用途がある。
      1. 計測画面で中断したとき。以前は開始ボタンを押した時点で実施中になり、
         中断して戻ると開始画面に「実施中」が残り続けるバグになっていた。
      2. 完了済みのメニューをもう一度実行したいとき（回数カウントの検証用）。
         1日1メニュー制のため、完了すると開始ボタンが出なくなる。

    キャンセル（メニューごと取り消し）とも終了とも違うので専用の口にしている。
    取り消し済みには触らない——捨てたものを掘り返さないため。
    """
    session = _get_owned_session(db, session_id, current_user)
    if session.status_id not in (
        workout_crud.STATUS_IN_PROGRESS,
        workout_crud.STATUS_COMPLETED,
    ):
        # 既に予定済み、または取り消し済み。何もしない（冪等）。
        return workout_crud.session_to_out(session)
    session = workout_crud.abort_session(db, session)
    return workout_crud.session_to_out(session)


@router.post("/{session_id}/end", response_model=WorkoutSessionOut)
def end_workout(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user)
    if session.status_id != workout_crud.STATUS_IN_PROGRESS:
        raise HTTPException(status_code=400, detail="実施中のセッションのみ終了できます")
    session = workout_crud.end_session(db, session)
    return workout_crud.session_to_out(session)


@router.post(
    "/{session_id}/exercises", response_model=SessionExerciseOut, status_code=status.HTTP_201_CREATED
)
def add_workout_exercise(
    session_id: int,
    data: SessionExerciseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = _get_owned_session(db, session_id, current_user)
    session_exercise = workout_crud.add_exercise(db, session.id, data)
    return SessionExerciseOut(
        id=session_exercise.id,
        exercise_id=session_exercise.exercise_id,
        exercise_name=session_exercise.exercise.name,
        order_index=session_exercise.order_index,
        target_sets=session_exercise.target_sets,
        rest_interval_sec=session_exercise.rest_interval_sec,
        memo=session_exercise.memo,
        sets=[workout_crud.set_to_out(s) for s in sorted(session_exercise.sets, key=lambda x: x.set_number)],
    )


@router.post(
    "/{session_id}/exercises/{exercise_id}/sets",
    response_model=SessionSetOut,
    status_code=status.HTTP_201_CREATED,
)
def add_workout_set(
    session_id: int,
    exercise_id: int,
    data: SessionSetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_owned_session(db, session_id, current_user)
    session_exercise = workout_crud.get_session_exercise(db, session_id, exercise_id)
    if session_exercise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="種目が見つかりません")
    return workout_crud.add_set(db, session_exercise, data)


@router.put(
    "/{session_id}/exercises/{exercise_id}/sets/{set_id}",
    response_model=SessionSetOut,
)
def update_workout_set(
    session_id: int,
    exercise_id: int,
    set_id: int,
    data: SessionSetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """録画リトライ時、新しいセットを作らずこのセットを上書きするための更新
    エンドポイント（AGENTS.md『現状の問題（今回の発端）』参照）。"""
    _get_owned_session(db, session_id, current_user)
    session_exercise = workout_crud.get_session_exercise(db, session_id, exercise_id)
    if session_exercise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="種目が見つかりません")
    session_set = workout_crud.get_set(db, exercise_id, set_id)
    if session_set is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="セットが見つかりません")
    session_set = workout_crud.update_set(db, session_set, data)
    return workout_crud.set_to_out(session_set)


@router.post(
    "/{session_id}/exercises/{exercise_id}/generate-review",
    response_model=AiReviewOut,
)
def generate_review(
    session_id: int,
    exercise_id: int,  # 実体はsession_exercise.id（既存のsetsエンドポイントと同じ命名慣習）
    set_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """該当種目のrep_cycles_jsonを集計し、決定的ロジックで観点を判定、
    ベース＋パーツでプロンプトを組み立ててDeepSeek APIでレビュー文を生成、
    ai_reviewsに保存して返す。既存レビューがあれば削除して作り直す（再生成）。

    2026-08-28変更：以前は「その種目でこれまでにやった全セットをまとめて評価」
    していたが、ユーザーから「今回記録したセットだけのレビューにしてほしい」との
    要望を受け、`set_id`クエリパラメータで対象を1セットに絞れるようにした。
    `set_id`省略時は後方互換のため従来通り全セット集計にフォールバックする
    （現状のフロントエンド呼び出し元は必ず`set_id`を渡す）。
    """
    _get_owned_session(db, session_id, current_user)
    session_exercise = workout_crud.get_session_exercise(db, session_id, exercise_id)
    if session_exercise is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="種目が見つかりません")

    rep_model = exercise_crud.get_rep_count_model(db, session_exercise.exercise_id)
    cycle_stats = (
        rep_model.config_json.get("cycleStats") if rep_model is not None else None
    )

    if set_id is not None:
        target_set = workout_crud.get_set(db, session_exercise.id, set_id)
        if target_set is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="セットが見つかりません")
        rep_cycles_lists = [target_set.rep_cycles_json] if target_set.rep_cycles_json else []
    else:
        rep_cycles_lists = [
            s.rep_cycles_json for s in session_exercise.sets if s.rep_cycles_json
        ]
    measurements = review_judge.aggregate_cycles(rep_cycles_lists)
    # 2026-08-28変更：カウントできたレップが0件でも、妥当性/姿勢ゲートで
    # 「種目と違う動き・姿勢だった可能性」が検出できていれば、それ自体が
    # 伝える価値のある情報なのでレビュー生成を続行する
    # （total_rep_count=0のみを理由に400にしない）。
    if (
        measurements.total_rep_count == 0
        and measurements.posture_mismatch_count == 0
        and measurements.movement_mismatch_count == 0
    ):
        raise HTTPException(status_code=400, detail="まだ有効な計測データがありません")

    aspect_suffixes = review_judge.judge_aspects(measurements, cycle_stats)

    all_parts = ai_review_crud.get_active_prompt_parts_for_exercise(
        db, session_exercise.exercise_id
    )
    matched_parts = [
        part
        for part in all_parts
        if any(part.code.endswith(suffix) for suffix in aspect_suffixes)
    ]

    prompt = review_prompt.build_prompt(
        exercise_name=session_exercise.exercise.name,
        measurements=measurements,
        parts=matched_parts,
    )

    try:
        feedback_text, prompt_tokens, completion_tokens = generate_review_text(prompt)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    # プロンプトで200文字以内を指示しているが、AI出力は厳密に守るとは限らないため
    # 安全策として切り詰める（スマホ画面に収まる長さを保証する）。
    if len(feedback_text) > review_prompt.PER_SET_REVIEW_MAX_CHARS:
        feedback_text = feedback_text[: review_prompt.PER_SET_REVIEW_MAX_CHARS - 1] + "…"

    review = ai_review_crud.replace_review(
        db,
        session_exercise_id=session_exercise.id,
        model_version="deepseek-chat",
        feedback_text=feedback_text,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        matched_part_codes=[p.code for p in matched_parts],
    )
    return AiReviewOut.model_validate(review)


@router.post(
    "/{session_id}/generate-report",
    response_model=WorkoutSessionReportOut,
)
def generate_session_report(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """セッション全体（複数種目）の実績サマリー＋AIレビューを生成する。
    `/workouts/{id}/end`成功後にフロントから自動で呼ばれる想定
    （DATABASE.md 4.20・AGENTS.md『筋トレフロー刷新』参照）。既存レポートが
    あれば削除して作り直す（再生成）。"""
    session = _get_owned_session(db, session_id, current_user)
    if session.status_id != workout_crud.STATUS_COMPLETED:
        raise HTTPException(status_code=400, detail="終了したセッションのみレポートを生成できます")

    compared_session = session_report_judge.find_compared_session(db, session)

    exercise_ids = {se.exercise_id for se in session.session_exercises}
    ai_tracked_exercise_ids = {
        eid for eid in exercise_ids if exercise_crud.get_rep_count_model(db, eid) is not None
    }
    measurements = session_report_judge.compute_measurements(db, session, compared_session, ai_tracked_exercise_ids)
    aspect_suffixes = session_report_judge.judge_session_aspects(measurements)

    all_parts = ai_review_crud.get_active_common_prompt_parts(db)
    matched_parts = [
        part
        for part in all_parts
        if any(part.code == f"session_{suffix}" for suffix in aspect_suffixes)
    ]

    # 参加中のプログラムがあれば、その文脈（種目構成・カテゴリ・難易度・進捗）を
    # プロンプトに渡す（AGENTS.md『プログラム連携』参照。判定はAIの一般知識に委ねる）。
    program_context = None
    user_program = program_crud.get_active_user_program(db, current_user.id)
    if user_program is not None:
        today_exercises = program_crud.get_program_exercises(
            db, user_program.program_id, user_program.current_week, user_program.current_day
        )
        program_context = session_report_prompt.build_program_context(
            program_name=user_program.program.name,
            category_name=user_program.program.category.name_ja if user_program.program.category else None,
            difficulty_name=user_program.program.difficulty_level.name_ja if user_program.program.difficulty_level else None,
            current_week=user_program.current_week,
            current_day=user_program.current_day,
            today_exercise_names=[pe.exercise.name for pe in today_exercises],
        )

    prompt = session_report_prompt.build_prompt(measurements, matched_parts, program_context)

    try:
        feedback_text, prompt_tokens, completion_tokens = generate_review_text(prompt)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    planned_vs_actual = {
        "exercises": [asdict(ex) for ex in measurements.exercises],
        "overall_achievement_pct": measurements.overall_achievement_pct,
        "has_comparison": measurements.has_comparison,
    }

    report = report_crud.replace_report(
        db,
        workout_session_id=session.id,
        model_version="deepseek-chat",
        feedback_text=feedback_text,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        matched_part_codes=[p.code for p in matched_parts],
        planned_vs_actual=planned_vs_actual,
        compared_session_id=compared_session.id if compared_session is not None else None,
    )
    return WorkoutSessionReportOut.model_validate(report)


@router.get(
    "/{session_id}/report",
    response_model=WorkoutSessionReportOut,
)
def get_session_report(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """過去に生成済みのセッションレポートを取得する（再生成はしない）。
    記録タブの筋トレ履歴からタップして見る用途（AGENTS.md参照）。"""
    _get_owned_session(db, session_id, current_user)
    report = report_crud.get_report_by_session(db, session_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="レポートが見つかりません")
    return WorkoutSessionReportOut.model_validate(report)
