from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ExerciseOut(BaseModel):
    id: int
    name: str
    movement: str
    muscle: str
    muscle_color: Optional[str] = None


class RepCountModelOut(BaseModel):
    """種目ごとの回数カウント設定（AI回数カウント機能用）。
    config は model-studio で較正されたフル設定（閾値・mainJoint・1レップ形状
    テンプレート・統計ゲート）。判定は全てbackend側（app/core/rep_model.py）で
    行うため、フロントはこの中身を直接使わない（未登録判定=nullチェックのみ）。
    """
    exercise_id: int
    config: dict
    mae: Optional[float] = None
    exact_match_rate: Optional[float] = None
    session_count: Optional[int] = None


class RepCycleOut(BaseModel):
    """候補サイクル1つぶんの検証内訳。

    2026-08-24変更：「カウント（何回やったか）」と「評価（フォームの質）」を
    分離した。測定可能なサイクルは全てcounted=Trueでカウントし、
    form_qualityで品質をラベル付けするのみ（カウントの可否には影響しない）。
    counted=Falseになるのは、点数が少なすぎて形状ベクトルすら計算できない
    （そもそも1レップとして測定不能）場合のみ。
    """
    start: int
    end: int
    counted: bool
    form_quality: Optional[str] = None  # "good" | "needs_improvement"（counted=Falseならnull）
    distance: Optional[float] = None
    bottom_deg: Optional[float] = None
    top_deg: Optional[float] = None
    period: Optional[int] = None


class CountRepsResult(BaseModel):
    """録画済み動画からの回数カウント結果。countは測定可能だった全サイクル数
    （good_form_count + needs_improvement_count）。"""
    exercise_id: int
    joint: Optional[str] = None
    count: int
    rom: float
    good_form_count: int
    needs_improvement_count: int
    segments: int
    total_frames: int
    pose_frames: int
    fps: float
    cycles: list[RepCycleOut]


class RepCycleJson(BaseModel):
    """session_sets.rep_cycles_json に保存する1サイクル分のデータ。
    RepCycleOut（count-reps APIのレスポンス、periodはフレーム数）と異なり、
    period_sec（秒）に変換済みの値を保存する（フレーム数のままだとfpsが
    分からないと意味を持たないため、保存時点で秒に変換しておく）。"""
    start: int
    end: int
    counted: bool
    form_quality: Optional[str] = None
    distance: Optional[float] = None
    bottom_deg: Optional[float] = None
    top_deg: Optional[float] = None
    period_sec: Optional[float] = None


class AiReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_exercise_id: int
    model_version: str
    feedback_text: str
    matched_part_codes_json: Optional[list[str]] = None
    generated_at: datetime
