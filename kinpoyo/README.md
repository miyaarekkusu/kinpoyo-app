# kinpoyo（きんぽよ）

AI技術を活用した筋トレ成長支援・管理アプリ

---

## プロジェクト概要

**kinpoyo** は、スマホのフロントカメラでトレーニングを撮影し、AIが自動で回数をカウント・フォームをレビューする筋トレ管理アプリです。

| 項目           | 内容                  |
|---------------|----------------------|
| フロントエンド  | React Native (Expo)  |
| バックエンド   | FastAPI (Python 3.14) |
| AIポーズ検出   | MediaPipe            |
| AIレビュー     | Claude API           |
| DB            | PostgreSQL 16        |
| ORM           | SQLAlchemy 2.0       |

---

## 主な機能

### 認証・ユーザー管理
- メール/パスワードによるログイン・新規登録
- パスワードリセット（メール確認コード）
- オンボーディング（性別・身長・体重・目標設定）

### 筋トレメニュー管理
- カレンダーによる筋トレ事前登録
- 種目追加（PPL・部位別フィルター、24種目以上）
- セット数・レップ数・重量の設定
- トレーニングプログラム（BIG3強化・ボディウェイト）

### AIトレーニング計測
- フロントカメラによる自動起動
- MediaPipe ポーズ検出による AI 回数カウント
- 関節角度データの記録・比較

### 記録・成長レポート
- 週/月/年別ボリューム推移グラフ
- 種目別最大重量グラフ
- AI トレーナーによるフォームレビュー（Claude API）
- 筋トレ履歴（部位・期間絞り込み）

### コミュニティー
- フィード投稿（画像最大5枚）
- Q&A 投稿
- いいね・コメント
- フォロー・フォロワー
- ユーザー検索（QR コード対応）

---

## 画面一覧

### 認証フロー (`(auth)/`)

| 画面               | ルート              | 状態                |
|-------------------|---------------------|---------------------|
| ログイン           | `/login`            | ✅ UI実装済（モック）|
| 新規登録           | `/signup`           | ✅ UI実装済（モック）|
| パスワードを忘れた  | `/forgot-password`  | ✅ UI実装済（モック）|
| 確認コード入力      | `/verify-code`      | ✅ UI実装済（モック）|
| リセット完了        | `/reset-complete`   | ✅ UI実装済（モック）|
| 新パスワード設定    | `/new-password`     | ✅ UI実装済（モック）|
| 完了アニメーション  | `/success`          | ✅ UI実装済（モック）|

### オンボーディング (`(onboarding)/`)

| 画面        | ルート          | 状態                |
|------------|-----------------|---------------------|
| 性別選択    | `/gender`       | ✅ UI実装済（モック）|
| 身長設定    | `/height`       | ✅ UI実装済（モック）|
| 体重設定    | `/weight`       | ✅ UI実装済（モック）|
| 目標体重設定 | `/weight-goal`  | ✅ UI実装済（モック）|
| 生まれ年設定 | `/year`         | ✅ UI実装済（モック）|
| 筋トレ目標  | `/train-goal`   | ✅ UI実装済（モック）|

### メインタブ (`(tabs)/`)

| 画面         | ルート       | 状態          |
|-------------|-------------|---------------|
| ホーム       | `/`         | ✅ UI実装済   |
| コミュニティー | `/community`| ✅ UI実装済   |
| 筋トレ開始   | `/workout`  | ✅ UI実装済   |
| 記録         | `/records`  | ✅ UI実装済   |
| プロフィール  | `/profile`  | ✅ UI実装済   |

### その他の画面 (`(screens)/`)

| 画面                 | ルート                   | 状態         |
|--------------------|--------------------------|--------------|
| カレンダー           | `/calendar`              | ✅ UI実装済  |
| 筋トレ登録           | `/workout-register`      | ✅ UI実装済  |
| プログラム一覧        | `/program`               | ✅ UI実装済  |
| BIG3 プログラム詳細  | `/program/big3`          | ✅ UI実装済  |
| ボディウェイト詳細    | `/program/bodyweight`    | ✅ UI実装済  |
| 筋肥大とは           | `/program/hypertrophy`   | ✅ UI実装済  |
| プログラム組み方      | `/program/program-design`| ✅ UI実装済  |
| RPE とは            | `/program/rpe`           | ✅ UI実装済  |
| カスタムプログラム    | `/program/custom_program`| ✅ UI実装済  |

---

## セットアップ

### フロントエンド

```bash
cd kinpoyo/frontend
npm install
npx expo start
```

- Node.js v22.20.0 / npm 10.9.3 / Expo SDK 最新版

### バックエンド

> **DB は Docker、FastAPI は venv で起動する（Docker Desktop + WSL2 が必要）**

