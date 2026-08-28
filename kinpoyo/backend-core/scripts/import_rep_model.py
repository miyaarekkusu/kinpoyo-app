"""model-studio（Azure App Service上のAPI、読み取り専用アクセス）から較正済みの
RepModelを取得し、本アプリの rep_count_models テーブルへ取り込む。

model-studio自体は変更禁止のため、公開APIをGETするだけで、model-studioのコード・
DBには一切書き込まない。

使い方:
    cd backend-core && venv\\Scripts\\activate
    python scripts/import_rep_model.py <model-studioのタグ名> <本アプリの種目名>

例:
    python scripts/import_rep_model.py スクワット スクワット
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models.exercise import Exercise, RepCountModel

# deploy.ps1 の $AppName='kinpoyo-api' から導かれるApp ServiceのURL。
MODEL_STUDIO_API_BASE = "https://kinpoyo-api.azurewebsites.net"


def _get_json(path: str):
    with urllib.request.urlopen(f"{MODEL_STUDIO_API_BASE}{path}", timeout=30) as resp:
        return json.loads(resp.read())


def fetch_model_by_tag_name(tag_name: str) -> dict:
    tags = _get_json("/tags")
    tag = next((t for t in tags if t["name"] == tag_name), None)
    if tag is None:
        raise SystemExit(f"model-studioにタグ '{tag_name}' が見つかりません")

    models = _get_json("/models")
    model_summary = next((m for m in models if m["tag_id"] == tag["id"]), None)
    if model_summary is None:
        raise SystemExit(f"タグ '{tag_name}' に較正済みモデルがありません（build-model未実行）")

    return _get_json(f"/models/{model_summary['id']}")


def main() -> None:
    if len(sys.argv) != 3:
        print("使い方: python scripts/import_rep_model.py <model-studioのタグ名> <本アプリの種目名>")
        raise SystemExit(1)
    tag_name, exercise_name = sys.argv[1], sys.argv[2]

    model = fetch_model_by_tag_name(tag_name)
    print(
        f"取得: model_id={model['id']} name={model['name']} "
        f"mae={model['mae']} exact_match_rate={model['exact_match_rate']}"
    )

    db = SessionLocal()
    try:
        exercise = db.query(Exercise).filter(Exercise.name == exercise_name).first()
        if exercise is None:
            raise SystemExit(f"本アプリに種目 '{exercise_name}' が見つかりません")

        existing = (
            db.query(RepCountModel)
            .filter(RepCountModel.exercise_id == exercise.id)
            .first()
        )
        if existing is None:
            existing = RepCountModel(exercise_id=exercise.id)
            db.add(existing)

        existing.config_json = model["config"]
        existing.source = "model-studio"
        existing.mae = model["mae"]
        existing.exact_match_rate = model["exact_match_rate"]
        existing.session_count = model["session_count"]
        db.commit()
        print(f"rep_count_models に登録しました（exercise_id={exercise.id}: {exercise.name}）")
    finally:
        db.close()


if __name__ == "__main__":
    main()
