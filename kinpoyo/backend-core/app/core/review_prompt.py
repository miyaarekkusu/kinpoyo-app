"""AIレビュー機能：ベースプロンプト（固定・共通）＋パーツ（DB管理）の組み立て。
notes/ai-review-design-memo.txtの「ベース＋パーツ差し替え方式」を実装する。
パーツは完成文ではなく雛形であり、実測値と組み合わせてDeepSeek APIにその場で
自然文を生成させる（固定メッセージ表示にしない）。
"""
from typing import TYPE_CHECKING

from app.core.review_judge import ReviewMeasurements

if TYPE_CHECKING:
    from app.models.exercise import AiReviewPromptPart


# 1セットごとのレビュー文の上限文字数（スマホ画面に収まるように）。DeepSeekへの
# プロンプトでも指示するが、AI出力は厳密に守るとは限らないため、router側で
# この定数を使って超過分を切り詰める安全策も入れる（app/routers/workouts.py）。
PER_SET_REVIEW_MAX_CHARS = 200


BASE_PROMPT_TEMPLATE = """あなたはAIパーソナルトレーナーです。ユーザーの{exercise_name}のフォームを、
以下の実測データと観点をもとに、コーチとして自然で励みになる口調の日本語でレビューしてください。
専門用語は避け、**必ず200文字以内**で簡潔にまとめてください（スマホ画面に1セットごとに
表示するため、短く要点だけに絞ること）。

【観点】
{parts_text}

【実測データ】
- 総レップ数: {total_rep_count}
- フォームが安定していたレップ数: {good_form_count}
- フォームに改善余地があったレップ数: {needs_improvement_count}
- 平均ボトム角度: {avg_bottom_deg}
- 平均トップ角度: {avg_top_deg}
- 平均テンポ: {avg_period_sec}秒/レップ
- 種目と異なる姿勢だった可能性がある候補: {posture_mismatch_count}件
- 種目と動きの形が大きく異なっていた可能性がある候補: {movement_mismatch_count}件
"""


def _fmt(value) -> str:
    return "不明" if value is None else str(value)


def build_prompt(
    exercise_name: str,
    measurements: ReviewMeasurements,
    parts: list["AiReviewPromptPart"],
) -> str:
    """partsのprompt_fragmentを箇条書きで結合し、実測値と一緒にベースへ埋め込む。"""
    if parts:
        parts_text = "\n".join(f"- {p.prompt_fragment}" for p in parts)
    else:
        parts_text = "- 全体的なフォームについて、前向きな一言コメントをしてください。"

    return BASE_PROMPT_TEMPLATE.format(
        exercise_name=exercise_name,
        parts_text=parts_text,
        total_rep_count=measurements.total_rep_count,
        good_form_count=measurements.good_form_count,
        needs_improvement_count=measurements.needs_improvement_count,
        avg_bottom_deg=_fmt(measurements.avg_bottom_deg),
        avg_top_deg=_fmt(measurements.avg_top_deg),
        avg_period_sec=_fmt(measurements.avg_period_sec),
        posture_mismatch_count=measurements.posture_mismatch_count,
        movement_mismatch_count=measurements.movement_mismatch_count,
    )
