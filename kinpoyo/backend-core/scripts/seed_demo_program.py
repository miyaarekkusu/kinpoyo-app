"""
デモ用プログラムデータ投入スクリプト（BIG3強化プログラム 1週目分）
実行: python scripts/seed_demo_program.py

ホーム画面の「参加中プログラムの次のメニュー提案」機能を試すための最小限のデータ。
本番のプログラム管理機能ではなく、動作確認用のシードであることに注意。
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

import os
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.models import Program, ProgramExercise

engine = create_engine(os.environ["DATABASE_URL"])

PROGRAM_NAME = "BIG3強化プログラム"

# week1 の3トレーニング日分（実在の exercises.id を使用）
DAY_EXERCISES = {
    1: [(1, 3, 6, 10), (2, 3, 8, 10)],   # day1: ベンチプレス, インクラインベンチプレス
    2: [(17, 3, 6, 10), (18, 3, 8, 10)],  # day2: スクワット, フロントスクワット
    3: [(9, 3, 5, 8), (20, 3, 8, 10)],    # day3: デッドリフト, ルーマニアンデッドリフト
}


def seed_demo_program(session: Session) -> None:
    program = session.scalars(select(Program).where(Program.name == PROGRAM_NAME)).first()
    if program is None:
        program = Program(
            name=PROGRAM_NAME,
            description="スクワット・ベンチプレス・デッドリフトでパワーを最大化する8週間プログラム",
            category_id=1,  # 筋力強化
            difficulty_level_id=2,  # 中級者
            duration_weeks=8,
            frequency_per_week=3,
            is_public=True,
        )
        session.add(program)
        session.commit()
        session.refresh(program)

    existing = session.scalars(
        select(ProgramExercise).where(ProgramExercise.program_id == program.id)
    ).first()
    if existing is not None:
        print(f"{PROGRAM_NAME} には既に program_exercises が存在するためスキップします")
        return

    for day_number, exercises in DAY_EXERCISES.items():
        for order_index, (exercise_id, sets, reps_min, reps_max) in enumerate(exercises):
            session.add(
                ProgramExercise(
                    program_id=program.id,
                    exercise_id=exercise_id,
                    week_number=1,
                    day_number=day_number,
                    order_index=order_index,
                    sets=sets,
                    reps_min=reps_min,
                    reps_max=reps_max,
                    rest_interval_sec=120,
                )
            )
    session.commit()
    print(f"{PROGRAM_NAME}（program_id={program.id}）に week1 分の program_exercises を投入しました")


if __name__ == "__main__":
    with Session(engine) as session:
        seed_demo_program(session)