```bash
# 1. DB起動（PostgreSQL 16 on Docker）
docker compose up -d db

# 2. FastAPI セットアップ
cd kinpoyo/backend-core
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt

# 3. .env 作成
echo DATABASE_URL=postgresql+psycopg://kinpoyo:kinpoyo@localhost:5432/kinpoyo > .env

# 4. マイグレーション適用
alembic upgrade head

# 5. シードデータ投入
python scripts/seed_masters.py

# 6. API起動
uvicorn main:app --reload
```

- Python 3.14.0 (`C:\Python314\python.exe`)
- API ドキュメント: http://localhost:8000/docs
- DB接続先: `postgresql://kinpoyo:kinpoyo@localhost:5432/kinpoyo`
- `docker-compose.yml` はリポジトリルート（`kinpoyo/`）に配置

---

## Git 管理ルール

### ブランチ戦略

```
main          ← 本番ブランチ（直接 push 禁止）
develop       ← 開発統合ブランチ（各機能ブランチはここにマージ）
feature/xxx   ← 機能追加ブランチ
fix/xxx       ← バグ修正ブランチ
```

### 基本コマンド

```bash
# 1. 最新の develop を取得してから作業開始
git checkout develop
git pull origin develop

# 2. 作業ブランチを作成
git checkout -b feature/ブランチ名
# 例: git checkout -b feature/auth-api
# 例: git checkout -b fix/login-validation

# 3. 変更をステージング
git add ファイル名
# 特定ファイルのみを推奨（git add . は不要ファイルを含むリスクあり）

# 4. コミット
git commit -m "コミットメッセージ"
# 例: git commit -m "feat: ユーザー登録APIを実装"
# 例: git commit -m "fix: ログイン時のバリデーションエラーを修正"

# 5. リモートへ push
git push origin ブランチ名
# 例: git push origin feature/auth-api

# 6. GitHub でプルリクエストを作成 → develop にマージ
```

### コミットメッセージ規則

```
<種別>: <概要（日本語 OK）>

種別:
  feat    - 新機能
  fix     - バグ修正
  docs    - ドキュメント変更
  style   - コードスタイル（ロジック変更なし）
  refactor- リファクタリング
  test    - テスト追加・修正
  chore   - ビルド・設定変更

例:
  feat: ワークアウトセッション登録APIを実装
  fix: プロフィール更新時の500エラーを修正
  docs: DATABASE.mdにマスターテーブル定義を追加
```

### PR（プルリクエスト）ルール

- PR は `develop` ブランチに向けて作成する
- レビュワー最低1人の承認が必要
- `main` へのマージはチームリーダーのみ
- コンフリクトは作成者が解消してから承認を依頼する

### よく使うコマンド一覧

```bash
git status                          # 変更ファイルの確認
git diff                            # 変更内容の確認
git log --oneline -10               # 直近10件のコミット履歴
git pull origin develop             # develop の最新を取得
git merge develop                   # develop を現在のブランチに取り込む
git stash                           # 変更を一時退避
git stash pop                       # 退避した変更を復元
git branch -a                       # ブランチ一覧（リモート含む）
```

---

## ディレクトリ構成

```
kinpoyo/
├── AGENTS.md              # AIエージェント向けガイド（必ず読むこと）
├── README.md              # このファイル
├── docker-compose.yml     # PostgreSQL 16 Docker設定
├── frontend/              # React Native (Expo)
│   ├── app/
│   │   ├── (auth)/        # 認証フロー画面
│   │   ├── (onboarding)/  # オンボーディング画面
│   │   ├── (tabs)/        # メインタブ画面
│   │   └── (screens)/     # フルスクリーン画面
│   ├── components/        # 共通コンポーネント
│   ├── constants/         # デザイントークン (theme.ts)
│   └── package.json
└── backend-core/          # FastAPI バックエンド
    ├── main.py
    ├── requirements.txt
    ├── DATABASE.md        # DB 設計書
    ├── scripts/
    │   └── seed_masters.py  # マスターデータ投入
    └── app/
        ├── database.py    # Engine・セッション設定
        ├── models/        # SQLAlchemy モデル（機能別ファイル分割）
        │   ├── base.py    # DeclarativeBase・TimestampMixin
        │   ├── master.py  # マスター10テーブル
        │   ├── user.py    # User・UserProfile
        │   ├── body.py    # BodyGoal
        │   ├── exercise.py# Exercise・ExerciseSecondaryMuscle
        │   ├── workout.py # WorkoutSession・SessionExercise・SessionSet
        │   ├── program.py # Program・ProgramExercise・UserProgram
        │   └── community.py # Post・PostLike・PostComment・Follow
        ├── routers/       # API ルーター
        ├── schemas/       # Pydantic スキーマ
        ├── crud/          # DB 操作
        └── core/          # 設定・認証（security.py / deps.py）
```
