"""筋トレレポート機能：セッション全体（複数種目）の実績を決定的ロジックで集計・
判定する。review_judge.pyと同じ方針（判定はここで完結、AIは文章化のみ）。

2026-08-24：総ボリューム（重量×レップの合計）による比較から、種目ごとの
重量・レップ数・RPEの平均値を前回の同じ種目と比較する方式へ変更した
（ユーザーからのフィードバック：「総ボリューム数はいらないかも。今回の実績と
前回の同じ種目のデータを比較できる方がいい」）。

2026-08-25：以下2点を追加（AGENTS.md『AIレビュープロンプトの強化』参照）。
- RPE予測：ユーザーの生涯ベスト推定1RM（Epley式）に対する今回の重量の割合
  （%1RM）から予測RPEを算出し、実測RPEとの差を判定材料にする
  （app/core/rpe_predictor.py）。予測より実測RPEが高ければ「思ったより
  きつかった」ことを意味し、重量が下がっている時はAIに対策を促す
- 停滞判定：直近3〜4セッションの「最後のセット」のレップ数がほぼ一定で、
  かつ重量もほぼ一定（=重い種目ほど重量更新に時間がかかるのは自然なので、
  レップ数の余裕で判断する）なら、加重を勧める

2026-08-28：以下2点をユーザー報告により修正・追加。
- achievement_pctのバグ修正：AI計測対応種目は、計画したセット数さえ埋まって
  いれば（例: 目標5回+10回に対し実測が合計14回でも）達成率が常に100%になって
  いた。session_sets.repsは登録時に入力した「目標」レップ数のまま更新されず
  （AI計測はai_counted_repsのみを書き込むため）、achievement_pctがセット数の
  充足だけを見てレップ数の充足を見ていなかったのが原因。計画レップ数合計に
  対する実測レップ数合計の割合に変更した。同じ理由で`_avg_metrics`の平均
  レップ数もAI計測対応種目では実測値ではなく目標値を平均していたバグを修正
  （ai_counted_repsを使うように）
- 種目ごとの平均値カードの代わりに、セットごとの実測値（重量・レップ数・RPE）を
  前回の同じ種目・同じセット番号と並べて比較できるように`sets`/`prev_sets`を
  追加（ユーザーフィードバック：「平均はいらない。前回の実績と重量とrep数と
  rpeを出して比較できるようにしてほしい」）。avg_*系のフィールドはAIレビュー
  文面の生成・RPE予測・停滞判定に引き続き使うため残している
"""
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.rpe_predictor import estimate_1rm, get_prior_best_e1rm, predict_rpe_from_pct_1rm
from app.models.workout import SessionExercise, WorkoutSession


ACHIEVEMENT_GOOD_THRESHOLD_PCT = 90.0
# 前回比較で「改善/悪化」と判定する変化率のしきい値（これ未満の変化は「ほぼ同じ」扱い）
IMPROVEMENT_TOLERANCE = 0.05
# 実測RPEが予測RPEよりこの値以上高ければ「思ったよりきつかった」と判定する
RPE_HARDER_THRESHOLD = 1.0
# 停滞判定：直近セッションで見る最小データ点数（今回含む）
PLATEAU_MIN_SESSIONS = 3
PLATEAU_LOOKBACK_SESSIONS = 4
# 停滞判定：この範囲内なら「ほぼ一定」とみなす
PLATEAU_REPS_TOLERANCE = 1
PLATEAU_WEIGHT_TOLERANCE_KG = 2.5


@dataclass
class SetResult:
    """1セット分の実測値（フロントの前回比較テーブル用）。AI計測対応種目は
    ai_counted_reps（実測レップ数）、非対応種目はreps（そのまま実績として扱う）
    をrepsに入れる。session_sets.repsそのもの（登録時の目標値）ではない点に注意。"""
    set_number: int
    weight_kg: Optional[float]
    reps: Optional[int]
    rpe: Optional[float]


