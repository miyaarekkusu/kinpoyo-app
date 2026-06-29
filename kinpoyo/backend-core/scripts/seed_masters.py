"""
マスターデータ + 種目データ投入スクリプト
実行: python scripts/seed_masters.py
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
import os

from app.models import (
    Base,
    Gender, DifficultyLevel, MuscleGroup, MovementCategory,
    EquipmentType, MeasurementUnit, GoalType, ProgramCategory,
    UserProgramStatus, PostType, WorkoutSessionStatus,
    Exercise,
)

engine = create_engine(os.environ["DATABASE_URL"])


def upsert(session: Session, model, rows: list[dict]) -> None:
    for row in rows:
        obj = session.get(model, row["id"])
        if obj is None:
            session.add(model(**row))
        else:
            for k, v in row.items():
                setattr(obj, k, v)


def seed_masters(session: Session) -> None:
    upsert(session, Gender, [
        {"id": 1, "code": "male",   "name_ja": "男性",  "sort_order": 1},
        {"id": 2, "code": "female", "name_ja": "女性",  "sort_order": 2},
        {"id": 3, "code": "other",  "name_ja": "その他", "sort_order": 3},
    ])

    upsert(session, DifficultyLevel, [
        {"id": 1, "code": "beginner",     "name_ja": "初心者", "sort_order": 1},
        {"id": 2, "code": "intermediate", "name_ja": "中級者", "sort_order": 2},
        {"id": 3, "code": "advanced",     "name_ja": "上級者", "sort_order": 3},
    ])

    upsert(session, MuscleGroup, [
        {"id": 1, "code": "chest",     "name_ja": "胸",        "name_en": "Chest",     "body_region": "upper", "color_hex": "#FF6B6B", "sort_order": 1},
        {"id": 2, "code": "back",      "name_ja": "背中",      "name_en": "Back",      "body_region": "upper", "color_hex": "#4ECDC4", "sort_order": 2},
        {"id": 3, "code": "shoulders", "name_ja": "肩",        "name_en": "Shoulders", "body_region": "upper", "color_hex": "#45B7D1", "sort_order": 3},
        {"id": 4, "code": "arms",      "name_ja": "腕",        "name_en": "Arms",      "body_region": "upper", "color_hex": "#96CEB4", "sort_order": 4},
        {"id": 5, "code": "legs",      "name_ja": "脚",        "name_en": "Legs",      "body_region": "lower", "color_hex": "#FFEAA7", "sort_order": 5},
        {"id": 6, "code": "core",      "name_ja": "体幹",      "name_en": "Core",      "body_region": "core",  "color_hex": "#DDA0DD", "sort_order": 6},
        {"id": 7, "code": "glutes",    "name_ja": "お尻",      "name_en": "Glutes",    "body_region": "lower", "color_hex": "#F0A500", "sort_order": 7},
        {"id": 8, "code": "calves",    "name_ja": "ふくらはぎ", "name_en": "Calves",    "body_region": "lower", "color_hex": "#98D8C8", "sort_order": 8},
    ])

    upsert(session, MovementCategory, [
        {"id": 1, "code": "push", "name_ja": "プッシュ", "sort_order": 1},
        {"id": 2, "code": "pull", "name_ja": "プル",    "sort_order": 2},
        {"id": 3, "code": "legs", "name_ja": "レッグス", "sort_order": 3},
    ])

    upsert(session, EquipmentType, [
        {"id": 1, "code": "barbell",        "name_ja": "バーベル",   "sort_order": 1},
        {"id": 2, "code": "dumbbell",       "name_ja": "ダンベル",   "sort_order": 2},
        {"id": 3, "code": "machine",        "name_ja": "マシン",     "sort_order": 3},
        {"id": 4, "code": "bodyweight",     "name_ja": "自重",       "sort_order": 4},
        {"id": 5, "code": "cable",          "name_ja": "ケーブル",   "sort_order": 5},
        {"id": 6, "code": "kettlebell",     "name_ja": "ケトルベル", "sort_order": 6},
        {"id": 7, "code": "resistance_band","name_ja": "チューブ",   "sort_order": 7},
    ])

    upsert(session, MeasurementUnit, [
        {"id": 1, "code": "kg",  "symbol": "kg",  "unit_type": "weight",     "sort_order": 1},
        {"id": 2, "code": "lbs", "symbol": "lbs", "unit_type": "weight",     "sort_order": 2},
        {"id": 3, "code": "pct", "symbol": "%",   "unit_type": "percentage", "sort_order": 3},
        {"id": 4, "code": "cm",  "symbol": "cm",  "unit_type": "length",     "sort_order": 4},
        {"id": 5, "code": "ft",  "symbol": "ft",  "unit_type": "length",     "sort_order": 5},
    ])

    upsert(session, GoalType, [
        {"id": 1, "code": "weight",      "name_ja": "体重目標",    "default_unit_id": 1, "sort_order": 1},
        {"id": 2, "code": "body_fat",    "name_ja": "体脂肪率目標", "default_unit_id": 3, "sort_order": 2},
        {"id": 3, "code": "muscle_mass", "name_ja": "筋肉量目標",  "default_unit_id": 1, "sort_order": 3},
    ])

    upsert(session, ProgramCategory, [
        {"id": 1, "code": "strength",    "name_ja": "筋力強化",       "sort_order": 1},
        {"id": 2, "code": "hypertrophy", "name_ja": "筋肥大",         "sort_order": 2},
        {"id": 3, "code": "bodyweight",  "name_ja": "自重トレーニング", "sort_order": 3},
        {"id": 4, "code": "cardio",      "name_ja": "有酸素",         "sort_order": 4},
    ])

    upsert(session, UserProgramStatus, [
        {"id": 1, "code": "active",    "name_ja": "実施中",   "sort_order": 1},
        {"id": 2, "code": "paused",    "name_ja": "一時停止", "sort_order": 2},
        {"id": 3, "code": "completed", "name_ja": "完了",     "sort_order": 3},
        {"id": 4, "code": "dropped",   "name_ja": "中断",     "sort_order": 4},
    ])

    upsert(session, PostType, [
        {"id": 1, "code": "feed", "name_ja": "フィード", "sort_order": 1},
        {"id": 2, "code": "qa",   "name_ja": "Q&A",     "sort_order": 2},
    ])

    upsert(session, WorkoutSessionStatus, [
        {"id": 1, "code": "scheduled",   "name_ja": "予定済み",   "sort_order": 1},
        {"id": 2, "code": "in_progress", "name_ja": "実施中",     "sort_order": 2},
        {"id": 3, "code": "completed",   "name_ja": "完了",       "sort_order": 3},
        {"id": 4, "code": "cancelled",   "name_ja": "キャンセル", "sort_order": 4},
    ])

    print("✅ マスターデータ投入完了（11テーブル）")


def seed_exercises(session: Session) -> None:
    # (name, name_en, primary_muscle_id, movement_category_id, equipment_type_id, is_compound, mediapipe_enabled)
    # muscle_group:  chest=1, back=2, shoulders=3, arms=4, legs=5, core=6, glutes=7, calves=8
    # movement_cat:  push=1, pull=2, legs=3
    # equipment:     barbell=1, dumbbell=2, machine=3, bodyweight=4, cable=5
    exercises = [
        # ── PUSH ───────────────────────────────────────────────────
        ("ベンチプレス",           "Bench Press",           1, 1, 1, True,  True),
        ("インクラインベンチプレス", "Incline Bench Press",   1, 1, 1, True,  False),
        ("ダンベルフライ",         "Dumbbell Fly",          1, 1, 2, False, False),
        ("プッシュアップ",         "Push Up",               1, 1, 4, True,  True),
        ("ディップス",            "Dips",                  1, 1, 4, True,  False),
        ("ショルダープレス",       "Shoulder Press",        3, 1, 1, True,  True),
        ("ダンベルショルダープレス","Dumbbell Shoulder Press",3, 1, 2, True,  False),
        ("サイドレイズ",          "Lateral Raise",         3, 1, 2, False, False),
        # ── PULL ───────────────────────────────────────────────────
        ("デッドリフト",          "Deadlift",              2, 2, 1, True,  True),
        ("ベントオーバーロウ",     "Bent Over Row",         2, 2, 1, True,  False),
        ("ラットプルダウン",       "Lat Pulldown",          2, 2, 3, True,  False),
        ("シーテッドケーブルロウ", "Seated Cable Row",      2, 2, 5, True,  False),
        ("チンアップ",            "Chin Up",               2, 2, 4, True,  True),
        ("プルアップ",            "Pull Up",               2, 2, 4, True,  True),
        ("バーベルカール",         "Barbell Curl",          4, 2, 1, False, False),
        ("ダンベルカール",         "Dumbbell Curl",         4, 2, 2, False, False),
        # ── LEGS ───────────────────────────────────────────────────
        ("スクワット",            "Squat",                 5, 3, 1, True,  True),
        ("フロントスクワット",     "Front Squat",           5, 3, 1, True,  False),
        ("レッグプレス",          "Leg Press",             5, 3, 3, True,  False),
        ("ルーマニアンデッドリフト","Romanian Deadlift",    7, 3, 1, True,  False),
        ("レッグカール",          "Leg Curl",              5, 3, 3, False, False),
        ("レッグエクステンション", "Leg Extension",         5, 3, 3, False, False),
        ("ランジ",               "Lunge",                 5, 3, 4, True,  True),
        ("カーフレイズ",          "Calf Raise",            8, 3, 3, False, False),
    ]

    existing = {e.name for e in session.query(Exercise).all()}

    for name, name_en, prim, mov, equip, compound, mp in exercises:
        if name not in existing:
            session.add(Exercise(
                name=name,
                name_en=name_en,
                primary_muscle_id=prim,
                movement_category_id=mov,
                equipment_type_id=equip,
                is_compound=compound,
                mediapipe_enabled=mp,
            ))

    print(f"✅ 種目データ投入完了（{len(exercises)}件）")


def main() -> None:
    print("🚀 シードデータ投入開始...")
    with Session(engine) as session:
        seed_masters(session)
        seed_exercises(session)
        session.commit()
    print("🎉 全シードデータ投入完了")


if __name__ == "__main__":
    main()
