"""筋トレレポート機能：ベースプロンプト（固定）＋パーツ（DB管理）の組み立て。
review_prompt.pyと同じ「ベース＋パーツ差し替え方式」（notes/ai-review-design-memo.txt）。

2026-08-24：総ボリューム比較から、種目ごとの重量・レップ数・RPEの前回比較へ変更
（session_report_judge.py参照）。
2026-08-25：予測RPE（生涯ベストe1RMからの%1RM換算）・停滞判定・参加中プログラムの
文脈を追加（AGENTS.md『AIレビュープロンプトの強化』参照）。
2026-08-26：参加中プログラムがある場合、feedback_text内に
PROGRAM_SECTION_HEADING（"【プログラムについて】"）から始まる段落を必ず含めるよう
指示を追加（ユーザーフィードバック：「プログラムという項目をレビューに入れて」）。
DBスキーマは変えず、フロント側（workout-report-result.tsx）がこの見出しで
feedback_textを分割し、専用カードとして表示する（見出し文字列はここと
フロントの両方でハードコードされているため、変更する場合は両方直すこと）。
"""
from typing import TYPE_CHECKING, Optional

from app.core.session_report_judge import ExerciseComparison, SessionReportMeasurements

if TYPE_CHECKING:
    from app.models.exercise import AiReviewPromptPart


PROGRAM_SECTION_HEADING = "【プログラムについて】"


BASE_PROMPT_TEMPLATE = """あなたはAIパーソナルトレーナーです。ユーザーが今回行った筋トレ全体を、
以下の実績データと観点をもとに、コーチとして自然で励みになる口調の日本語でレビューしてください。
専門用語は避け、3〜5文程度の簡潔な文章にまとめてください。

【観点】
{parts_text}
{program_section}
【実績データ】
- 種目別セット達成状況・前回との比較・RPE予測:
{exercises_text}
- 全体達成率: {overall_achievement_pct}

【重量・RPEの扱いについての注意】
- 各種目の「予測RPE」は、その人の生涯ベスト推定1RMに対して今回の重量が何%かから
  算出した目安です。実測RPEが予測RPEより明確に高い種目は、見た目の重量以上に
  きつく感じていた可能性があります。特に重量が前回より下がっている種目でそれが
  起きている場合は、疲労・睡眠・栄養などの対策を一言添えてください
- 「停滞」と判定された種目は、直近数回のトレーニングで最後のセットのレップ数・
  重量がほぼ変わっていません。重い種目ほど重量更新には時間がかかるのは自然な
  ことですが、レップ数に余裕が出てきているようなら加重を提案してください
- 重量そのものの変化率だけでなく、上記のRPE・停滞の観点もバランス良く評価に
  含めてください（重量が伸びていなくてもRPEが安定していれば前向きに評価できます）
{output_format_instruction}"""


def _fmt(value) -> str:
    return "不明" if value is None else str(value)


def _fmt_pct(value) -> str:
    return "不明" if value is None else f"{value}%"


def _fmt_exercise(ex: ExerciseComparison) -> str:
    line = (
        f"  - {ex.exercise_name}: 目標{_fmt(ex.target_sets)}セット中"
        f"{ex.actual_sets}セット実施（達成率{_fmt_pct(ex.achievement_pct)}）"
    )
    if ex.prev_avg_weight_kg is not None:
        line += (
            f"\n    重量 平均{_fmt(ex.avg_weight_kg)}kg（前回{_fmt(ex.prev_avg_weight_kg)}kg・"
            f"{_fmt_pct(ex.weight_change_pct)}） / レップ数 平均{_fmt(ex.avg_reps)}"
            f"（前回{_fmt(ex.prev_avg_reps)}） / RPE 平均{_fmt(ex.avg_rpe)}（前回{_fmt(ex.prev_avg_rpe)}）"
        )
    else:
        line += (
            f"\n    重量 平均{_fmt(ex.avg_weight_kg)}kg / レップ数 平均{_fmt(ex.avg_reps)} / "
            f"RPE 平均{_fmt(ex.avg_rpe)}（前回データなし）"
        )
    if ex.predicted_rpe is not None:
        deviation_note = ""
        if ex.rpe_deviation is not None:
            if ex.rpe_deviation >= 1.0:
                deviation_note = "（実測が予測よりかなり高い＝思ったよりきつかった可能性）"
            elif ex.rpe_deviation <= -1.0:
                deviation_note = "（実測が予測よりかなり低い＝余裕があった可能性）"
        line += f"\n    予測RPE {ex.predicted_rpe}（自己ベスト重量からの換算）{deviation_note}"
    if ex.is_plateaued:
        line += "\n    ※直近数回、最後のセットのレップ数・重量がほぼ一定（停滞気味）"
    return line


def build_program_context(
    program_name: str,
    category_name: Optional[str],
    difficulty_name: Optional[str],
    current_week: int,
    current_day: int,
    today_exercise_names: list[str],
) -> str:
    """参加中プログラムの文脈をテキスト化する。judge_session_aspectsのような
    決定的な判定はしない——「Big3なら補助種目を勧める」のような助言はプログラムの
    特性に応じて内容が大きく変わるため、Pythonでルール化せずAIの一般知識に
    委ねる（ユーザー確認済み・2026-08-25）。"""
    lines = [f"プログラム名: {program_name}"]
    if category_name:
        lines.append(f"カテゴリ: {category_name}")
    if difficulty_name:
        lines.append(f"難易度: {difficulty_name}")
    lines.append(f"進捗: {current_week}週目 {current_day}日目")
    if today_exercise_names:
        lines.append(f"このプログラムの本日の種目構成: {', '.join(today_exercise_names)}")
    lines.append(
        "このプログラムの特性（種目構成・カテゴリ・難易度・進捗）を踏まえて、"
        "推奨・対策・一言コメントを考えてください（例: ビッグ3中心のプログラムなら"
        "補助種目の提案など）。"
    )
    return "\n".join(lines)


def build_prompt(
    measurements: SessionReportMeasurements,
    parts: list["AiReviewPromptPart"],
    program_context: Optional[str] = None,
) -> str:
    if parts:
        parts_text = "\n".join(f"- {p.prompt_fragment}" for p in parts)
    else:
        parts_text = "- 今回の筋トレ全体について、前向きな一言コメントをしてください。"

    if measurements.exercises:
        exercises_text = "\n".join(_fmt_exercise(ex) for ex in measurements.exercises)
    else:
        exercises_text = "  - データなし"

    if program_context:
        program_section = f"\n【参加中のプログラム】\n{program_context}\n"
        output_format_instruction = (
            "\n【出力形式】\n"
            "まず筋トレ全体のレビューを3〜5文で書いてください。そのあと1行空けて、"
            f'見出し「{PROGRAM_SECTION_HEADING}」からちょうど始まる段落を追加し、'
            "参加中のプログラムに関する推奨・対策・一言コメントを2〜4文でまとめて"
            "ください（この見出しは画面表示のためにアプリ側で検出するので、"
            "文言を変えたり省略したりしないでください）。\n"
        )
    else:
        program_section = ""
        output_format_instruction = ""

    return BASE_PROMPT_TEMPLATE.format(
        parts_text=parts_text,
        program_section=program_section,
        exercises_text=exercises_text,
        overall_achievement_pct=_fmt_pct(measurements.overall_achievement_pct),
        output_format_instruction=output_format_instruction,
    )