@dataclass
class ExerciseComparison:
    exercise_id: int
    exercise_name: str
    target_sets: Optional[int]
    actual_sets: int
    achievement_pct: Optional[float]  # target_setsが無ければNone
    avg_weight_kg: Optional[float]
    avg_reps: Optional[float]
    avg_rpe: Optional[float]
    prev_avg_weight_kg: Optional[float]
    prev_avg_reps: Optional[float]
    prev_avg_rpe: Optional[float]
    weight_change_pct: Optional[float]  # (avg_weight_kg - prev_avg_weight_kg) / prev_avg_weight_kg * 100
    sets: list[SetResult]  # 今回の各セットの実測値（フロントの前回比較表示用）
    prev_sets: list[SetResult]  # 前回セッションの同じ種目の各セット実測値
    predicted_rpe: Optional[float] = None  # 生涯ベストe1RMに対する%1RMからの予測RPE
    rpe_deviation: Optional[float] = None  # avg_rpe - predicted_rpe（正なら「思ったよりきつかった」）
    is_plateaued: bool = False  # 直近数セッション、最後のセットのレップ数・重量がほぼ一定


@dataclass
class SessionReportMeasurements:
    exercises: list[ExerciseComparison] = field(default_factory=list)
    overall_achievement_pct: Optional[float] = None
    has_comparison: bool = False  # 前回の同じ種目構成のセッションが見つかったか


def _actual_reps(s, ai_tracked: bool) -> Optional[int]:
    """そのセットの「実際に行ったレップ数」。AI計測対応種目はai_counted_reps
    （実測値）、非対応種目はreps（記録手段が無いためそのまま実績として扱う）。
    session_sets.repsは登録時に入力した目標値のまま更新されない（AI計測は
    ai_counted_repsのみを書き込む）ため、AI計測対応種目でrepsを使うと目標値を
    実績として扱ってしまう（2026-08-28、achievement_pct・平均計算の両方に
    あったバグ）。"""
    return s.ai_counted_reps if ai_tracked else s.reps


def _avg_metrics(
    session_exercise: Optional[SessionExercise], ai_tracked: bool
) -> tuple[Optional[float], Optional[float], Optional[float]]:
    """ウォームアップを除くセットから、重量・レップ数・RPEの平均を計算する。

    AI計測対応種目（ai_tracked=True）は、実際に記録された（ai_counted_reps
    が入っている）セットのみを対象とする。登録画面で作られる計画済みセットは
    ai_counted_reps未記録でも重量・レップ数の欄に仮の値が入っているため、
    それらを含めると「やっていないセット」まで実績に混ざってしまう
    （2026-08-25、実績が常に計画通り＝100%になってしまうバグの修正）。
    """
    if session_exercise is None:
        return None, None, None
    sets = [s for s in session_exercise.sets if not s.is_warmup]
    if ai_tracked:
        sets = [s for s in sets if s.ai_counted_reps is not None]
    weights = [float(s.weight_kg) for s in sets if s.weight_kg is not None]
    reps = [_actual_reps(s, ai_tracked) for s in sets]
    reps = [r for r in reps if r is not None]
    rpes = [float(s.rpe) for s in sets if s.rpe is not None]
    avg_weight = round(sum(weights) / len(weights), 1) if weights else None
    avg_reps = round(sum(reps) / len(reps), 1) if reps else None
    avg_rpe = round(sum(rpes) / len(rpes), 1) if rpes else None
    return avg_weight, avg_reps, avg_rpe


