# model-studio

きんぽよアプリの**回数カウント用モデルを作るためのアプリ群**。製品アプリ本体（`kinpoyo/`）とは別系統で、
学習データの収集からモデルの学習・精度チェックまでを担う。ここで作ったモデルを製品側が利用する。

## 構成

| ディレクトリ | 役割 |
|---|---|
| `frontend/` | 撮影アプリ（Expo / スマホ）。カメラで動画を撮り、区間をトリムして学習データ（セッション）としてアップロードする。 |
| `analyzer/` | 分析アプリ（Expo / PC ブラウザでも動作）。セッションの関節角度を分析し、正解回数を登録し、モデルを学習させ、`/check` 画面で任意の動画に対する回数カウントの精度を検証する。 |
| `backend/` | FastAPI。姿勢推定（MediaPipe）、分析、モデルの学習・保存、回数カウントを提供する。Azure App Service にデプロイ（`backend/deploy.ps1`）。 |

## モデル作成の流れ

1. `frontend/` で動画を撮影し、学習データとしてアップロードする。
2. `analyzer/` でセッションを分析し、**正解回数**（実際に何回やったか）を登録する。
3. タグ単位でモデルを学習させる（`POST /tags/{id}/build-model`）。学習の実体はニューラルネットではなく、
   正解回数を最も再現できる状態機械の閾値・主役関節・1レップの標準カーブ・受理ゲートの較正。
4. `analyzer/` の `/check` 画面で別の動画を流し、回数が合うか検証する。合わなければ 1〜3 を繰り返す。

## 開発

- `backend/`: `pip install -r backend/requirements.txt` → `uvicorn main:app --reload`
- `frontend/` / `analyzer/`: `npm install` → `npx expo start`（analyzer は `--web` で PC ブラウザ）
- バックエンドのデプロイ先は `analyzer/constants/api.ts` の `API_URL` を参照。
