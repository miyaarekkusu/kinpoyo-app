"""Joint angle calculation + Japanese landmark labels for analysis output."""

from __future__ import annotations

import json
import math
import statistics
from typing import Iterable, Optional

# MediaPipe Pose landmark index -> Japanese name.
LANDMARK_LABELS_JA: dict[int, str] = {
    0: "鼻",
    1: "左目(内)", 2: "左目", 3: "左目(外)",
    4: "右目(内)", 5: "右目", 6: "右目(外)",
    7: "左耳", 8: "右耳",
    9: "口(左)", 10: "口(右)",
    11: "左肩", 12: "右肩",
    13: "左肘", 14: "右肘",
    15: "左手首", 16: "右手首",
    17: "左小指", 18: "右小指",
    19: "左人差し指", 20: "右人差し指",
    21: "左親指", 22: "右親指",
    23: "左腰", 24: "右腰",
    25: "左膝", 26: "右膝",
    27: "左足首", 28: "右足首",
    29: "左かかと", 30: "右かかと",
    31: "左つま先", 32: "右つま先",
}

# Joint definition: name -> (a, vertex, c). The angle is measured at "vertex".
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


def _angle_at(p_a: dict, p_b: dict, p_c: dict) -> Optional[float]:
    """Return the angle at p_b between vectors p_b->p_a and p_b->p_c (degrees)."""
    vx1, vy1, vz1 = p_a["x"] - p_b["x"], p_a["y"] - p_b["y"], p_a["z"] - p_b["z"]
    vx2, vy2, vz2 = p_c["x"] - p_b["x"], p_c["y"] - p_b["y"], p_c["z"] - p_b["z"]
    dot = vx1 * vx2 + vy1 * vy2 + vz1 * vz2
    mag1 = math.sqrt(vx1 * vx1 + vy1 * vy1 + vz1 * vz1)
    mag2 = math.sqrt(vx2 * vx2 + vy2 * vy2 + vz2 * vz2)
    if mag1 == 0 or mag2 == 0:
        return None
    cos_a = max(-1.0, min(1.0, dot / (mag1 * mag2)))
    return math.degrees(math.acos(cos_a))


def _stats(values: list[float]) -> dict:
    if not values:
        return {"count": 0, "mean": None, "std": None, "min": None, "max": None}
    return {
        "count": len(values),
        "mean": round(statistics.fmean(values), 2),
        "std": round(statistics.pstdev(values), 2) if len(values) > 1 else 0.0,
        "min": round(min(values), 2),
        "max": round(max(values), 2),
    }


_DEFAULT_CURVE_BINS = 50


def _resample_session_to_bins(
    points: list[dict], n_bins: int
) -> Optional[list[float]]:
    """Linearly resample one session's (frame, angle) points onto a uniform 0..1
    grid of length n_bins. Returns None if the session has too few points."""
    if len(points) < 2:
        return None
    sorted_pts = sorted(points, key=lambda p: p["frame"])
    frames = [p["frame"] for p in sorted_pts]
    angles = [p["angle"] for p in sorted_pts]
    f_min, f_max = frames[0], frames[-1]
    if f_max == f_min:
        return None
    out: list[float] = []
    j = 0
    for k in range(n_bins):
        # target frame value for bin k in [f_min, f_max]
        t = k / (n_bins - 1)
        target = f_min + t * (f_max - f_min)
        while j + 1 < len(frames) and frames[j + 1] < target:
            j += 1
        if j + 1 >= len(frames):
            out.append(angles[-1])
            continue
        f0, f1 = frames[j], frames[j + 1]
        a0, a1 = angles[j], angles[j + 1]
        if f1 == f0:
            out.append(a0)
        else:
            ratio = (target - f0) / (f1 - f0)
            out.append(a0 + ratio * (a1 - a0))
    return out


def _aggregate_curve(
    session_points_map: dict[int, list[dict]],
    session_ids: set[int],
    n_bins: int = _DEFAULT_CURVE_BINS,
) -> list[dict]:
    """Average curves (after 0..1 normalization) across the given sessions.
    Returns a list of {t, angle, n} where n is the number of sessions
    contributing to that bin."""
    resampled: list[list[float]] = []
    for sid in session_ids:
        pts = session_points_map.get(sid)
        if not pts:
            continue
        r = _resample_session_to_bins(pts, n_bins)
        if r is not None:
            resampled.append(r)
    if not resampled:
        return []
    curve: list[dict] = []
    for k in range(n_bins):
        bucket = [r[k] for r in resampled]
        curve.append(
            {
                "t": round(k / (n_bins - 1), 4),
                "angle": round(statistics.fmean(bucket), 2),
                "n": len(bucket),
            }
        )
    return curve