def _set_results(session_exercise: Optional[SessionExercise], ai_tracked: bool) -> list["SetResult"]:
    """ウォームアップを除く各セットの実測値（重量・レップ数・RPE）を、セット番号
    順に返す。フロントで前回の同じ種目と1セットずつ比較表示するために使う。"""
    if session_exercise is None:
        return []
    sets = [s for s in session_exercise.sets if not s.is_warmup]
    if ai_tracked:
        sets = [s for s in sets if s.ai_counted_reps is not None]
    else:
        sets = [s for s in sets if s.reps is not None]
    sets = sorted(sets, key=lambda s: s.set_number)
    return [
        SetResult(
            set_number=s.set_number,
            weight_kg=float(s.weight_kg) if s.weight_kg is not None else None,
            reps=_actual_reps(s, ai_tracked),
            rpe=float(s.rpe) if s.rpe is not None else None,
        )
        for s in sets
    ]


def _last_set_reps_and_weight(
    session_exercise: SessionExercise, ai_tracked: bool
) -> Optional[tuple[int, Optional[float]]]:
    """そのセッションでの「最後のセット」のレップ数・重量を返す（無ければNone）。
    AI計測対応種目は実際に記録されたセットのみ、それ以外は全ての非ウォームアップ
    セットを対象に、set_numberが一番大きいものを選ぶ。"""
    sets = [s for s in session_exercise.sets if not s.is_warmup]
    if ai_tracked:
        sets = [s for s in sets if s.ai_counted_reps is not None]
    else:
        sets = [s for s in sets if s.reps is not None]
    if not sets:
        return None
    last = max(sets, key=lambda s: s.set_number)
    reps = _actual_reps(last, ai_tracked)
    if reps is None:
        return None
    weight = float(last.weight_kg) if last.weight_kg is not None else None
    return reps, weight


def _get_recent_sessions_with_exercise(
    db: Session, user_id: int, exercise_id: int, exclude_session_id: int, limit: int
) -> list[WorkoutSession]:
    """直近の完了済みセッションのうち、この種目を含むものを新しい順にlimit件返す
    （今回のセッションは除く）。"""
    from app.crud.workout import STATUS_COMPLETED

    stmt = (
        select(WorkoutSession)
        .join(WorkoutSession.session_exercises)
        .where(
            WorkoutSession.user_id == user_id,
            WorkoutSession.status_id == STATUS_COMPLETED,
            WorkoutSession.id != exclude_session_id,
            SessionExercise.exercise_id == exercise_id,
        )
        .options(
            selectinload(WorkoutSession.session_exercises).selectinload(SessionExercise.sets),
        )
        .order_by(WorkoutSession.ended_at.desc())
        .limit(limit)
    )
    return list(db.scalars(stmt).unique().all())


def _detect_plateau(
    db: Session,
    user_id: int,
    current_se: SessionExercise,
    is_ai_tracked: bool,
) -> bool:
    """直近PLATEAU_LOOKBACK_SESSIONS回（今回含む）の「最後のセット」のレップ数・
    重量を見て、両方ともほぼ一定なら停滞（プラトー）と判定する。重い種目ほど
    重量更新には時間がかかるのが自然なので、レップ数に余裕があるかで見る
    （ユーザーフィードバック：「一番最後のrep数で確認、一定だと判断したら加重を
    勧める」）。データ点がPLATEAU_MIN_SESSIONS未満なら判定しない（False）。"""
    points: list[tuple[int, Optional[float]]] = []
    cur = _last_set_reps_and_weight(current_se, is_ai_tracked)
    if cur is not None:
        points.append(cur)

    recent_sessions = _get_recent_sessions_with_exercise(
        db, user_id, current_se.exercise_id, current_se.session_id, PLATEAU_LOOKBACK_SESSIONS - 1
    )
    for session in recent_sessions:
        for se in session.session_exercises:
            if se.exercise_id != current_se.exercise_id:
                continue
            p = _last_set_reps_and_weight(se, is_ai_tracked)
            if p is not None:
                points.append(p)
            break

    if len(points) < PLATEAU_MIN_SESSIONS:
        return False

    reps_list = [p[0] for p in points]
    weights_list = [p[1] for p in points if p[1] is not None]

    reps_stable = (max(reps_list) - min(reps_list)) <= PLATEAU_REPS_TOLERANCE
    weight_stable = (
        len(weights_list) >= PLATEAU_MIN_SESSIONS
        and (max(weights_list) - min(weights_list)) <= PLATEAU_WEIGHT_TOLERANCE_KG
    )
    return reps_stable and weight_stable


