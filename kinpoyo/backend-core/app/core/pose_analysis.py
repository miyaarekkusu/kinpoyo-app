"""関節定義とMediaPipeランドマークからの角度計算。

model-studio（../../../model-studio/backend/pose_analysis.py、変更禁止）にある関節定義
・角度計算のロジックのみを移植したもの。学習・分析用のstats/curve集計（タグ較正用）
は本アプリでは不要なため含めない。回数のカウント判定はフロント側（lib/repCount.ts）
で行うため、ここでは「ランドマーク→関節角度」の変換だけを担う。
"""
from __future__ import annotations

import math

# MediaPipe Pose landmark index -> 関節名: (a, vertex, c)。角度は vertex で測る。
JOINT_DEFINITIONS_JA: dict[str, tuple[int, int, int]] = {
    "右肘": (12, 14, 16),   # 右肩 -> 右肘 -> 右手首
    "左肘": (11, 13, 15),
    "右膝": (24, 26, 28),
    "左膝": (23, 25, 27),
    "右肩": (24, 12, 14),   # 右腰 -> 右肩 -> 右肘
    "左肩": (23, 11, 13),
    "右股関節": (12, 24, 26),
    "左股関節": (11, 23, 25),
}


def angle_at(p_a: dict, p_b: dict, p_c: dict) -> float | None:
    """p_bを頂点とする、p_b->p_aとp_b->p_cのなす角度(度)を返す。"""
    vx1, vy1, vz1 = p_a["x"] - p_b["x"], p_a["y"] - p_b["y"], p_a["z"] - p_b["z"]
    vx2, vy2, vz2 = p_c["x"] - p_b["x"], p_c["y"] - p_b["y"], p_c["z"] - p_b["z"]
    dot = vx1 * vx2 + vy1 * vy2 + vz1 * vz2
    mag1 = math.sqrt(vx1 * vx1 + vy1 * vy1 + vz1 * vz1)
    mag2 = math.sqrt(vx2 * vx2 + vy2 * vy2 + vz2 * vz2)
    if mag1 == 0 or mag2 == 0:
        return None
    cos_a = max(-1.0, min(1.0, dot / (mag1 * mag2)))
    return math.degrees(math.acos(cos_a))


def compute_joint_angles(
    landmarks: list[dict], joints: list[str] | None = None
) -> dict[str, float]:
    """ランドマーク列から指定関節（省略時は全8関節）の角度を計算する。
    ランドマーク不足や計算不能な関節は結果から除外する。
    """
    names = joints if joints is not None else list(JOINT_DEFINITIONS_JA)
    out: dict[str, float] = {}
    for name in names:
        defn = JOINT_DEFINITIONS_JA.get(name)
        if defn is None:
            continue
        ai, bi, ci = defn
        try:
            angle = angle_at(landmarks[ai], landmarks[bi], landmarks[ci])
        except (IndexError, KeyError, TypeError):
            angle = None
        if angle is not None:
            out[name] = round(angle, 2)
    return out