def analyze_sessions(
    session_frames: Iterable[tuple[int, int, str]],
    new_session_ids: Optional[Iterable[int]] = None,
    existing_session_ids: Optional[Iterable[int]] = None,
    monitored_joints: Optional[Iterable[str]] = None,
) -> dict:
    """
    Given an iterable of (session_id, frame_number, pose_landmarks_json),
    compute joint-angle stats, time series per session, and mean landmark
    positions. If new/existing session IDs are supplied, also compute one
    averaged curve per group (normalized to relative time 0..1) for each
    joint, which lets the UI overlay "new vs existing" comparison curves.
    """
    new_set = set(new_session_ids or [])
    existing_set = set(existing_session_ids or [])
    # If a monitored joint list was supplied, only compute for those (validated
    # against the canonical set). Empty/None falls back to all joints, which
    # keeps existing tags working until the user picks per-exercise joints.
    if monitored_joints:
        active_joints = [
            n for n in JOINT_DEFINITIONS_JA if n in set(monitored_joints)
        ]
    else:
        active_joints = list(JOINT_DEFINITIONS_JA)
    active_joint_defs = {n: JOINT_DEFINITIONS_JA[n] for n in active_joints}
    # joint_name -> list of angles (all sessions flattened)
    joint_angles_all: dict[str, list[float]] = {n: [] for n in active_joints}
    # joint_name -> session_id -> list of (frame_number, angle)
    joint_series: dict[str, dict[int, list[dict]]] = {
        n: {} for n in active_joints
    }
    # landmark_index -> running sum + count for mean position
    landmark_sums: dict[int, dict] = {
        i: {"x": 0.0, "y": 0.0, "z": 0.0, "n": 0} for i in LANDMARK_LABELS_JA
    }

    seen_sessions: set[int] = set()
    total_frames = 0
    frames_per_session: dict[int, int] = {}

    for session_id, frame_number, lm_json in session_frames:
        if not lm_json:
            continue
        try:
            landmarks = json.loads(lm_json)
        except (ValueError, TypeError):
            continue
        if not isinstance(landmarks, list) or len(landmarks) < 33:
            continue

        seen_sessions.add(session_id)
        total_frames += 1
        frames_per_session[session_id] = frames_per_session.get(session_id, 0) + 1

        for joint_name, (ai, bi, ci) in active_joint_defs.items():
            try:
                angle = _angle_at(landmarks[ai], landmarks[bi], landmarks[ci])
            except (KeyError, IndexError, TypeError):
                angle = None
            if angle is None:
                continue
            joint_angles_all[joint_name].append(angle)
            sess_series = joint_series[joint_name].setdefault(session_id, [])
            sess_series.append({"frame": frame_number, "angle": round(angle, 2)})

        for i in LANDMARK_LABELS_JA:
            try:
                pt = landmarks[i]
                landmark_sums[i]["x"] += pt["x"]
                landmark_sums[i]["y"] += pt["y"]
                landmark_sums[i]["z"] += pt["z"]
                landmark_sums[i]["n"] += 1
            except (KeyError, IndexError, TypeError):
                pass

    landmark_mean = []
    for i, label in LANDMARK_LABELS_JA.items():
        s = landmark_sums[i]
        if s["n"] == 0:
            continue
        landmark_mean.append(
            {
                "index": i,
                "label": label,
                "x": round(s["x"] / s["n"], 4),
                "y": round(s["y"] / s["n"], 4),
                "z": round(s["z"] / s["n"], 4),
            }
        )

    joints_out = {}
    for joint_name, angles in joint_angles_all.items():
        sess_map = joint_series[joint_name]
        joints_out[joint_name] = {
            "stats": _stats(angles),
            "series": [
                {"session_id": sid, "points": pts}
                for sid, pts in sess_map.items()
            ],
            "curve_new": _aggregate_curve(sess_map, new_set & seen_sessions),
            "curve_existing": _aggregate_curve(
                sess_map, existing_set & seen_sessions
            ),
        }

    return {
        "session_count": len(seen_sessions),
        "session_ids": sorted(seen_sessions),
        "frames_per_session": frames_per_session,
        "total_frames": total_frames,
        "joints": joints_out,
        "landmark_mean": landmark_mean,
    }