def compute_measurements(
    db: Session,
    session: WorkoutSession,
    compared_session: Optional[WorkoutSession],
    ai_tracked_exercise_ids: set[int],
) -> SessionReportMeasurements:
    """ai_tracked_exercise_idsは、AI回数カウント較正済み（rep_count_modelsに
    登録済み）の種目IDの集合。routerでexercise_crud.get_rep_count_modelを
    種目ごとに引いて渡す。AI計測対応種目は「実際に記録されたセット数」を、
    非対応種目は（現状マーク手段が無いため）従来通りセット行数をそのまま
    実績として扱う。"""
    prev_by_exercise_id: dict[int, SessionExercise] = (
        {se.exercise_id: se for se in compared_session.session_exercises}
        if compared_session is not None
        else {}
    )

    exercises: list[ExerciseComparison] = []
    achievement_values: list[float] = []

    for se in sorted(session.session_exercises, key=lambda x: x.order_index):
        is_ai_tracked = se.exercise_id in ai_tracked_exercise_ids
        non_warmup_sets = [s for s in se.sets if not s.is_warmup]
        if is_ai_tracked:
            actual_sets = sum(1 for s in non_warmup_sets if s.ai_counted_reps is not None)
        else:
            actual_sets = len(non_warmup_sets)

        achievement_pct: Optional[float] = None
        if is_ai_tracked:
            # AI計測対応種目は、計画したレップ数（session_sets.reps＝登録時の
            # 目標値）の合計に対する、実測レップ数（ai_counted_reps）の合計の
            # 割合で達成率を出す。セット数だけ見ていた以前の実装だと、目標
            # 5回+10回に対し実測が合計14回でもセットさえ埋まっていれば100%に
            # なってしまっていた（2026-08-28、ユーザー報告で発覚）。
            target_reps_total = sum(s.reps for s in non_warmup_sets if s.reps is not None)
            actual_reps_total = sum(
                s.ai_counted_reps for s in non_warmup_sets if s.ai_counted_reps is not None
            )
            if target_reps_total:
                achievement_pct = round(actual_reps_total / target_reps_total * 100, 1)
                achievement_values.append(achievement_pct)
        elif se.target_sets:
            achievement_pct = round(actual_sets / se.target_sets * 100, 1)
            achievement_values.append(achievement_pct)

        avg_weight, avg_reps, avg_rpe = _avg_metrics(se, is_ai_tracked)
        prev_avg_weight, prev_avg_reps, prev_avg_rpe = _avg_metrics(
            prev_by_exercise_id.get(se.exercise_id), is_ai_tracked
        )
        sets_result = _set_results(se, is_ai_tracked)
        prev_sets_result = _set_results(prev_by_exercise_id.get(se.exercise_id), is_ai_tracked)

        weight_change_pct: Optional[float] = None
        if avg_weight is not None and prev_avg_weight:
            weight_change_pct = round((avg_weight - prev_avg_weight) / prev_avg_weight * 100, 1)

        # RPE予測：生涯ベストe1RM（今回より前）に対する今回の平均重量の%1RMから
        # 予測RPEを算出し、実測RPEとの差を見る。
        predicted_rpe: Optional[float] = None
        rpe_deviation: Optional[float] = None
        if avg_weight is not None and avg_reps is not None:
            prior_best_e1rm = get_prior_best_e1rm(db, session.user_id, se.exercise_id, session.id)
            if prior_best_e1rm:
                pct_1rm = estimate_1rm(avg_weight, round(avg_reps)) / prior_best_e1rm * 100
                predicted_rpe = predict_rpe_from_pct_1rm(pct_1rm)
                if avg_rpe is not None:
                    rpe_deviation = round(avg_rpe - predicted_rpe, 1)

        is_plateaued = _detect_plateau(db, session.user_id, se, is_ai_tracked)

        exercises.append(
            ExerciseComparison(
                exercise_id=se.exercise_id,
                exercise_name=se.exercise.name,
                target_sets=se.target_sets,
                actual_sets=actual_sets,
                achievement_pct=achievement_pct,
                avg_weight_kg=avg_weight,
                avg_reps=avg_reps,
                avg_rpe=avg_rpe,
                prev_avg_weight_kg=prev_avg_weight,
                prev_avg_reps=prev_avg_reps,
                prev_avg_rpe=prev_avg_rpe,
                weight_change_pct=weight_change_pct,
                sets=sets_result,
                prev_sets=prev_sets_result,
                predicted_rpe=predicted_rpe,
                rpe_deviation=rpe_deviation,
                is_plateaued=is_plateaued,
            )
        )

    overall_achievement_pct = (
        round(sum(achievement_values) / len(achievement_values), 1)
        if achievement_values
        else None
    )

    return SessionReportMeasurements(
        exercises=exercises,
        overall_achievement_pct=overall_achievement_pct,
        has_comparison=compared_session is not None,
    )


