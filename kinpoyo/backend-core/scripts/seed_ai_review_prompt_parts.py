"""
AIレビュー用の差し替えパーツ 投入スクリプト
実行: python scripts/seed_ai_review_prompt_parts.py

notes/ai-review-design-memo.txtの「ベース＋パーツ差し替え方式」で使う
ai_review_prompt_partsテーブルへの初期データ投入。prompt_fragmentは完成文では
なく「〜について、コーチ視点で一言コメントしてください」のような指示文にする
（同メモの注意点1参照。完成文をそのまま返すだけならAIを使う意味がなくなる）。

スクワット（exercise_id=17。DBで`SELECT id, name FROM exercises WHERE id = 17`により
「スクワット」であることを確認済み）向けに最低限4件投入する。
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models import AiReviewPromptPart

engine = create_engine(os.environ["DATABASE_URL"])

SQUAT_EXERCISE_ID = 17


def upsert(session: Session, rows: list[dict]) -> None:
    for row in rows:
        obj = session.query(AiReviewPromptPart).filter_by(code=row["code"]).first()
        if obj is None:
            session.add(AiReviewPromptPart(**row))
        else:
            for k, v in row.items():
                setattr(obj, k, v)


def seed_ai_review_prompt_parts(session: Session) -> None:
    upsert(session, [
        {
            "code": "squat_depth_shallow",
            "exercise_id": SQUAT_EXERCISE_ID,
            "label_ja": "深さ：浅い傾向",
            "prompt_fragment": (
                "しゃがみの深さが目標よりやや浅い傾向があることについて、"
                "コーチ視点で改善のアドバイスを一言コメントしてください。"
            ),
            "is_active": True,
        },
        {
            "code": "squat_depth_good",
            "exercise_id": SQUAT_EXERCISE_ID,
            "label_ja": "深さ：十分",
            "prompt_fragment": (
                "しゃがみの深さが十分に取れていることについて、"
                "コーチ視点で前向きな一言コメントをしてください。"
            ),
            "is_active": True,
        },
        {
            "code": "squat_tempo_fast",
            "exercise_id": SQUAT_EXERCISE_ID,
            "label_ja": "テンポ：速すぎる傾向",
            "prompt_fragment": (
                "動作のテンポが速すぎる傾向があることについて、"
                "コーチ視点でコントロールを意識するようアドバイスを一言コメントしてください。"
            ),
            "is_active": True,
        },
        {
            "code": "squat_tempo_good",
            "exercise_id": SQUAT_EXERCISE_ID,
            "label_ja": "テンポ：適切",
            "prompt_fragment": (
                "動作のテンポが適切にコントロールできていることについて、"
                "コーチ視点で前向きな一言コメントをしてください。"
            ),
            "is_active": True,
        },
        {
            # 種目共通（exercise_id=None）。姿勢ゲート（app/core/rep_model.py）で
            # 「体幹の向きが種目の想定と大きく食い違う」として棄却された候補が
            # あった場合に使う。2026-08-28追加。
            "code": "general_posture_mismatch",
            "exercise_id": None,
            "label_ja": "姿勢：別の動き・種目の可能性",
            "prompt_fragment": (
                "動画の一部に、この種目とは異なる姿勢（例：立ったままの動作等）が"
                "混ざっていた可能性があることについて、責めるのではなく「正しい"
                "姿勢で行えているか確認してみましょう」という優しい確認のコメントを"
                "一言してください。"
            ),
            "is_active": True,
        },
        {
            # 種目共通（exercise_id=None）。妥当性ゲート（app/core/rep_model.py）
            # で「動きの形が種目の想定と大きく食い違う」として棄却された候補が
            # あった場合に使う。2026-08-28追加（姿勢版と対になるもの）。
            "code": "general_movement_mismatch",
            "exercise_id": None,
            "label_ja": "動き：別の動き・種目の可能性",
            "prompt_fragment": (
                "動画の一部に、この種目の動きとは形が大きく異なる候補が"
                "混ざっていた可能性があることについて、責めるのではなく「正しい"
                "動きで行えているか確認してみましょう」という優しい確認のコメントを"
                "一言してください。"
            ),
            "is_active": True,
        },
    ])


def seed_session_report_prompt_parts(session: Session) -> None:
    """筋トレレポート機能（session_プレフィックス、exercise_id=NULL＝種目共通）用。
    2026-08-24、筋トレフロー刷新で追加。"""
    upsert(session, [
        {
            "code": "session_achievement_good",
            "exercise_id": None,
            "label_ja": "セット達成率：良好",
            "prompt_fragment": (
                "計画していたセット数をしっかり達成できたことについて、"
                "コーチ視点で称賛する一言コメントをしてください。"
            ),
            "is_active": True,
        },
        {
            "code": "session_achievement_low",
            "exercise_id": None,
            "label_ja": "セット達成率：低め",
            "prompt_fragment": (
                "計画していたセット数に届かなかった種目があることについて、"
                "コーチ視点で前向きに次回への改善を促す一言コメントをしてください。"
            ),
            "is_active": True,
        },
        {
            "code": "session_improved",
            "exercise_id": None,
            "label_ja": "前回比：向上",
            "prompt_fragment": (
                "前回の同じ筋トレと比べて重量が向上している種目があることについて、"
                "コーチ視点で称賛する一言コメントをしてください。"
            ),
            "is_active": True,
        },
        {
            "code": "session_declined",
            "exercise_id": None,
            "label_ja": "前回比：低下",
            "prompt_fragment": (
                "前回の同じ筋トレと比べて重量が下がっている種目があることについて、"
                "コーチ視点で気負わせずに励ます一言コメントをしてください。"
            ),
            "is_active": True,
        },
        {
            "code": "session_rpe_harder_than_expected",
            "exercise_id": None,
            "label_ja": "RPE：予測より高い（きつく感じた）",
            "prompt_fragment": (
                "自己ベスト重量から予測されるRPEよりも実測RPEが明確に高い種目が"
                "あることについて、特に重量が前回より下がっている場合は疲労・睡眠・"
                "栄養などの回復面の対策を、コーチ視点で一言アドバイスしてください。"
            ),
            "is_active": True,
        },
        {
            "code": "session_plateau_add_weight",
            "exercise_id": None,
            "label_ja": "停滞：加重を提案",
            "prompt_fragment": (
                "直近数回のトレーニングで最後のセットのレップ数・重量がほぼ一定で"
                "停滞気味の種目があることについて、レップ数に余裕が出てきているなら"
                "次回は重量を上げてみることを、コーチ視点で一言提案してください。"
            ),
            "is_active": True,
        },
    ])


def main() -> None:
    with Session(engine) as session:
        seed_ai_review_prompt_parts(session)
        seed_session_report_prompt_parts(session)
        session.commit()
    print("ai_review_prompt_parts への投入が完了しました。")


if __name__ == "__main__":
    main()
