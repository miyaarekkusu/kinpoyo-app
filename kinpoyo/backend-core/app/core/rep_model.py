"""録画済み動画からの回数カウント推論（model-studio backend/rep_model.py、変更禁止、
からの移植）。

model-studio側は「較正（学習）」と「推論（カウント）」の両方を持つが、ここでは
**推論に必要な部分だけ**を移植している。較正（calibrate/build_template_for_sessions/
build_cycle_stats/grid search等）はmodel-studio専用のまま——本アプリはmodel-studioで
較正済みのモデル（rep_count_models.config_json）を読み込んで使うだけで、自前で較正は
行わない。

ロジックは「ヒステリシス状態機械で候補サイクルを検出→1レップ形状テンプレート照合＋
統計ゲート（絶対角度帯・ROM帯）の両方を通ったものだけ採用」という、model-studioで
mae=0.0・完全一致率100%の実績があるフル版アルゴリズム。
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Optional

from app.core.pose_analysis import JOINT_DEFINITIONS_JA, angle_at


@dataclass
class RepConfig:
    """ヒステリシス状態機械の閾値。frontendでは廃止済み（判定は全てbackend側で行う）。"""

    smooth_window: int = 5
    enter_ratio: float = 0.3
    exit_ratio: float = 0.7
    min_period_frames: int = 8
    min_rom_deg: float = 15.0
    max_gap_frames: int = 6
    max_step_deg: float = 60.0
    min_segment_frames: int = 8


def _smooth(values: list[float], window: int) -> list[float]:
    """中央寄せの移動平均。端は窓を縮めて平均する。"""
    if window <= 1 or not values:
        return list(values)
    half = window // 2
    n = len(values)
    out: list[float] = []
    for i in range(n):
        s = 0.0
        c = 0
        for k in range(i - half, i + half + 1):
            if 0 <= k < n:
                s += values[k]
                c += 1
        out.append(s / c)
    return out


def _declitch(angles: list[float], frames: list[int], max_step_deg: float) -> list[float]:
    """単一フレームだけ両隣から max_step_deg 超で飛び、すぐ戻る外れ値を両隣平均で置換する。"""
    n = len(angles)
    if n < 3:
        return list(angles)
    out = list(angles)
    for i in range(1, n - 1):
        prev, cur, nxt = angles[i - 1], angles[i], angles[i + 1]
        gap_prev = max(1, frames[i] - frames[i - 1])
        gap_next = max(1, frames[i + 1] - frames[i])
        spike_from_prev = abs(cur - prev) > max_step_deg * gap_prev
        spike_from_next = abs(cur - nxt) > max_step_deg * gap_next
        neighbors_agree = abs(prev - nxt) <= max_step_deg * max(gap_prev, gap_next)
        if spike_from_prev and spike_from_next and neighbors_agree:
            out[i] = (prev + nxt) / 2.0
    return out


def count_reps(points: list[dict], cfg: RepConfig) -> tuple[int, list[tuple[int, int]], float]:
    """1関節の (frame, angle) 列から回数を数える。戻り値 = (回数, 各回の区間, ROM)。"""
    if len(points) < 2:
        return 0, [], 0.0
    sorted_pts = sorted(points, key=lambda p: p["frame"])
    frame_list = [int(p["frame"]) for p in sorted_pts]
    declitched = _declitch(
        [float(p["angle"]) for p in sorted_pts], frame_list, cfg.max_step_deg
    )
    angles = _smooth(declitched, cfg.smooth_window)

    lo = min(angles)
    hi = max(angles)
    rom = hi - lo
    if rom < cfg.min_rom_deg:
        return 0, [], rom

    low = lo + rom * cfg.enter_ratio
    high = lo + rom * cfg.exit_ratio

    state = "search"
    cycle_start = 0
    count = 0
    last_rep = float("-inf")
    reps: list[tuple[int, int]] = []
    for i, a in enumerate(angles):
        frame = int(sorted_pts[i]["frame"])
        if state == "search":
            if a > high:
                state = "down"
                cycle_start = frame
        elif state == "down":
            if a > high:
                cycle_start = frame
            elif a < low:
                state = "up"
        else:
            if a > high:
                if frame - last_rep >= cfg.min_period_frames:
                    count += 1
                    reps.append((cycle_start, frame))
                    last_rep = frame
                state = "down"
                cycle_start = frame
    return count, reps, rom


def _split_into_segments(points: list[dict], cfg: RepConfig) -> list[list[dict]]:
    """姿勢ロスト（フレーム欠損）でのみ系列を塊に分割する。"""
    if not points:
        return []
    sorted_pts = sorted(points, key=lambda p: p["frame"])
    segments: list[list[dict]] = []
    cur: list[dict] = [sorted_pts[0]]
    for prev, p in zip(sorted_pts, sorted_pts[1:]):
        gap = int(p["frame"]) - int(prev["frame"])
        if gap > cfg.max_gap_frames:
            segments.append(cur)
            cur = [p]
        else:
            cur.append(p)
    segments.append(cur)
    return segments


def count_reps_segmented(points: list[dict], cfg: RepConfig) -> dict:
    """連続性が途切れる点で区切り、塊ごとに状態機械を独立して走らせて合算する。"""
    segments = _split_into_segments(points, cfg)
    total = 0
    rep_frames: list[int] = []
    max_rom = 0.0
    used = 0
    for seg in segments:
        if len(seg) < cfg.min_segment_frames:
            continue
        c, reps, rom = count_reps(seg, cfg)
        if rom < cfg.min_rom_deg:
            continue
        total += c
        rep_frames.extend(e for _, e in reps)
        max_rom = max(max_rom, rom)
        used += 1
    return {"count": total, "rep_frames": rep_frames, "rom": max_rom, "segments": used}


def count_for_session(
    joint_series: dict[str, list[dict]], candidates: list[str], cfg: RepConfig
) -> dict:
    """候補関節の中で最も動いた（塊ROM最大）関節を主役に選び、区間分割して数える
    （main_jointがそのクリップに存在しない場合のフォールバック用）。"""
    allow = set(candidates) if candidates else None
    best = {"joint": None, "count": 0, "rom": 0.0, "rep_frames": [], "segments": 0}
    for joint, pts in joint_series.items():
        if allow is not None and joint not in allow:
            continue
        r = count_reps_segmented(pts, cfg)
        if r["rom"] > best["rom"]:
            best = {"joint": joint, **r}
    return best


def _cycle_intervals(points: list[dict], cfg: RepConfig) -> list[tuple]:
    """検出した各レップに対応する1サイクル区間を返す。(start_frame, end_frame, segment_points)。"""
    intervals: list[tuple] = []
    for seg in _split_into_segments(points, cfg):
        if len(seg) < cfg.min_segment_frames:
            continue
        _, reps, rom = count_reps(seg, cfg)
        if rom < cfg.min_rom_deg or not reps:
            continue
        seg_sorted = sorted(seg, key=lambda p: p["frame"])
        for s, e in reps:
            intervals.append((int(s), int(e), seg_sorted))
    return intervals


def _amp_normalized_resample(points: list[dict], n_bins: int) -> Optional[list[float]]:
    """1サイクルの (frame, angle) を、振幅0〜1・時間0〜1の n_bins ベクトルに正規化。"""
    if len(points) < 3:
        return None
    sp = sorted(points, key=lambda p: p["frame"])
    frames = [float(p["frame"]) for p in sp]
    angles = [float(p["angle"]) for p in sp]
    amin, amax = min(angles), max(angles)
    rom = amax - amin
    if rom <= 1e-6:
        return None
    norm = [(a - amin) / rom for a in angles]
    f0, f1 = frames[0], frames[-1]
    if f1 == f0:
        return None
    out: list[float] = []
    j = 0
    for k in range(n_bins):
        target = f0 + (k / (n_bins - 1)) * (f1 - f0)
        while j + 1 < len(frames) and frames[j + 1] < target:
            j += 1
        if j + 1 >= len(frames):
            out.append(norm[-1])
            continue
        fa, fb = frames[j], frames[j + 1]
        if fb == fa:
            out.append(norm[j])
        else:
            ratio = (target - fa) / (fb - fa)
            out.append(norm[j] + ratio * (norm[j + 1] - norm[j]))
    return out


def template_distance(vec: list[float], mean: list[float]) -> float:
    """テンプレ平均カーブとの形状距離（ビンごとのRMSE）。"""
    n = len(mean)
    s = 0.0
    for i in range(n):
        d = vec[i] - mean[i]
        s += d * d
    return math.sqrt(s / n) if n else 1.0


def _cycle_stat(sub: list[dict]) -> Optional[tuple[float, float, int]]:
    """1サイクル区間の (ボトム角度, トップ角度, 周期フレーム数) を実測する。"""
    if len(sub) < 3:
        return None
    angles = [float(p["angle"]) for p in sub]
    frames = [int(p["frame"]) for p in sub]
    return min(angles), max(angles), frames[-1] - frames[0]


def _passes_cycle_stats(sub: list[dict], stats: dict) -> bool:
    """候補サイクルが較正済みの絶対角度帯・ROM帯に収まっているか（周期は判定しない）。
    2026-08-28以降、この結果は品質ラベル（good/needs_improvement）にのみ使う。
    カウントの可否には`_passes_validity_gate`を使う（下記）。"""
    st = _cycle_stat(sub)
    if st is None:
        return False
    bottom, top, _period = st
    b0, b1 = stats["bottomDeg"]
    t0, t1 = stats["topDeg"]
    r0, r1 = stats["romDeg"]
    rom = top - bottom
    return b0 <= bottom <= b1 and t0 <= top <= t1 and r0 <= rom <= r1


# --- 妥当性ゲート（2026-08-28追加）------------------------------------------
#
# 経緯：「カウント」と「フォーム評価」を分離した際（2026-08-24）、統計ゲート・
# 形状テンプレートは両方とも品質ラベルのみに格下げされ、カウントの可否は
# ヒステリシス状態機械（ROM・周期のみ）だけで決まるようになった。これにより、
# 較正データより深い/浅い"本物のレップ"を誤って棄却する旧バグは直ったが、
# 副作用として「そもそもこの種目の動きではない候補」（姿勢を整える動作・
# 別の動作等）まで、肘（等）が十分な振れ幅で一往復しさえすれば無条件に
# カウントされてしまうようになった（実機で確認済み）。
#
# 対策：cycle_statsよりさらに大きく緩めた"妥当性ゲート"だけを別途設け、これに
# 外れる候補のみ棄却する（counted=False）。cycle_stats自体（品質ラベル用、
# ±25°マージン）・shape_thresholdは今まで通りカウントの可否に影響しない。
# マージンをcycle_statsよりずっと広く取っているのは、深さ・テンポが多少
# ズレた本物のレップまで弾いてしまった旧設計の失敗を繰り返さないため——
# 「明らかに別の動き」だけを弾く最後の砦、という位置づけ。
#
# 2026-08-28追加（角度帯・ROMのみでは弱いことが実機で判明）：腕の曲げ伸ばしを
# 伴う動きは種目が違っても絶対角度・ROMが被りやすく、角度帯・ROMだけの
# チェックでは「腕立て伏せと無関係な動き」を弾き切れないことが確認された。
# そこで形状テンプレート距離も妥当性ゲートに追加する（品質判定の
# shape_thresholdより緩い倍率を許容）。カーブの"形"（滑らかなV字か等）は
# 種目間でより差が出やすいため、角度帯・ROMより強い判別力を期待できる。
#
# 2026-08-28再修正：角度帯マージン・ROM倍率を一度20.0/(0.6,1.6)まで縮小したが、
# 実機で本物のレップまでカウントされなくなる逆方向の問題が発生したため、
# 元の40.0/(0.5,2.0)に戻した。角度帯・ROMは緩いまま維持し、判別力の強化は
# 形状テンプレート距離（_VALIDITY_GATE_SHAPE_MULTIPLIER）側だけに委ねる方針。
_VALIDITY_GATE_EXTRA_MARGIN_DEG = 40.0
_VALIDITY_GATE_ROM_SCALE = (0.5, 2.0)
_VALIDITY_GATE_SHAPE_MULTIPLIER = 1.6


def _passes_validity_gate(
    sub: list[dict],
    stats: dict,
    dist: Optional[float] = None,
    shape_threshold: Optional[float] = None,
) -> bool:
    """cycle_statsのレンジをさらに緩めた最低限の妥当性チェック（角度帯・ROM＋
    形状距離）。これを外れる候補は品質に関わらずカウントしない（そもそも
    この種目の動きではない可能性が高いため）。"""
    st = _cycle_stat(sub)
    if st is None:
        return False
    bottom, top, _period = st
    b0, b1 = stats["bottomDeg"]
    t0, t1 = stats["topDeg"]
    r0, r1 = stats["romDeg"]
    rom = top - bottom
    vb0 = b0 - _VALIDITY_GATE_EXTRA_MARGIN_DEG
    vb1 = b1 + _VALIDITY_GATE_EXTRA_MARGIN_DEG
    vt0 = t0 - _VALIDITY_GATE_EXTRA_MARGIN_DEG
    vt1 = t1 + _VALIDITY_GATE_EXTRA_MARGIN_DEG
    vr0 = r0 * _VALIDITY_GATE_ROM_SCALE[0]
    vr1 = r1 * _VALIDITY_GATE_ROM_SCALE[1]
    if not (vb0 <= bottom <= vb1 and vt0 <= top <= vt1 and vr0 <= rom <= vr1):
        return False
    if dist is not None and shape_threshold is not None:
        if dist > shape_threshold * _VALIDITY_GATE_SHAPE_MULTIPLIER:
            return False
    return True


# --- 姿勢ゲート（2026-08-28追加）--------------------------------------------
#
# 経緯：妥当性ゲート（角度帯・ROM・形状）を追加しても、「立ったまま肘だけ
# 曲げ伸ばしする」ような、種目と無関係な動きが実機でまだ通過することが判明
# した。原因は、肘の角度だけでは"体全体がどんな向きか"（立位かうつ伏せか）
# が分からないため。app/core/pose_analysis.pyのtorso_orientation_series()で
# 求めた「体幹（肩〜股関節）が垂直軸からどれだけ傾いているか」を使い、種目の
# 想定姿勢と大まかに合っているかを追加でチェックする。
#
# 種目ごとの想定姿勢は較正済みモデル（model-studioのconfig_json）には含まれ
# ないkinpoyo側だけの情報のため、rep_count_models等のテーブルではなく、この
# ファイル内の小さな対応表で管理する（種目が増えたら1行追加するだけでよい
# シンプルさを優先）。"upright"=立位・座位系（体幹はほぼ垂直）、
# "prone"=うつ伏せ系（体幹はほぼ水平）。この2値だけでは仰向け種目（ベンチ
# プレス等、体幹はproneと同じく水平）を区別できないが、対応する種目が無い
# うちは対応不要と判断（詳細はAGENTS.md参照）。
EXERCISE_POSTURE: dict[int, str] = {
    17: "upright",  # スクワット
    4: "prone",  # プッシュアップ
}

# 判定は精密な較正値ではなく「大まかに合っているか」の粗いチェックでよい
# （このゲートの役割はあくまで"明らかに別の姿勢"を弾く最後の砦のため）。
_POSTURE_UPRIGHT_MAX_DEG = 55.0
_POSTURE_PRONE_MIN_DEG = 35.0


def _avg_torso_orientation(
    torso_orientation: dict[int, float], start: int, end: int
) -> Optional[float]:
    vals = [v for f, v in torso_orientation.items() if start <= f <= end]
    if not vals:
        return None
    return sum(vals) / len(vals)


def _passes_posture_gate(avg_deg: Optional[float], posture: Optional[str]) -> bool:
    """種目の想定姿勢（upright/prone）と実測した体幹の向きが大まかに合っているか。
    postureが未登録、または体幹の向きが計測できなかった場合は判定せず通す
    （measurement不能を理由にカウント漏れさせないため）。"""
    if posture is None or avg_deg is None:
        return True
    if posture == "upright":
        return avg_deg <= _POSTURE_UPRIGHT_MAX_DEG
    if posture == "prone":
        return avg_deg >= _POSTURE_PRONE_MIN_DEG
    return True


def count_with_template(
    joint_series: dict[str, list[dict]],
    candidates: list[str],
    cfg: RepConfig,
    main_joint: Optional[str],
    template: Optional[dict],
    shape_threshold: float,
    cycle_stats: Optional[dict] = None,
    torso_orientation: Optional[dict[int, float]] = None,
    posture: Optional[str] = None,
) -> dict:
    """主役関節で候補サイクルを検出し、測定可能なもの（形状ベクトルが計算できる
    もの）は全て1回としてカウントする。

    2026-08-24変更（kinpoyo側のみ・model-studio本体は変更禁止・無変更）：
    「カウント（何回やったか）」と「評価（フォームの質）」を完全に分離した。
    以前は統計ゲート・形状ゲートの両方が「基準を満たさない候補はカウントしない
    （棄却）」という設計だったが、これはユーザー視点では「やったのに数えて
    もらえない」という体験になり、かつAIレビュー機能が担うべき「フォーム評価」
    と「カウント」を混同していた。

    現在の設計：測定可能な候補サイクルは全てカウントし、`form_quality`
    （"good" | "needs_improvement"）でラベル付けするのみ（カウントの可否には
    影響しない）。カウントしないのは `counted=False`（点数が少なすぎて形状
    ベクトルすら計算できず、そもそも1レップとして測定不能）の場合のみ——
    これはフォーム評価ではなくデータ有効性の問題。

    2026-08-28追加：上記に加えて`_passes_validity_gate`（cycle_statsよりさらに
    緩めた絶対角度帯・ROM帯）も`counted=False`の判定に使う。姿勢を整える動作や
    別の動作が、肘等の振れ幅がたまたま十分あるというだけでカウントされて
    しまう問題が実機で見つかったための対策（詳細は`_passes_validity_gate`の
    コメント参照）。cycle_stats自体（±25°マージン）はこれより厳しいので、
    引き続き品質ラベルのみに使う——深さ・テンポが多少ズレた本物のレップまで
    棄却してしまった旧設計の失敗は繰り返さない。

    2026-08-24追加変更：`form_quality`の判定に形状テンプレート距離
    （distance ≤ shape_threshold）**と**深さの較正データ（cycle_stats）との
    整合性（`_passes_cycle_stats`）の両方を使う。形状テンプレート照合は振幅
    正規化（各サイクル自体の最小〜最大を0〜1に正規化）してから比較するため、
    深さが違ってもタイミング・動きのパターンが似ていれば「同じ形」と判定
    されてしまい、深さの違いには反応しない。そのため深さは別途cycle_statsと
    比較し、どちらか一方でも基準から外れていればneeds_improvementとする。
    AIレビュー機能（app/core/review_judge.py）は、ここで付けたform_qualityを
    使わずrep_cycles_jsonの実測値から独自に深さ・テンポを判定しているため、
    二重評価にはなるが矛盾はしない（review_judge側はコメント文生成用、
    ここはcount-repsのその場の結果表示用）。

    2026-08-28追加：`torso_orientation`（フレーム→体幹の向き度数）と`posture`
    （その種目の想定姿勢"upright"|"prone"）を渡すと、`_passes_posture_gate`
    による姿勢チェックも`counted=False`の判定に使う。妥当性ゲート（角度帯・
    ROM・形状）だけでは、立ったまま肘を動かすような無関係な動きを弾き切れ
    なかったための追加対策（詳細は`_passes_posture_gate`のコメント参照）。
    いずれかを渡さなければ姿勢チェックはスキップされる（後方互換）。

    "cycles" は各候補サイクルの内訳（カウント可否・フォーム品質・形状距離）で、
    実装確認・デバッグ用にも使う。
    """
    pts = joint_series.get(main_joint) if main_joint else None
    joint = main_joint if pts else None
    if not pts:
        fb = count_for_session(joint_series, candidates, cfg)
        joint = fb["joint"]
        pts = joint_series.get(joint) if joint else None
    if not pts:
        return {
            "joint": None, "count": 0, "rom": 0.0, "rep_frames": [],
            "segments": 0, "good_form_count": 0, "needs_improvement_count": 0,
            "cycles": [],
        }

    mean = template["mean"] if template else None
    n_bins = len(mean) if mean else 32
    good_form_count = 0
    needs_improvement_count = 0
    rep_frames: list[int] = []
    seg_ids = set()
    cycles: list[dict] = []
    for start, end, seg_sorted in _cycle_intervals(pts, cfg):
        seg_ids.add(id(seg_sorted))
        sub = [p for p in seg_sorted if start <= int(p["frame"]) <= end]
        vec = _amp_normalized_resample(sub, n_bins)
        info: dict = {
            "start": int(start),
            "end": int(end),
            "vector": [round(x, 4) for x in vec] if vec is not None else None,
            "distance": None,
        }
        st = _cycle_stat(sub)
        if st is not None:
            bottom, top, period = st
            info["bottomDeg"] = round(bottom, 1)
            info["topDeg"] = round(top, 1)
            info["period"] = int(period)

        if vec is None:
            # 点数が少なすぎて形状ベクトルすら計算できない＝測定不能。
            # フォーム評価ではなくデータ有効性の問題なのでカウントしない。
            info["counted"] = False
            info["form_quality"] = None
            cycles.append(info)
            continue

        # 距離は妥当性ゲート・品質判定の両方で使うため、ここで一度だけ計算する。
        dist: Optional[float] = None
        if mean is not None:
            dist = template_distance(vec, mean)
            info["distance"] = round(dist, 4)

        if cycle_stats is not None and not _passes_validity_gate(
            sub, cycle_stats, dist, shape_threshold
        ):
            # cycle_statsよりさらに緩い妥当性ゲート（角度帯・ROM＋形状距離）
            # すら外れる＝この種目の動きである可能性が低い（姿勢準備・別動作
            # 等）。品質に関わらずカウントしない。
            info["counted"] = False
            info["form_quality"] = None
            info["invalid"] = True
            info["invalid_reason"] = "movement"
            cycles.append(info)
            continue

        avg_torso_deg = (
            _avg_torso_orientation(torso_orientation, start, end)
            if torso_orientation is not None
            else None
        )
        if avg_torso_deg is not None:
            info["torsoDeg"] = round(avg_torso_deg, 1)
        if not _passes_posture_gate(avg_torso_deg, posture):
            # 体幹の向きが種目の想定姿勢（立位系/うつ伏せ系）と大きく食い違う
            # ＝この種目の動きである可能性が低い。品質に関わらずカウントしない。
            # invalid_reason="posture"は、AIレビュー側で「別の種目・姿勢だった
            # 可能性」をユーザーに伝えるために使う（app/core/review_judge.py参照）。
            info["counted"] = False
            info["form_quality"] = None
            info["invalid"] = True
            info["invalid_reason"] = "posture"
            cycles.append(info)
            continue

        info["counted"] = True
        rep_frames.append(end)

        # 2026-08-24変更：品質判定（good/needs_improvement）に深さも反映する。
        # 「形状（テンポ・滑らかさのパターン）」は振幅正規化された比較のため
        # 深さの違いには反応しない（浅くても深くても、タイミングが似ていれば
        # 同じ形と判定されてしまう）。そのため深さの較正データ（cycle_stats）
        # との比較も別途行い、どちらか一方でも基準から外れていれば
        # needs_improvementとする。カウントするかどうかには影響しない
        # （廃止済みの統計ゲートとは違い、あくまでラベル付けのみに使う）。
        shape_ok = dist is None or dist <= shape_threshold

        depth_ok = True
        if cycle_stats is not None:
            depth_ok = _passes_cycle_stats(sub, cycle_stats)

        if shape_ok and depth_ok:
            good_form_count += 1
            info["form_quality"] = "good"
        else:
            needs_improvement_count += 1
            info["form_quality"] = "needs_improvement"
        cycles.append(info)

    rom = 0.0
    for seg in _split_into_segments(pts, cfg):
        if len(seg) >= cfg.min_segment_frames:
            _, _, r = count_reps(seg, cfg)
            rom = max(rom, r)

    return {
        "joint": joint,
        "count": good_form_count + needs_improvement_count,
        "rom": rom,
        "rep_frames": rep_frames,
        "segments": len(seg_ids),
        "good_form_count": good_form_count,
        "needs_improvement_count": needs_improvement_count,
        "cycles": cycles,
    }


# --- Deserialization (較正済み設定 config_json -> Python オブジェクト) --------------


def cfg_from_dict(d: dict) -> tuple[RepConfig, list[str]]:
    cfg = RepConfig(
        smooth_window=int(d.get("smoothWindow", 5)),
        enter_ratio=float(d.get("enterRatio", 0.3)),
        exit_ratio=float(d.get("exitRatio", 0.7)),
        min_period_frames=int(d.get("minPeriodFrames", 8)),
        min_rom_deg=float(d.get("minRomDeg", 15.0)),
        max_gap_frames=int(d.get("maxGapFrames", 6)),
        max_step_deg=max(60.0, float(d.get("maxStepDeg", 60.0))),
        min_segment_frames=int(d.get("minSegmentFrames", 8)),
    )
    candidates = [str(x) for x in d.get("candidates", [])]
    return cfg, candidates


def model_from_dict(d: dict):
    """保存dictから (cfg, candidates, main_joint, template, shape_threshold, cycle_stats) を復元。"""
    cfg, candidates = cfg_from_dict(d)
    main_joint = d.get("mainJoint")
    template = d.get("template")
    shape_threshold = float(d.get("shapeThreshold", 0.3))
    cycle_stats = d.get("cycleStats")
    return cfg, candidates, main_joint, template, shape_threshold, cycle_stats


def joint_series_from_frames(
    frames: Iterable[tuple[int, list]], joints: Iterable[str]
) -> dict[str, list[dict]]:
    """姿勢推定済みフレーム列から、指定関節の角度系列を作る。
    frames: (frame_number, landmarks_list) の列。landmarks はMediaPipeの33点。
    """
    defs = {n: JOINT_DEFINITIONS_JA[n] for n in joints if n in JOINT_DEFINITIONS_JA}
    out: dict[str, list[dict]] = {n: [] for n in defs}
    for frame_number, landmarks in frames:
        if not isinstance(landmarks, list) or len(landmarks) < 33:
            continue
        for name, (ai, bi, ci) in defs.items():
            try:
                angle = angle_at(landmarks[ai], landmarks[bi], landmarks[ci])
            except (IndexError, KeyError, TypeError):
                angle = None
            if angle is not None:
                out[name].append({"frame": int(frame_number), "angle": round(angle, 2)})
    return out
