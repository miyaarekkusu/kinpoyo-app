"""指定日の筋トレを「予定済み」に戻して、もう一度実行できる状態にする（テスト用）。

リアルタイム回数カウントの検証では同じメニューを何度も回したくなるが、アプリは
1日1メニュー制で、完了すると開始ボタンが出なくなる。毎回SQLを手で打つのは面倒な
ので、その戻し作業をまとめたもの。

やること:
  - 完了/実施中のセッションを「予定済み」に戻す
  - started_at / ended_at / duration_sec を消す
  - 計測結果（ai_counted_reps / rep_cycles_json / completed_at）を消す
  - そのセッションに紐づくAIレビュー・レポートも消す（古い講評が残らないように）

使い方::

    python scripts/reset_workout_for_retest.py <メールアドレス> [YYYY-MM-DD]

    # 例（日付を省略すると今日）
    python scripts/reset_workout_for_retest.py nishidakohtata@icloud.com
    python scripts/reset_workout_for_retest.py nishidakohtata@icloud.com 2026-08-29

取り消し済み（cancelled）のセッションには触らない。捨てたものを掘り返さないため。
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.crud.workout import STATUS_COMPLETED, STATUS_IN_PROGRESS, STATUS_SCHEDULED  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.user import User  # noqa: E402
from app.models.workout import AiReview, WorkoutSession, WorkoutSessionReport  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    email = sys.argv[1]
    target = date.fromisoformat(sys.argv[2]) if len(sys.argv) > 2 else date.today()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            print(f"ユーザーが見つかりません: {email}")
            return 1

        sessions = (
            db.query(WorkoutSession)
            .filter(
                WorkoutSession.user_id == user.id,
                WorkoutSession.scheduled_date == target,
                WorkoutSession.status_id.in_([STATUS_IN_PROGRESS, STATUS_COMPLETED]),
            )
            .all()
        )
        if not sessions:
            print(f"{target} に戻せるセッションはありません（完了・実施中のもののみ対象）")
            return 0

        for s in sessions:
            cleared = 0
            for se in s.session_exercises:
                # このセットに紐づくAIレビューも消す。回数が変わるのに古い講評が
                # 残っていると、次のレビュー生成前に前回の文章が見えてしまう。
                db.query(AiReview).filter(AiReview.session_exercise_id == se.id).delete()
                for st in se.sets:
                    if st.ai_counted_reps is not None:
                        cleared += 1
                    st.ai_counted_reps = None
                    st.rep_cycles_json = None
                    st.completed_at = None
            # セッション全体のレポート（AIレビュー）も消す。次回生成するまで
            # 前回の講評が残っていると、記録と食い違ったものを見せてしまう。
            db.query(WorkoutSessionReport).filter(
                WorkoutSessionReport.workout_session_id == s.id
            ).delete()
            s.status_id = STATUS_SCHEDULED
            s.started_at = None
            s.ended_at = None
            s.duration_sec = None
            print(f"  セッション {s.id}: 予定済みに戻しました（計測結果 {cleared} セットを消去）")

        db.commit()
        print(f"{target} の筋トレを再実行できる状態にしました。")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
