"""Rep-counting state machine + calibration ("learning") for a label's model.

The "model" here is NOT a neural net. It is the set of state-machine thresholds
that best reproduce the registered true rep counts (RecordingSession.true_reps)
across a tag's labeled sessions. Calibration = grid search over those thresholds.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Optional

from pose_analysis import JOINT_DEFINITIONS_JA, _angle_at

# 1レップ・テンプレートの正規化ビン数（サイクルを 0〜100% にリサンプルする解像度）。
TEMPLATE_BINS = 32


@dataclass
class RepConfig:
    """ヒステリシス状態機械の閾値。frontend(lib/repCount.ts)と同じ意味。"""

    smooth_window: int = 5
    enter_ratio: float = 0.3
    exit_ratio: float = 0.7
    min_period_frames: int = 8
    min_rom_deg: float = 15.0
    # --- 連続性が途切れたら区切ってリセットするための設定（較正対象外の固定値）---
    # フレーム番号の隙間がこれを超えたら姿勢ロストとみなし区切る。区切りの根拠は
    # これ「だけ」。角速度（フレーム跳躍）では区切らない＝速さで波を分断しない。
    max_gap_frames: int = 6
    # デグリッチ用しきい値。1フレームだけ両隣から max_step_deg 超で飛び、すぐ戻る
    # 外れ値（ランドマークのワープ）を両隣平均で置換するのに使う。持続的な速い動作
    # は連続して同方向に動くため触らない＝速さ非依存。以前は「跳躍でクリップを分断」
    # する用途だったが、走行など速い動作を姿勢ロストと誤判定して波を寸断しレップを
    # 潰すため廃止し、単一フレームのスパイク除去に転用した。
    max_step_deg: float = 60.0
    # 区切った塊がこのフレーム数未満なら短すぎるとして捨てる。
    min_segment_frames: int = 8
    # 下降・上昇の追跡中に許容する逆行量（ROM比）。これを超える逆行は
    # 連続性の破れとみなし、サイクル検出を最初からやり直す。速さで波を分断しなく
    # なった分、ここは締めても本物のレップは落ちず、怪しい遅サイクルを弾ける。
    reversal_tol_ratio: float = 0.10


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


def _declitch(
    angles: list[float], frames: list[int], max_step_deg: float
) -> list[float]:
    """単一フレームだけ両隣から max_step_deg 超で飛び、すぐ戻る外れ値（ランドマークの
    ワープ）を両隣の平均で置換する。

    持続的な速い動作は連続して同方向に動く（cur は prev と next の間に入る）ので
    「両隣どちらからも飛び、かつ両隣どうしは近い」条件に当たらず、触らない。よって
    速さには依存せず、本物のトラッキング破綻スパイクだけを均す。フレーム間隔 gap は
    しきい値をスケール（gap フレーム空いていれば gap 倍まで許容）。
    """
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


def count_reps(
    points: list[dict], cfg: RepConfig
) -> tuple[int, list[tuple[int, int]], float]:
    """1関節の (frame, angle) 列から回数を数える。
    戻り値 = (回数, 各回の (開始フレーム, 完了フレーム), ROM)。
    開始フレームは「そのレップの下降追跡を開始（アーム）した点」なので、サイクル
    区間の切り出しに探索中の助走が混ざらない。

    連続性ベースのカウント:「伸ばし域(high超)から連続して low まで下降し、そのまま
    連続して high まで戻る」1サイクルを観測できたときだけ1回と数える。下降・上昇の
    途中で許容量(tol)を超える逆行があれば連続性の破れとみなし、最初（伸ばし域の
    検出）からやり直す。
    フレーム軸そのままの生 series を渡すこと（0〜100%正規化したカーブは不可）。
    """
    if len(points) < 2:
        return 0, [], 0.0
    sorted_pts = sorted(points, key=lambda p: p["frame"])
    frame_list = [int(p["frame"]) for p in sorted_pts]
    # 単一フレームのワープスパイクだけ均してから平滑化（速い動作は温存）。
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
    tol = rom * cfg.reversal_tol_ratio  # これを超える逆行 = 連続性の破れ

    # search: 伸ばし域(high超)の出現待ち / down: 連続下降を追跡 / up: 連続上昇を追跡
    state = "search"
    extreme = 0.0  # down では下降中の最小値、up では上昇中の最大値
    cycle_start = 0  # 現在追跡中のレップの開始（下降アーム）フレーム
    count = 0
    last_rep = float("-inf")
    reps: list[tuple[int, int]] = []
    for i, a in enumerate(angles):
        frame = int(sorted_pts[i]["frame"])
        if state == "search":
            if a > high:
                state = "down"
                extreme = a
                cycle_start = frame
        elif state == "down":
            if a < extreme:
                extreme = a
            elif a - extreme > tol:  # ボトムから tol 超の上昇 = 切り返し or 逆行
                if extreme < low:  # 深い域まで下降済み → 本物の切り返し(上昇開始)
                    state = "up"
                    extreme = a
                elif a > high:  # 深い域に達する前に伸ばし域へ戻った → 再アーム
                    extreme = a
                    cycle_start = frame
                else:  # 中途半端な逆行 → 連続性の破れ
                    state = "search"
        else:  # state == "up"
            if a > high:  # 連続上昇のまま伸ばし域に復帰 = 1サイクル完了
                if frame - last_rep >= cfg.min_period_frames:
                    count += 1
                    reps.append((cycle_start, frame))
                    last_rep = frame
                state = "down"
                extreme = a  # そのまま次のレップの下降追跡へ
                cycle_start = frame
            elif a > extreme:
                extreme = a
            elif extreme - a > tol:  # 上昇中の逆行 → 連続性の破れ
                state = "search"
    return count, reps, rom


def _split_into_segments(points: list[dict], cfg: RepConfig) -> list[list[dict]]:
    """姿勢ロスト（フレーム欠損）でのみ系列を塊に分割する。

    区切りの根拠はフレーム番号の隙間が max_gap_frames を超えたときだけ。角度の跳躍
    （角速度スパイク）では区切らない: 走行など速い動作は1フレームで大きく角度が動く
    ため、跳躍で区切ると正当な波を寸断してレップを潰す。単発のワープスパイクは
    count_reps 内の _declitch が均すので、ここで分断する必要はない。
    """
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
    """連続性が途切れる点で区切り、塊ごとに状態機械を独立して走らせて合算する。

    途切れるたびに状態は neutral から再スタート（＝1からやり直す）。ROM も塊ごとに
    取り直すので、外れ値や別動作ブロックの影響が局所化される。
    戻り値: {"count", "rep_frames", "rom"(最大塊ROM), "segments"(採用塊数)}。
    """
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
    joint_series: dict[str, list[dict]],
    candidates: list[str],
    cfg: RepConfig,
) -> dict:
    """候補関節の中で最も動いた（塊ROM最大）関節を主役に選び、区間分割して数える。

    joint_series: joint_name -> [{"frame","angle"}, ...]
    candidates:   監視関節。空なら全関節が候補。
    """
    allow = set(candidates) if candidates else None
    best = {"joint": None, "count": 0, "rom": 0.0, "rep_frames": [], "segments": 0}
    for joint, pts in joint_series.items():
        if allow is not None and joint not in allow:
            continue
        r = count_reps_segmented(pts, cfg)
        if r["rom"] > best["rom"]:
            best = {"joint": joint, **r}
    return best


# --- Cycle extraction + 1-rep template ------------------------------------


def _cycle_intervals(points: list[dict], cfg: RepConfig) -> list[tuple]:
    """検出した各レップに対応する1サイクル区間を返す。

    各区間は (start_frame, end_frame, segment_points)。start/end は状態機械が出した
    そのレップの開始（下降アーム）/完了フレームなので、探索中の助走は含まれない。
    区間が塊をまたがないよう、塊（連続性で分割した単位）ごとに切り出す。
    """
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
    """1サイクルの (frame, angle) を、振幅0〜1・時間0〜1の n_bins ベクトルに正規化。

    振幅を 0〜1 に潰すことで、人や撮影による角度の絶対値差を消し「形」だけを比較
    できる（ROM 自体は状態機械側で別途ゲートしている）。
    """
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


def extract_cycle_vectors(
    points: list[dict], cfg: RepConfig, n_bins: int = TEMPLATE_BINS
) -> list[list[float]]:
    """1関節の系列から、各サイクルを正規化ベクトルにして集める。"""
    vecs: list[list[float]] = []
    for start, end, seg_sorted in _cycle_intervals(points, cfg):
        sub = [p for p in seg_sorted if start <= int(p["frame"]) <= end]
        v = _amp_normalized_resample(sub, n_bins)
        if v is not None:
            vecs.append(v)
    return vecs


def _mean_std_vectors(vectors: list[list[float]]) -> tuple[list[float], list[float]]:
    n = len(vectors)
    bins = len(vectors[0])
    mean = [0.0] * bins
    for v in vectors:
        for i in range(bins):
            mean[i] += v[i]
    mean = [m / n for m in mean]
    std = [0.0] * bins
    if n > 1:
        for v in vectors:
            for i in range(bins):
                std[i] += (v[i] - mean[i]) ** 2
        std = [math.sqrt(s / n) for s in std]
    return mean, std


def template_distance(vec: list[float], mean: list[float]) -> float:
    """テンプレ平均カーブとの形状距離（ビンごとの RMSE）。"""
    n = len(mean)
    s = 0.0
    for i in range(n):
        d = vec[i] - mean[i]
        s += d * d
    return math.sqrt(s / n) if n else 1.0


def pick_main_joint(
    labeled_sessions: list[tuple[dict[str, list[dict]], int]],
    candidates: list[str],
    cfg: RepConfig,
) -> Optional[str]:
    """全学習セッションを通して、最も大きく動いた（塊ROM合計が最大の）関節を主役に固定。"""
    allow = set(candidates) if candidates else None
    totals: dict[str, float] = {}
    for joint_series, _ in labeled_sessions:
        for joint, pts in joint_series.items():
            if allow is not None and joint not in allow:
                continue
            totals[joint] = totals.get(joint, 0.0) + count_reps_segmented(pts, cfg)["rom"]
    if not totals:
        return None
    return max(totals, key=lambda k: totals[k])


def build_template_for_sessions(
    labeled_sessions: list[tuple[dict[str, list[dict]], int]],
    main_joint: Optional[str],
    cfg: RepConfig,
    n_bins: int = TEMPLATE_BINS,
) -> tuple[Optional[dict], float, int]:
    """主役関節の全サイクルから 1レップ標準カーブ（mean/std）と形状しきい値を学習。

    しきい値は学習サイクルが全て通る値（最大距離×余裕）に設定。これで学習データ上の
    カウント精度は維持しつつ、新規データでは形の違うサイクルを棄却できる。
    戻り値: (template or None, shape_threshold, cycle_count)。
    """
    if not main_joint:
        return None, 0.3, 0
    vecs: list[list[float]] = []
    for joint_series, _ in labeled_sessions:
        pts = joint_series.get(main_joint)
        if pts:
            vecs.extend(extract_cycle_vectors(pts, cfg, n_bins))
    if not vecs:
        return None, 0.3, 0
    mean, std = _mean_std_vectors(vecs)
    dists = [template_distance(v, mean) for v in vecs]
    thr = min(0.5, max(max(dists) * 1.3, 0.12))
    template = {
        "bins": n_bins,
        "mean": [round(x, 4) for x in mean],
        "std": [round(x, 4) for x in std],
    }
    return template, round(thr, 4), len(vecs)


# --- Cycle statistics gates -------------------------------------------------

# 統計ゲートの余裕幅。学習サイクルの実測レンジに対するマージン。
# 角度: カメラアングルや人による絶対角度のブレを見込む(度)。
_GATE_ANGLE_MARGIN_DEG = 15.0
# ROM: 実測の最小×0.6 〜 最大×1.6 まで許容。
# 注: 周期（所要フレーム数）ゲートは廃止。速さに依存する判定基準であり、テンポの
# 違うだけの正しいレップを棄却してしまうため。速さ非依存な「形テンプレート」が
# 走行/ノイズサイクルの棄却を肩代わりする（本物=対称V字 / ノイズ=平底プラトー）。
_GATE_ROM_SCALE = (0.6, 1.6)


def _cycle_stat(sub: list[dict]) -> Optional[tuple[float, float, int]]:
    """1サイクル区間の (ボトム角度, トップ角度, 周期フレーム数) を実測する。"""
    if len(sub) < 3:
        return None
    angles = [float(p["angle"]) for p in sub]
    frames = [int(p["frame"]) for p in sub]
    return min(angles), max(angles), frames[-1] - frames[0]


def build_cycle_stats(
    labeled_sessions: list[tuple[dict[str, list[dict]], int]],
    main_joint: Optional[str],
    cfg: RepConfig,
) -> Optional[dict]:
    """主役関節の全学習サイクルから、絶対角度帯・ROM帯のゲートを学習する（周期は不使用）。

    状態機械の low/high はクリップ自身の ROM 基準の相対値で自己正規化してしまう
    ため、それだけではどんな動きも「それらしく」見える。そこで「本物のレップの
    絶対的な姿」（曲げ切り/伸ばし切りの絶対角度・実ROM）を実測レンジ＋余裕幅で保存し、
    チェック時に外れたサイクルを棄却する。周期（所要フレーム）は速さ依存なのでゲート
    に使わない——テンポ違いの棄却は形テンプレートが担う。
    """
    if not main_joint:
        return None
    bottoms: list[float] = []
    tops: list[float] = []
    for joint_series, _ in labeled_sessions:
        pts = joint_series.get(main_joint)
        if not pts:
            continue
        for start, end, seg_sorted in _cycle_intervals(pts, cfg):
            sub = [p for p in seg_sorted if start <= int(p["frame"]) <= end]
            st = _cycle_stat(sub)
            if st is None:
                continue
            bottom, top, _period = st
            bottoms.append(bottom)
            tops.append(top)
    if not bottoms:
        return None
    roms = [t - b for b, t in zip(bottoms, tops)]
    return {
        "bottomDeg": [
            round(min(bottoms) - _GATE_ANGLE_MARGIN_DEG, 1),
            round(max(bottoms) + _GATE_ANGLE_MARGIN_DEG, 1),
        ],
        "topDeg": [
            round(min(tops) - _GATE_ANGLE_MARGIN_DEG, 1),
            round(max(tops) + _GATE_ANGLE_MARGIN_DEG, 1),
        ],
        "romDeg": [
            round(min(roms) * _GATE_ROM_SCALE[0], 1),
            round(max(roms) * _GATE_ROM_SCALE[1], 1),
        ],
        "cycleCount": len(bottoms),
    }


def _passes_cycle_stats(sub: list[dict], stats: dict) -> bool:
    """候補サイクルが学習済みの絶対角度帯・ROM帯に収まっているか（周期は判定しない）。"""
    st = _cycle_stat(sub)
    if st is None:
        return False
    bottom, top, _period = st
    b0, b1 = stats["bottomDeg"]
    t0, t1 = stats["topDeg"]
    r0, r1 = stats["romDeg"]
    rom = top - bottom
    return b0 <= bottom <= b1 and t0 <= top <= t1 and r0 <= rom <= r1


def count_with_template(
    joint_series: dict[str, list[dict]],
    candidates: list[str],
    cfg: RepConfig,
    main_joint: Optional[str],
    template: Optional[dict],
    shape_threshold: float,
    cycle_stats: Optional[dict] = None,
) -> dict:
    """主役関節で候補サイクルを出し、統計ゲート（絶対角度帯・ROM帯）と
    テンプレの形状フィルタを両方通ったものだけを1回として数える。

    template / cycle_stats が無ければ、それぞれのフィルタなしにフォールバック。

    戻り値の "cycles" は各候補サイクルの検証内訳（採用/棄却・棄却理由・形状距離・
    振幅正規化ベクトル）で、チェック画面で「どう判定したか」を可視化するのに使う:
      reason ∈ {"ok", "stats"(統計ゲート外), "shape"(形が違う), "short"(短くて評価不能)}
    """
    pts = joint_series.get(main_joint) if main_joint else None
    joint = main_joint if pts else None
    if not pts:  # 主役関節がこのクリップに無ければ ROM 最大の候補で代用
        fb = count_for_session(joint_series, candidates, cfg)
        joint = fb["joint"]
        pts = joint_series.get(joint) if joint else None
    if not pts:
        return {
            "joint": None, "count": 0, "rom": 0.0, "rep_frames": [],
            "segments": 0, "accepted": 0, "rejected": 0, "cycles": [],
        }

    mean = template["mean"] if template else None
    n_bins = len(mean) if mean else TEMPLATE_BINS
    accepted = 0
    rejected = 0
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

        # 統計ゲート: 学習した絶対角度帯・ROM帯から外れるサイクルは棄却（周期は不使用）
        if cycle_stats is not None and not _passes_cycle_stats(sub, cycle_stats):
            rejected += 1
            info["accepted"] = False
            info["reason"] = "stats"
            cycles.append(info)
            continue
        if mean is None:
            accepted += 1
            rep_frames.append(end)
            info["accepted"] = True
            info["reason"] = "ok"
            cycles.append(info)
            continue
        if vec is None:
            rejected += 1
            info["accepted"] = False
            info["reason"] = "short"
            cycles.append(info)
            continue
        dist = template_distance(vec, mean)
        info["distance"] = round(dist, 4)
        if dist <= shape_threshold:
            accepted += 1
            rep_frames.append(end)
            info["accepted"] = True
            info["reason"] = "ok"
        else:
            rejected += 1
            info["accepted"] = False
            info["reason"] = "shape"
        cycles.append(info)

    rom = 0.0
    for seg in _split_into_segments(pts, cfg):
        if len(seg) >= cfg.min_segment_frames:
            _, _, r = count_reps(seg, cfg)
            rom = max(rom, r)

    return {
        "joint": joint,
        "count": accepted,
        "rom": rom,
        "rep_frames": rep_frames,
        "segments": len(seg_ids),
        "accepted": accepted,
        "rejected": rejected,
        "cycles": cycles,
    }


# --- Calibration (= "learning") -------------------------------------------

_GRID_SMOOTH = [3, 5, 7, 9]
_GRID_ENTER = [0.2, 0.25, 0.3, 0.35, 0.4]
_GRID_EXIT = [0.6, 0.65, 0.7, 0.75, 0.8]
_GRID_MIN_PERIOD = [5, 8, 12]
_GRID_MIN_ROM = [10.0, 15.0, 20.0]
_GRID_REVERSAL = [0.08, 0.12, 0.16, 0.22]


def calibrate(
    labeled_sessions: list[tuple[dict[str, list[dict]], int]],
    candidates: list[str],
) -> tuple[RepConfig, dict]:
    """正解回数つきセッション群に対し、ズレ合計が最小になる閾値をグリッドサーチ。

    連続性ロジックの核心である許容逆行量(reversal_tol_ratio)も探索対象。
    精度が同点の設定が複数あるときは「最も厳しい」設定を選ぶ（マージン最大化）:
    逆行許容が小さい → 最小ROMが大きい → ヒステリシス幅が広い → 最短周期が長い、
    の優先順。正解データの回数を再現できる範囲で受理領域を最小にすることで、
    計数対象外の動きへの棄却力を最大化する。

    labeled_sessions: [(joint_series, true_reps), ...]
    candidates:       監視関節（[] なら全関節）
    戻り値: (best_cfg, metrics)。metrics は mae / exact_match_rate / session_count。
    """
    n = len(labeled_sessions)
    best_cfg: Optional[RepConfig] = None
    best_score: Optional[tuple] = None
    best_metrics: dict = {"mae": None, "exact_match_rate": None, "session_count": n}

    if n == 0:
        return RepConfig(), best_metrics

    for sw in _GRID_SMOOTH:
        for en in _GRID_ENTER:
            for ex in _GRID_EXIT:
                if ex - en < 0.2:  # 閾値の幅が狭すぎる組合せは捨てる
                    continue
                for mp in _GRID_MIN_PERIOD:
                    for mr in _GRID_MIN_ROM:
                        for rt in _GRID_REVERSAL:
                            cfg = RepConfig(
                                sw, en, ex, mp, mr, reversal_tol_ratio=rt
                            )
                            total_abs = 0
                            exact = 0
                            for joint_series, true_reps in labeled_sessions:
                                res = count_for_session(joint_series, candidates, cfg)
                                err = abs(res["count"] - true_reps)
                                total_abs += err
                                if err == 0:
                                    exact += 1
                            mae = total_abs / n
                            # ズレ最小 → 一致数が多い方 → 同点なら最も厳しい設定
                            strictness = (rt, -mr, -(ex - en), -mp)
                            score = (mae, -exact, *strictness)
                            if best_score is None or score < best_score:
                                best_score = score
                                best_cfg = cfg
                                best_metrics = {
                                    "mae": round(mae, 3),
                                    "exact_match_rate": round(exact / n, 3),
                                    "session_count": n,
                                }

    return best_cfg or RepConfig(), best_metrics


# --- Serialization (camelCase to match frontend lib/repCount.ts) ----------


def cfg_to_dict(cfg: RepConfig, candidates: list[str]) -> dict:
    return {
        "smoothWindow": cfg.smooth_window,
        "enterRatio": cfg.enter_ratio,
        "exitRatio": cfg.exit_ratio,
        "minPeriodFrames": cfg.min_period_frames,
        "minRomDeg": cfg.min_rom_deg,
        "maxGapFrames": cfg.max_gap_frames,
        "maxStepDeg": cfg.max_step_deg,
        "minSegmentFrames": cfg.min_segment_frames,
        "reversalTolRatio": cfg.reversal_tol_ratio,
        "candidates": list(candidates),
    }


def cfg_from_dict(d: dict) -> tuple[RepConfig, list[str]]:
    cfg = RepConfig(
        smooth_window=int(d.get("smoothWindow", 5)),
        enter_ratio=float(d.get("enterRatio", 0.3)),
        exit_ratio=float(d.get("exitRatio", 0.7)),
        min_period_frames=int(d.get("minPeriodFrames", 8)),
        min_rom_deg=float(d.get("minRomDeg", 15.0)),
        max_gap_frames=int(d.get("maxGapFrames", 6)),
        # 旧モデルは maxStepDeg=25 を焼き込んでいるが、この値は較正対象ではない固定
        # ガードで、25 は速い動作を誤って断片化する。下限60でフロアし、再学習不要で
        # 既存モデルも救済する。
        max_step_deg=max(60.0, float(d.get("maxStepDeg", 60.0))),
        min_segment_frames=int(d.get("minSegmentFrames", 8)),
        reversal_tol_ratio=float(d.get("reversalTolRatio", 0.15)),
    )
    candidates = [str(x) for x in d.get("candidates", [])]
    return cfg, candidates


def model_to_dict(
    cfg: RepConfig,
    candidates: list[str],
    main_joint: Optional[str],
    template: Optional[dict],
    shape_threshold: float,
    cycle_count: int,
    cycle_stats: Optional[dict] = None,
) -> dict:
    """model 全体（閾値＋主役関節＋1レップテンプレート＋統計ゲート）を保存用 dict にする。"""
    d = cfg_to_dict(cfg, candidates)
    d["mainJoint"] = main_joint
    d["template"] = template
    d["shapeThreshold"] = shape_threshold
    d["cycleCount"] = cycle_count
    d["cycleStats"] = cycle_stats
    return d


def model_from_dict(d: dict):
    """保存 dict から
    (cfg, candidates, main_joint, template, shape_threshold, cycle_stats) を復元。"""
    cfg, candidates = cfg_from_dict(d)
    main_joint = d.get("mainJoint")
    template = d.get("template")
    shape_threshold = float(d.get("shapeThreshold", 0.3))
    cycle_stats = d.get("cycleStats")
    return cfg, candidates, main_joint, template, shape_threshold, cycle_stats


def joint_series_from_frames(
    frames: Iterable[tuple[int, list]],
    joints: Iterable[str],
) -> dict[str, list[dict]]:
    """姿勢推定済みフレーム列から、指定関節の角度系列を作る（チェッカー用）。

    frames: (frame_number, landmarks_list) の列。landmarks は MediaPipe の33点。
    """
    defs = {n: JOINT_DEFINITIONS_JA[n] for n in joints if n in JOINT_DEFINITIONS_JA}
    out: dict[str, list[dict]] = {n: [] for n in defs}
    for frame_number, landmarks in frames:
        if not isinstance(landmarks, list) or len(landmarks) < 33:
            continue
        for name, (ai, bi, ci) in defs.items():
            try:
                angle = _angle_at(landmarks[ai], landmarks[bi], landmarks[ci])
            except (KeyError, IndexError, TypeError):
                angle = None
            if angle is not None:
                out[name].append({"frame": int(frame_number), "angle": round(angle, 2)})
    return out