def judge_session_aspects(measurements: SessionReportMeasurements) -> list[str]:
    """観点ごとの判定コードサフィックス（例: "achievement_good", "improved"）を返す。
    ai_review_prompt_parts.codeは"session_"プレフィックスでこのサフィックスと結合される
    （例: "session_achievement_good"）。"""
    aspects: list[str] = []

    if measurements.overall_achievement_pct is not None:
        if measurements.overall_achievement_pct >= ACHIEVEMENT_GOOD_THRESHOLD_PCT:
            aspects.append("achievement_good")
        else:
            aspects.append("achievement_low")

    # 前回比較：種目ごとのweight_change_pctの平均で全体の傾向を判定する。
    changes = [ex.weight_change_pct for ex in measurements.exercises if ex.weight_change_pct is not None]
    if changes:
        avg_change = sum(changes) / len(changes)
        if avg_change >= IMPROVEMENT_TOLERANCE * 100:
            aspects.append("improved")
        elif avg_change <= -IMPROVEMENT_TOLERANCE * 100:
            aspects.append("declined")

    # RPE予測より実測が明確にきつかった種目が1つでもあれば、対策を促すパーツを使う
    # （特に重量が下がっている時に有効。プロンプト側で文脈を渡す）。
    if any(
        ex.rpe_deviation is not None and ex.rpe_deviation >= RPE_HARDER_THRESHOLD
        for ex in measurements.exercises
    ):
        aspects.append("rpe_harder_than_expected")

    # 停滞している種目が1つでもあれば加重を勧めるパーツを使う。
    if any(ex.is_plateaued for ex in measurements.exercises):
        aspects.append("plateau_add_weight")

    return aspects


def find_compared_session(db: Session, session: WorkoutSession) -> Optional[WorkoutSession]:
    """同じユーザーで、同じ種目構成（exercise_idの集合が完全一致）を含む直近の
    完了済みセッションを探す（自分自身は除く）。見つからなければNone。"""
    from app.crud.workout import STATUS_COMPLETED, _SESSION_LOAD_OPTIONS

    exercise_ids = {se.exercise_id for se in session.session_exercises}
    if not exercise_ids:
        return None

    stmt = (
        select(WorkoutSession)
        .where(
            WorkoutSession.user_id == session.user_id,
            WorkoutSession.id != session.id,
            WorkoutSession.status_id == STATUS_COMPLETED,
        )
        .options(*_SESSION_LOAD_OPTIONS)
        .order_by(WorkoutSession.ended_at.desc())
    )
    for candidate in db.scalars(stmt).all():
        candidate_exercise_ids = {se.exercise_id for se in candidate.session_exercises}
        if candidate_exercise_ids == exercise_ids:
            return candidate
    return None
