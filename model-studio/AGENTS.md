# AGENTS.md — model-studio（AIエージェント向け）

> **このプロジェクトは完成済みです。**
> **AIエージェントは、ユーザーから明示的な指示がない限り、このフォルダー配下のファイルを
> 一切変更・リファクタリング・整形しないでください。**
> 今後の実装作業は基本的にすべて本アプリ（`../kinpoyo/`）側で行います。
> ここは「学習済みモデル（`RepModel.config_json`）の生成元」として参照するだけの
> 位置づけです。読み取り・参照のみ行い、書き込みは禁止です。

---

## これは何か

**model-studio** は、kinpoyo本アプリの「AI回数カウント」機能で使う**検出モデルを作るための
社内ツール群**（研究・学習用スタジオ）。本アプリのユーザー向け画面ではない。

MediaPipeでトレーニング動画からポーズランドマークを抽出し、正解回数（true_reps）をラベル付けし、
種目（タグ）ごとに「回数カウント用の閾値・1レップ形状テンプレート」を較正（=学習）して、
JSON設定として保存する。ここで生成される `RepModel.config_json` が、本アプリ側で使う
「学習された検出モデル」の実体。

**ニューラルネットではない**：学習の中身はステートマシンの閾値グリッドサーチ＋1レップ波形
テンプレートの統計的較正（`backend/rep_model.py` 冒頭のコメント参照）。そのため生成物は
軽量なJSONで、GPUや専用ランタイム無しでPython/TypeScriptどちらでも再生できる。

---

## 構成

```
model-studio/
├── backend/            # FastAPI。Azure App Service (kinpoyo-api) にデプロイ。Azure SQL Databaseに保存
│   ├── main.py            # 全エンドポイント（セッション/タグ/分析/モデル較正・推論）
│   ├── database.py        # Azure SQL接続・スキーマ定義（pyodbc）
│   ├── pose.py             # 動画→MediaPipeランドマーク抽出のユーティリティ
│   ├── pose_analysis.py    # ランドマーク→関節角度（8関節、日本語ラベル）の計算
│   ├── rep_model.py        # 回数カウントのステートマシン＋較正（"学習"）ロジック本体
│   ├── deploy.ps1          # Azure App Serviceへのzipデプロイスクリプト
│   └── startup.sh          # App Service起動コマンド（gunicorn+uvicorn）
├── frontend/            # 動画収集クライアント（Expo）。端末の動画を選択→範囲指定→backendへアップロード
└── analyzer/             # 学習・検証スタジオ（Expo）。タグ管理・正解回数入力・モデル較正・カウント精度チェック
    └── lib/repCount.ts     # rep_model.py の状態機械ロジックのTypeScript移植版（frontend用ではなくanalyzer用）
```

### データフロー（このツール内で完結）

1. `frontend` で動画を撮影/選択 → 範囲を指定 → `backend: POST /sessions` にアップロード
2. `backend` がMediaPipeでフレームごとにポーズ推定 → `FrameSample`（Azure SQL, 1フレーム=1 INSERT）に保存
3. `analyzer` でタグ（=種目）を作成し、対象セッションを紐付け、正解回数（true_reps）を入力
4. `analyzer` → `backend: POST /tags/{id}/build-model` で較正実行
   - `rep_model.calibrate()`: ステートマシン閾値をグリッドサーチ
   - `rep_model.build_template_for_sessions()`: 主役関節の1レップ波形テンプレートを学習
   - `rep_model.build_cycle_stats()`: 絶対角度帯・ROM帯の統計ゲートを学習
   - 結果を `RepModel.config_json`（タグ=種目ごとに1件）として保存
5. `analyzer` の `/check` 画面で、保存済みモデルを使い新規動画に対する回数カウント精度を検証

---

## 本アプリ（kinpoyo）との関係・重要な注意点

- **Azureクラウド構成（Azure App Service + Azure SQL Database、フレーム単位の同期DB書き込み）は
  model-studioの学習ワークフロー専用**。本アプリではこの構成を踏襲しない
  （時間がかかりすぎるため、本アプリ側はローカル処理に切り替える方針。詳細は
  `../kinpoyo/AGENTS.md` を参照）。
- 本アプリ側に必要なのは、ここで生成された `RepModel.config_json`（軽量JSON、種目ごと1件）
  だけであり、model-studioの Azure SQL スキーマ（`RecordingSession` / `FrameSample` /
  `Tag` / `AnalysisResult` / `RepModel` 等）をそのまま持ち込む必要はない。
- ⚠️ 本アプリの `backend-core/app/models/workout.py` にある `pose_records` /
  `ai_reviews` テーブルは、AGENTS.md（本アプリ側）で**別担当者が設計中につき変更禁止**と
  明記されている。model-studio由来のポーズ検出・回数カウント機能を本アプリに統合する際、
  この2テーブルに触れる可能性がある場合は、実装前に必ず担当者と合意すること。
- `analyzer/lib/repCount.ts` は状態機械ロジック（`count_reps` 相当）のみのTS移植版で、
  `rep_model.py` にある較正・1レップテンプレート・統計ゲートまでは移植されていない
  （移植の要否は本アプリの設計方針次第）。

---

## 環境情報（参考・変更不要）

- backend: Python (FastAPI) / MediaPipe / OpenCV / pyodbc（Azure SQL用）
- frontend / analyzer: Expo (React Native)
- デプロイ先: Azure App Service `kinpoyo-api`（リソースグループ `kinpoyo-rg`）+ Azure SQL Database
