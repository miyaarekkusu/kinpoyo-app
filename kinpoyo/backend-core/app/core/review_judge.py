"""AIレビュー機能：計測データから観点ごとの判定コードを決定的ロジックで導出する。
判定基準はmodel-studio較正済みモデルのcycleStats（深さ）と、固定の一般的な秒数
しきい値（テンポ）を使う。AIには「この観点についてコーチ風の文章にする」ことだけ
をやらせ、良し悪しの判定自体はここで完結させる（notes/ai-review-design-memo.txt
の基本方針）。
"""
from dataclasses import dataclass
from typing import Optional


# テンポ判定：固定しきい値（model-studio側にテンポの較正データが無いため、
# 一般的なフィットネスの目安を採用。実測値ではなく将来チューニング可能な定数）
TEMPO_FAST_THRESHOLD_SEC = 1.5


@dataclass
class ReviewMeasurements:
    """レビュー生成用に集計した実測値（プロンプトにそのまま埋め込む）。
    「棄却」という概念はここでは扱わない（カウントとフォーム評価を分離する
    方針のため。AIレビューに"棄却"の話を持ち込まない）。

    2026-08-28追加：posture_mismatch_count/movement_mismatch_countのみ例外——
    これらは「カウントしたレップの品質」ではなく「そもそも種目と違う動き・
    姿勢が混ざっていた候補の数」なので、良し悪しの評価とは別の情報として
    ユーザーに伝える価値がある（app/core/rep_model.pyの妥当性ゲート・
    姿勢ゲート参照）。"""
    total_rep_count: int
    good_form_count: int
    needs_improvement_count: int
    avg_bottom_deg: Optional[float]
    avg_top_deg: Optional[float]
    avg_period_sec: Optional[float]
    posture_mismatch_count: int = 0
    movement_mismatch_count: int = 0


def aggregate_cycles(rep_cycles_json_list: list[list[dict]]) -> ReviewMeasurements:
    """複数セット分のrep_cycles_json（各セットのサイクル配列）を集計する。
    counted=Trueのサイクル（good_form・needs_improvement問わず）全てを実測値
    （深さ・テンポの平均）の計算に使う——「実際にやったレップの平均」を見るのが
    目的で、フォーム品質による絞り込みはしない。counted=False（測定不能）の
    サイクルは実測値に含めない。
    """
    total_count = 0
    good_count = 0
    improvement_count = 0
    posture_mismatch_count = 0
    movement_mismatch_count = 0
    bottom_values: list[float] = []
    top_values: list[float] = []
    period_values: list[float] = []

    for cycles in rep_cycles_json_list:
        if not cycles:
            continue
        for cycle in cycles:
            if not cycle.get("counted"):
                # counted=Falseでも、妥当性/姿勢ゲートによる棄却
                # （invalid_reason="movement"/"posture"）だけは別途カウント
                # する。「そもそも種目と違う動き・姿勢だった可能性」を
                # ユーザーに伝えるための情報であり、レップの品質評価
                # （good/needs_improvement）とは別軸のため実測値には混ぜない。
                # 測定不能（invalid_reasonが無い）はここでは扱わない——動画・
                # トラッキングの技術的な問題であり、フォームの話ではないため。
                reason = cycle.get("invalid_reason")
                if reason == "posture":
                    posture_mismatch_count += 1
                elif reason == "movement":
                    movement_mismatch_count += 1
                continue
            total_count += 1
            if cycle.get("form_quality") == "good":
                good_count += 1
            else:
                improvement_count += 1
            bottom_deg = cycle.get("bottom_deg")
            if bottom_deg is not None:
                bottom_values.append(bottom_deg)
            top_deg = cycle.get("top_deg")
            if top_deg is not None:
                top_values.append(top_deg)
            period_sec = cycle.get("period_sec")
            if period_sec is not None:
                period_values.append(period_sec)

    return ReviewMeasurements(
        total_rep_count=total_count,
        good_form_count=good_count,
        needs_improvement_count=improvement_count,
        avg_bottom_deg=(
            round(sum(bottom_values) / len(bottom_values), 1) if bottom_values else None
        ),
        avg_top_deg=(
            round(sum(top_values) / len(top_values), 1) if top_values else None
        ),
        avg_period_sec=(
            round(sum(period_values) / len(period_values), 2) if period_values else None
        ),
        posture_mismatch_count=posture_mismatch_count,
        movement_mismatch_count=movement_mismatch_count,
    )


def judge_aspects(
    measurements: ReviewMeasurements,
    cycle_stats: Optional[dict],  # rep_count_models.config_json["cycleStats"]
) -> list[str]:
    """観点ごとの判定コードサフィックス（例: "depth_shallow", "depth_good",
    "tempo_fast", "tempo_good"）のリストを返す。

    深さ：cycle_statsが無ければ判定不能（スキップ）。avg_bottom_degが
    cycle_stats["bottomDeg"][1]（較正済み帯域の上限＝浅い側の境界）を
    超えていたら "depth_shallow"、それ以外は "depth_good"。
    テンポ：avg_period_secがTEMPO_FAST_THRESHOLD_SEC未満なら "tempo_fast"、
    それ以外は "tempo_good"。
    """
    aspects: list[str] = []

    if cycle_stats is not None and measurements.avg_bottom_deg is not None:
        bottom_range = cycle_stats.get("bottomDeg")
        if bottom_range and len(bottom_range) >= 2:
            shallow_boundary = bottom_range[1]
            if measurements.avg_bottom_deg > shallow_boundary:
                aspects.append("depth_shallow")
            else:
                aspects.append("depth_good")

    if measurements.avg_period_sec is not None:
        if measurements.avg_period_sec < TEMPO_FAST_THRESHOLD_SEC:
            aspects.append("tempo_fast")
        else:
            aspects.append("tempo_good")

    # 2026-08-28追加：姿勢ゲートで棄却された候補が1つでもあれば、種目と違う
    # 姿勢・動きが混ざっていた可能性をユーザーに伝える。深さ・テンポと違い
    # 「良い/悪い」の対にはならない（無ければ何も言わないだけでよい）。
    if measurements.posture_mismatch_count > 0:
        aspects.append("posture_mismatch")

    # 2026-08-28追加：妥当性ゲート（角度帯・ROM・形状）で棄却された候補が
    # あれば、動きの形が種目と大きく異なっていた可能性をユーザーに伝える。
    if measurements.movement_mismatch_count > 0:
        aspects.append("movement_mismatch")

    return aspects
