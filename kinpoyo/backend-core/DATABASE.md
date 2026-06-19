# kinpoyo データベース設計書

> バックエンド: FastAPI (Python 3.14) / ORM: SQLAlchemy 2.0 / マイグレーション: Alembic 1.16
> DB: PostgreSQL 16（Docker で起動）

---

## 目次

1. [DB環境構築（Docker）](#1-db環境構築docker)
2. [ER図](#2-er図)
3. [マスターテーブル定義](#3-マスターテーブル定義)
4. [テーブル定義](#4-テーブル定義)
5. [インデックス設計方針](#5-インデックス設計方針)
6. [SQLAlchemy Model 命名規則と方針](#6-sqlalchemy-model-命名規則と方針)
7. [Alembic マイグレーション方針](#7-alembic-マイグレーション方針)

---

## 1. DB環境構築（Docker）

> **PostgreSQL のみ Docker で起動する。FastAPI（Python）は venv で直接起動する。**

### 前提条件

- Docker Desktop がインストール済みであること（WSL2 有効化済み）
- `docker-compose.yml` は `kinpoyo/` ディレクトリ直下に配置

### docker-compose.yml

```yaml
services:
  db:
    image: postgres:16
    container_name: kinpoyo_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: kinpoyo
      POSTGRES_USER: kinpoyo
      POSTGRES_PASSWORD: kinpoyo
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### .env（backend-core/.env）

```env
DATABASE_URL=postgresql://kinpoyo:kinpoyo@localhost:5432/kinpoyo
```

> `.env` は Git 管理しない（`.gitignore` に追加すること）

### 起動・停止コマンド

```bash
# DB起動（バックグラウンド）
docker compose up -d db

# DB停止
docker compose stop db

# DB停止 + コンテナ削除
docker compose down

# データも含めて完全削除（注意：全データが消える）
docker compose down -v

# ログ確認
docker compose logs db

# DB接続確認（psql）
docker exec -it kinpoyo_db psql -U kinpoyo -d kinpoyo
```

### Alembic マイグレーション（初回）

```bash
# DB起動後に実行
cd backend-core
venv\Scripts\activate
alembic upgrade head
```

### チームメンバーの初回セットアップ手順

```bash
# 1. リポジトリクローン後
git clone <repo_url>
cd kinpoyo

# 2. DB起動
docker compose up -d db

# 3. バックエンドセットアップ
cd backend-core
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# 4. .env 作成
echo DATABASE_URL=postgresql://kinpoyo:kinpoyo@localhost:5432/kinpoyo > .env

# 5. マイグレーション適用
alembic upgrade head

# 6. シードデータ投入
python scripts/seed_masters.py

# 7. API起動
uvicorn main:app --reload
```

---

## 2. ER図

### マスター領域

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│     genders      │  │ difficulty_levels │  │   measurement_units  │
│ (性別マスター)    │  │ (難易度マスター)   │  │  (計測単位マスター)   │
└──────────────────┘  └──────────────────┘  └──────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  muscle_groups   │  │movement_categories│  │  equipment_types │
│(筋肉部位マスター) │  │(運動分類マスター)  │  │  (器具マスター)  │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────┐
│   goal_types     │  │  program_categories  │  │   post_types     │
│(目標種別マスター) │  │(プログラムカテゴリ)   │  │(投稿種別マスター)│
└──────────────────┘  └─────────────────────┘  └──────────────────┘

┌────────────────────────┐
│  user_program_statuses │
│(プログラム参加状態マスター)|
└────────────────────────┘
```

### 認証・ユーザー領域

```
┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
│    genders   │   │difficulty_lv │   │measurement_units │
└──────┬───────┘   └──────┬───────┘   └────────┬─────────┘
       │FK                │FK                   │FK
       ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────┐
│                      user_profiles                      │
│  (gender_id → genders, experience_level_id → diff_lvs)  │
└─────────────────────┬───────────────────────────────────┘
                      │ 1:1
┌─────────────┐       │
│    users    │◄──────┘
└──────┬──────┘
       │ 1:N
       ▼
┌───────────────────────────────────────────────────┐
│                    body_goals                     │
│  (goal_type_id → goal_types, unit_id → meas_units)│
└───────────────────────────────────────────────────┘
```

### ワークアウト領域

```
┌──────────────┐  ┌───────────────────┐  ┌─────────────────┐
│ muscle_groups│  │movement_categories│  │ equipment_types │
└──────┬───────┘  └────────┬──────────┘  └───────┬─────────┘
       │FK                 │FK                    │FK
       ▼                   ▼                      ▼
┌───────────────────────────────────────────────────────────┐
│                        exercises                          │
│  (primary_muscle_id, movement_category_id, equip_type_id) │
└────────┬──────────────────────────────────────────────────┘
         │ N:N (exercise_secondary_muscles junction)
         ▼
┌─────────────────────────────┐
│  exercise_secondary_muscles │
│  (exercise_id, muscle_group_id)│
└─────────────────────────────┘

┌──────────────┐  1     N  ┌──────────────────┐  1     N  ┌─────────────┐
│  exercises   │◄──────────│ session_exercises │──────────►│ session_sets│
└──────────────┘           └──────────┬───────┘           └──────┬──────┘
                                      │ N                         │ N
                           1 ┌────────┴─────────┐                ▼
              ┌─────────────►│ workout_sessions  │         ┌──────────────┐
              │              └──────────────────┘         │ pose_records │
              │ N                                          └──────────────┘
         ┌────┴─────┐
         │  users   │
         └────┬─────┘
              │ N
              ▼
┌─────────────────────────────────────────────────────────────┐
│                       user_programs                         │
│   (status_id → user_program_statuses)                       │
└─────────────────────────────────────────────────────────────┘

┌────────────────────────┐  1     N  ┌──────────────────┐
│       programs         │◄──────────│ program_exercises│
│ (category_id, diff_id) │           └──────────────────┘
└────────────────────────┘
```

### AI レビュー領域 (変更なし・触れないこと)

```
┌──────────────────┐  1     1  ┌──────────────┐
│ session_exercises│──────────►│  ai_reviews  │
└──────────────────┘           └──────────────┘
```

### コミュニティー領域

```
┌────────────┐
│  post_types│ (FK)
└─────┬──────┘
      ▼
┌──────────┐  1     N  ┌───────────┐  1     N  ┌───────────────┐
│  users   │──────────►│   posts   │──────────►│ post_comments │
└────┬─────┘           └─────┬─────┘           └───────────────┘
     │                       │ 1     N  ┌────────────┐
     │                       └─────────►│ post_likes │
     │ N                                └────────────┘
┌────┴────────┐
│   follows   │ (follower_id → users, followee_id → users)
└─────────────┘
```

---

## 3. マスターテーブル定義

マスターテーブルは**アプリ起動時にシードデータとして投入**し、基本的に変更しない。
`id` は SMALLINT（値の種類が少ないため）、`sort_order` で表示順を制御する。

---

### 3.1 genders — 性別マスター

```sql
CREATE TABLE genders (
    id         SMALLINT    PRIMARY KEY,
    code       VARCHAR(10) NOT NULL UNIQUE,   -- 'male' | 'female' | 'other'
    name_ja    VARCHAR(20) NOT NULL,          -- '男性' | '女性' | 'その他'
    sort_order SMALLINT    NOT NULL DEFAULT 0
);
```

| id | code   | name_ja | sort_order |
|----|--------|---------|------------|
| 1  | male   | 男性    | 1          |
| 2  | female | 女性    | 2          |
| 3  | other  | その他  | 3          |

---

### 3.2 difficulty_levels — 難易度マスター

`user_profiles.experience_level` と `programs.difficulty` を統合管理。

```sql
CREATE TABLE difficulty_levels (
    id         SMALLINT     PRIMARY KEY,
    code       VARCHAR(20)  NOT NULL UNIQUE,  -- 'beginner' | 'intermediate' | 'advanced'
    name_ja    VARCHAR(30)  NOT NULL,
    sort_order SMALLINT     NOT NULL DEFAULT 0
);
```

| id | code         | name_ja    | sort_order |
|----|--------------|------------|------------|
| 1  | beginner     | 初心者      | 1          |
| 2  | intermediate | 中級者      | 2          |
| 3  | advanced     | 上級者      | 3          |

---

### 3.3 muscle_groups — 筋肉部位マスター

フロントエンドの色分けチップ（`color_hex`）と対応させる。

```sql
CREATE TABLE muscle_groups (
    id          SMALLINT    PRIMARY KEY,
    code        VARCHAR(30) NOT NULL UNIQUE,  -- 'chest' | 'back' | 'legs' etc.
    name_ja     VARCHAR(50) NOT NULL,
    name_en     VARCHAR(50) NOT NULL,
    body_region VARCHAR(10) NOT NULL,          -- 'upper' | 'lower' | 'core'
    color_hex   VARCHAR(7),                    -- '#RRGGBB' フロントエンド色分け用
    sort_order  SMALLINT    NOT NULL DEFAULT 0
);
```

| id | code      | name_ja    | name_en    | body_region | color_hex |
|----|-----------|------------|------------|-------------|-----------|
| 1  | chest     | 胸         | Chest      | upper       | #FF6B6B   |
| 2  | back      | 背中       | Back       | upper       | #4ECDC4   |
| 3  | shoulders | 肩         | Shoulders  | upper       | #45B7D1   |
| 4  | arms      | 腕         | Arms       | upper       | #96CEB4   |
| 5  | legs      | 脚         | Legs       | lower       | #FFEAA7   |
| 6  | core      | 体幹       | Core       | core        | #DDA0DD   |
| 7  | glutes    | お尻       | Glutes     | lower       | #F0A500   |
| 8  | calves    | ふくらはぎ  | Calves     | lower       | #98D8C8   |

---

### 3.4 movement_categories — 運動分類マスター (PPL)

```sql
CREATE TABLE movement_categories (
    id         SMALLINT    PRIMARY KEY,
    code       VARCHAR(20) NOT NULL UNIQUE,  -- 'push' | 'pull' | 'legs'
    name_ja    VARCHAR(30) NOT NULL,
    sort_order SMALLINT    NOT NULL DEFAULT 0
);
```

| id | code  | name_ja | sort_order |
|----|-------|---------|------------|
| 1  | push  | プッシュ | 1          |
| 2  | pull  | プル    | 2          |
| 3  | legs  | レッグス | 3          |

---

### 3.5 equipment_types — 器具タイプマスター

```sql
CREATE TABLE equipment_types (
    id         SMALLINT    PRIMARY KEY,
    code       VARCHAR(30) NOT NULL UNIQUE,
    name_ja    VARCHAR(50) NOT NULL,
    sort_order SMALLINT    NOT NULL DEFAULT 0
);
```

| id | code        | name_ja           | sort_order |
|----|-------------|-------------------|------------|
| 1  | barbell     | バーベル           | 1          |
| 2  | dumbbell    | ダンベル           | 2          |
| 3  | machine     | マシン            | 3          |
| 4  | bodyweight  | 自重              | 4          |
| 5  | cable       | ケーブル           | 5          |
| 6  | kettlebell  | ケトルベル         | 6          |
| 7  | resistance_band | チューブ       | 7          |

---

### 3.6 measurement_units — 計測単位マスター

```sql
CREATE TABLE measurement_units (
    id         SMALLINT    PRIMARY KEY,
    code       VARCHAR(10) NOT NULL UNIQUE,  -- 'kg' | 'lbs' | 'pct' | 'cm' | 'ft'
    symbol     VARCHAR(5)  NOT NULL,
    unit_type  VARCHAR(20) NOT NULL,          -- 'weight' | 'percentage' | 'length'
    sort_order SMALLINT    NOT NULL DEFAULT 0
);
```

| id | code | symbol | unit_type  | sort_order |
|----|------|--------|------------|------------|
| 1  | kg   | kg     | weight     | 1          |
| 2  | lbs  | lbs    | weight     | 2          |
| 3  | pct  | %      | percentage | 3          |
| 4  | cm   | cm     | length     | 4          |
| 5  | ft   | ft     | length     | 5          |

---

### 3.7 goal_types — 目標種別マスター

```sql
CREATE TABLE goal_types (
    id              SMALLINT    PRIMARY KEY,
    code            VARCHAR(30) NOT NULL UNIQUE,  -- 'weight' | 'body_fat' | 'muscle_mass'
    name_ja         VARCHAR(50) NOT NULL,
    default_unit_id SMALLINT    REFERENCES measurement_units(id),
    sort_order      SMALLINT    NOT NULL DEFAULT 0
);
```

| id | code         | name_ja    | default_unit_id |
|----|--------------|------------|-----------------|
| 1  | weight       | 体重目標   | 1 (kg)          |
| 2  | body_fat     | 体脂肪率目標| 3 (%)          |
| 3  | muscle_mass  | 筋肉量目標 | 1 (kg)          |

---

### 3.8 program_categories — プログラムカテゴリーマスター

```sql
CREATE TABLE program_categories (
    id         SMALLINT    PRIMARY KEY,
    code       VARCHAR(30) NOT NULL UNIQUE,
    name_ja    VARCHAR(50) NOT NULL,
    sort_order SMALLINT    NOT NULL DEFAULT 0
);
```

| id | code         | name_ja       | sort_order |
|----|--------------|---------------|------------|
| 1  | strength     | 筋力強化       | 1          |
| 2  | hypertrophy  | 筋肥大         | 2          |
| 3  | bodyweight   | 自重トレーニング | 3          |
| 4  | cardio       | 有酸素         | 4          |

---

### 3.9 user_program_statuses — ユーザープログラム参加状態マスター

```sql
CREATE TABLE user_program_statuses (
    id         SMALLINT    PRIMARY KEY,
    code       VARCHAR(20) NOT NULL UNIQUE,  -- 'active' | 'paused' | 'completed' | 'dropped'
    name_ja    VARCHAR(30) NOT NULL,
    sort_order SMALLINT    NOT NULL DEFAULT 0
);
```

| id | code      | name_ja   | sort_order |
|----|-----------|-----------|------------|
| 1  | active    | 実施中    | 1          |
| 2  | paused    | 一時停止  | 2          |
| 3  | completed | 完了      | 3          |
| 4  | dropped   | 中断      | 4          |

---

### 3.10 post_types — 投稿種別マスター

```sql
CREATE TABLE post_types (
    id         SMALLINT    PRIMARY KEY,
    code       VARCHAR(20) NOT NULL UNIQUE,  -- 'feed' | 'qa'
    name_ja    VARCHAR(30) NOT NULL,
    sort_order SMALLINT    NOT NULL DEFAULT 0
);
```

| id | code | name_ja    | sort_order |
|----|------|------------|------------|
| 1  | feed | フィード    | 1          |
| 2  | qa   | Q&A        | 2          |

---

## 4. テーブル定義

### 4.1 users — ユーザーアカウント

認証情報を管理するコアテーブル。パスワードは bcrypt ハッシュで保存。

```sql
CREATE TABLE users (
    id            SERIAL          PRIMARY KEY,
    username      VARCHAR(50)     NOT NULL UNIQUE,
    email         VARCHAR(255)    NOT NULL UNIQUE,
    password_hash VARCHAR(255)    NOT NULL,
    is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
    is_admin      BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_users_email    ON users(email);
CREATE UNIQUE INDEX uq_users_username ON users(username);
```

| カラム名      | 型            | 制約                   | 説明                      |
|--------------|---------------|------------------------|--------------------------|
| id           | SERIAL        | PK                     | 自動採番                  |
| username     | VARCHAR(50)   | NOT NULL, UNIQUE       | 表示名・ログインID          |
| email        | VARCHAR(255)  | NOT NULL, UNIQUE       | メールアドレス             |
| password_hash| VARCHAR(255)  | NOT NULL               | bcrypt ハッシュ           |
| is_active    | BOOLEAN       | NOT NULL, DEFAULT TRUE | アカウント有効フラグ        |
| is_admin     | BOOLEAN       | NOT NULL, DEFAULT FALSE| 管理者フラグ              |
| created_at   | TIMESTAMPTZ   | NOT NULL               | 作成日時                  |
| updated_at   | TIMESTAMPTZ   | NOT NULL               | 更新日時                  |

---

### 4.2 user_profiles — 身体データ・プロフィール

ユーザーの最新の身体情報。1ユーザー1レコード。

> **変更点**: `gender` (VARCHAR) → `gender_id` (FK to `genders`)、`experience_level` (VARCHAR) → `experience_level_id` (FK to `difficulty_levels`)

```sql
CREATE TABLE user_profiles (
    id                   SERIAL       PRIMARY KEY,
    user_id              INTEGER      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name         VARCHAR(100),
    avatar_url           VARCHAR(500),
    bio                  TEXT,
    birth_date           DATE,
    gender_id            SMALLINT     REFERENCES genders(id),
    height_cm            NUMERIC(5,1),
    weight_kg            NUMERIC(5,2),
    body_fat_pct         NUMERIC(4,1),
    muscle_mass_kg       NUMERIC(5,2),
    experience_level_id  SMALLINT     REFERENCES difficulty_levels(id) DEFAULT 1,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_user_profiles_user_id ON user_profiles(user_id);
```

| カラム名              | 型            | 制約                         | 説明                          |
|---------------------|---------------|------------------------------|-------------------------------|
| id                  | SERIAL        | PK                           | 自動採番                       |
| user_id             | INTEGER       | FK(users), UNIQUE, NOT NULL  | ユーザー参照（1対1）            |
| display_name        | VARCHAR(100)  |                              | 表示名（ニックネーム）           |
| avatar_url          | VARCHAR(500)  |                              | プロフィール画像URL             |
| bio                 | TEXT          |                              | 自己紹介文                     |
| birth_date          | DATE          |                              | 生年月日                       |
| gender_id           | SMALLINT      | FK(genders)                  | 性別（マスター参照）             |
| height_cm           | NUMERIC(5,1)  |                              | 身長 (cm)                     |
| weight_kg           | NUMERIC(5,2)  |                              | 体重 (kg)                     |
| body_fat_pct        | NUMERIC(4,1)  |                              | 体脂肪率 (%)                  |
| muscle_mass_kg      | NUMERIC(5,2)  |                              | 筋肉量 (kg)                   |
| experience_level_id | SMALLINT      | FK(difficulty_levels), DEFAULT 1 | トレーニング経験レベル       |
| created_at          | TIMESTAMPTZ   | NOT NULL                     | 作成日時                       |
| updated_at          | TIMESTAMPTZ   | NOT NULL                     | 更新日時                       |

---

### 4.3 body_goals — 体重・体脂肪率の目標

ユーザーが設定する目標値。複数の目標を時系列で持てる。

> **変更点**: `goal_type` (VARCHAR) → `goal_type_id` (FK to `goal_types`)、`unit` (VARCHAR) → `unit_id` (FK to `measurement_units`)

```sql
CREATE TABLE body_goals (
    id            SERIAL       PRIMARY KEY,
    user_id       INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_type_id  SMALLINT     NOT NULL REFERENCES goal_types(id),
    target_value  NUMERIC(6,2) NOT NULL,
    current_value NUMERIC(6,2),
    unit_id       SMALLINT     NOT NULL REFERENCES measurement_units(id),
    deadline      DATE,
    is_achieved   BOOLEAN      NOT NULL DEFAULT FALSE,
    achieved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_body_goals_user_id      ON body_goals(user_id);
CREATE INDEX idx_body_goals_user_type    ON body_goals(user_id, goal_type_id);
```

| カラム名       | 型            | 制約                   | 説明                         |
|--------------|---------------|------------------------|------------------------------|
| id           | SERIAL        | PK                     | 自動採番                      |
| user_id      | INTEGER       | FK(users), NOT NULL    | ユーザー参照                   |
| goal_type_id | SMALLINT      | FK(goal_types), NOT NULL | 目標種別（マスター参照）        |
| target_value | NUMERIC(6,2)  | NOT NULL               | 目標値                        |
| current_value| NUMERIC(6,2)  |                        | 計測時の現在値                 |
| unit_id      | SMALLINT      | FK(measurement_units), NOT NULL | 単位（マスター参照）  |
| deadline     | DATE          |                        | 目標達成期限                   |
| is_achieved  | BOOLEAN       | NOT NULL, DEFAULT FALSE | 達成フラグ                    |
| achieved_at  | TIMESTAMPTZ   |                        | 達成日時                       |
| created_at   | TIMESTAMPTZ   | NOT NULL               | 作成日時                       |
| updated_at   | TIMESTAMPTZ   | NOT NULL               | 更新日時                       |

---

### 4.4 exercises — 種目マスター

アプリ共通の種目定義。管理者が登録・ユーザーが参照する。

> **変更点**:
> - `primary_muscle` (VARCHAR) → `primary_muscle_id` (FK to `muscle_groups`)
> - `secondary_muscles` (VARCHAR カンマ区切り) → **削除** → `exercise_secondary_muscles` ジャンクションテーブルに分離
> - `movement_category` (VARCHAR) → `movement_category_id` (FK to `movement_categories`)
> - `equipment` (VARCHAR) → `equipment_type_id` (FK to `equipment_types`)

```sql
CREATE TABLE exercises (
    id                   SERIAL       PRIMARY KEY,
    name                 VARCHAR(100) NOT NULL UNIQUE,
    name_en              VARCHAR(100),
    description          TEXT,
    primary_muscle_id    SMALLINT     NOT NULL REFERENCES muscle_groups(id),
    movement_category_id SMALLINT     NOT NULL REFERENCES movement_categories(id),
    equipment_type_id    SMALLINT     REFERENCES equipment_types(id),  -- NULLは自重
    is_compound          BOOLEAN      NOT NULL DEFAULT FALSE,
    is_cardio            BOOLEAN      NOT NULL DEFAULT FALSE,
    mediapipe_enabled    BOOLEAN      NOT NULL DEFAULT FALSE,
    thumbnail_url        VARCHAR(500),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_exercises_name               ON exercises(name);
CREATE INDEX idx_exercises_primary_muscle_id        ON exercises(primary_muscle_id);
CREATE INDEX idx_exercises_movement_category_id     ON exercises(movement_category_id);
CREATE INDEX idx_exercises_equipment_type_id        ON exercises(equipment_type_id);
```

| カラム名              | 型            | 制約                   | 説明                            |
|---------------------|---------------|------------------------|---------------------------------|
| id                  | SERIAL        | PK                     | 自動採番                         |
| name                | VARCHAR(100)  | NOT NULL, UNIQUE       | 種目名（日本語）                  |
| name_en             | VARCHAR(100)  |                        | 種目名（英語）                    |
| description         | TEXT          |                        | 説明・フォームポイント             |
| primary_muscle_id   | SMALLINT      | FK(muscle_groups), NOT NULL | 主動筋（マスター参照）        |
| movement_category_id| SMALLINT      | FK(movement_categories), NOT NULL | PPL分類（マスター参照）|
| equipment_type_id   | SMALLINT      | FK(equipment_types)    | 使用器具（NULLは自重）            |
| is_compound         | BOOLEAN       | NOT NULL               | 複合種目かどうか                  |
| is_cardio           | BOOLEAN       | NOT NULL               | 有酸素種目フラグ                  |
| mediapipe_enabled   | BOOLEAN       | NOT NULL               | AI回数カウント対応フラグ           |
| thumbnail_url       | VARCHAR(500)  |                        | サムネイル画像URL                 |
| created_at          | TIMESTAMPTZ   | NOT NULL               | 作成日時                          |

---

### 4.5 exercise_secondary_muscles — 種目の補助筋（ジャンクションテーブル）

`exercises.secondary_muscles` (VARCHAR カンマ区切り) を正規化したテーブル。

> **実装注意**: SQLAlchemy で `relationship(secondary=...)` を使うため、マップドクラスではなく `Table` オブジェクトとして定義すること（セクション [6.4](#64-マスターモデルの実装例) 参照）。

```sql
CREATE TABLE exercise_secondary_muscles (
    exercise_id     INTEGER  NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    muscle_group_id SMALLINT NOT NULL REFERENCES muscle_groups(id),
    PRIMARY KEY (exercise_id, muscle_group_id)
);

CREATE INDEX idx_esm_exercise_id     ON exercise_secondary_muscles(exercise_id);
CREATE INDEX idx_esm_muscle_group_id ON exercise_secondary_muscles(muscle_group_id);
```

| カラム名       | 型       | 制約                       | 説明               |
|--------------|----------|----------------------------|--------------------|
| exercise_id  | INTEGER  | FK(exercises), NOT NULL    | 種目参照            |
| muscle_group_id| SMALLINT| FK(muscle_groups), NOT NULL| 補助筋（マスター参照）|
| -            | -        | PRIMARY KEY (両カラム)      | 重複防止            |

---

### 4.6 workout_sessions — ワークアウトセッション

1回のトレーニングセッションを表す。

```sql
CREATE TABLE workout_sessions (
    id           SERIAL        PRIMARY KEY,
    user_id      INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        VARCHAR(100),
    memo         TEXT,
    scheduled_date DATE,                        -- カレンダー登録日（事前登録時に使用）
    started_at   TIMESTAMPTZ,
    ended_at     TIMESTAMPTZ,
    duration_sec INTEGER,
    total_volume NUMERIC(10,2),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workout_sessions_user_id       ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_user_started  ON workout_sessions(user_id, started_at DESC);
CREATE INDEX idx_workout_sessions_user_date     ON workout_sessions(user_id, scheduled_date);
```

| カラム名       | 型            | 制約                   | 説明                              |
|--------------|---------------|------------------------|-----------------------------------|
| id           | SERIAL        | PK                     | 自動採番                           |
| user_id      | INTEGER       | FK(users), NOT NULL    | ユーザー参照                        |
| title        | VARCHAR(100)  |                        | セッションタイトル（任意）            |
| memo         | TEXT          |                        | 自由メモ                            |
| scheduled_date| DATE         |                        | カレンダー登録日（事前登録の場合に設定）|
| started_at   | TIMESTAMPTZ   |                        | セッション開始日時（開始時に設定）      |
| ended_at     | TIMESTAMPTZ   |                        | セッション終了日時                    |
| duration_sec | INTEGER       |                        | セッション時間（秒）                  |
| total_volume | NUMERIC(10,2) |                        | 総ボリューム (kg×reps合計)            |
| created_at   | TIMESTAMPTZ   | NOT NULL               | 作成日時                            |
| updated_at   | TIMESTAMPTZ   | NOT NULL               | 更新日時                            |

---

### 4.7 session_exercises — セッション内の種目

セッションに含まれる種目のリスト。順序を保持する。

```sql
CREATE TABLE session_exercises (
    id                SERIAL      PRIMARY KEY,
    session_id        INTEGER     NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id       INTEGER     NOT NULL REFERENCES exercises(id),
    order_index       SMALLINT    NOT NULL DEFAULT 0,
    target_sets       SMALLINT,
    rest_interval_sec INTEGER,
    memo              TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_exercises_session_id  ON session_exercises(session_id);
CREATE INDEX idx_session_exercises_exercise_id ON session_exercises(exercise_id);
```

| カラム名            | 型          | 制約                          | 説明                       |
|-------------------|-------------|-------------------------------|----------------------------|
| id                | SERIAL      | PK                            | 自動採番                    |
| session_id        | INTEGER     | FK(workout_sessions), NOT NULL| セッション参照               |
| exercise_id       | INTEGER     | FK(exercises), NOT NULL       | 種目参照                    |
| order_index       | SMALLINT    | NOT NULL, DEFAULT 0           | セッション内の実施順          |
| target_sets       | SMALLINT    |                               | 目標セット数                 |
| rest_interval_sec | INTEGER     |                               | セット間インターバル (秒)      |
| memo              | TEXT        |                               | 種目メモ                     |
| created_at        | TIMESTAMPTZ | NOT NULL                      | 作成日時                     |

---

### 4.8 session_sets — セット記録

各種目のセットごとの記録。RPE (Rate of Perceived Exertion) も保存。

```sql
CREATE TABLE session_sets (
    id                   SERIAL       PRIMARY KEY,
    session_exercise_id  INTEGER      NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
    set_number           SMALLINT     NOT NULL,
    weight_kg            NUMERIC(6,2),
    reps                 SMALLINT,
    rpe                  NUMERIC(3,1),
    duration_sec         INTEGER,
    is_warmup            BOOLEAN      NOT NULL DEFAULT FALSE,
    ai_counted_reps      SMALLINT,
    completed_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_sets_session_exercise_id ON session_sets(session_exercise_id);
```

| カラム名              | 型            | 制約                          | 説明                           |
|--------------------|---------------|-------------------------------|--------------------------------|
| id                 | SERIAL        | PK                            | 自動採番                        |
| session_exercise_id| INTEGER       | FK(session_exercises), NOT NULL| 種目参照                       |
| set_number         | SMALLINT      | NOT NULL                      | セット番号（1始まり）             |
| weight_kg          | NUMERIC(6,2)  |                               | 重量 (kg)、自重はNULL            |
| reps               | SMALLINT      |                               | 実施回数                         |
| rpe                | NUMERIC(3,1)  |                               | 主観的強度 (1.0〜10.0)           |
| duration_sec       | INTEGER       |                               | 継続時間（有酸素種目用）           |
| is_warmup          | BOOLEAN       | NOT NULL, DEFAULT FALSE       | ウォームアップセットフラグ         |
| ai_counted_reps    | SMALLINT      |                               | MediaPipe AI カウント回数        |
| completed_at       | TIMESTAMPTZ   |                               | セット完了日時                    |
| created_at         | TIMESTAMPTZ   | NOT NULL                      | 作成日時                         |

---

### 4.9 pose_records — MediaPipe ポーズデータ

> **AI処理テーブル — 変更禁止**

```sql
CREATE TABLE pose_records (
    id                 SERIAL       PRIMARY KEY,
    session_set_id     INTEGER      NOT NULL REFERENCES session_sets(id) ON DELETE CASCADE,
    recorded_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    landmarks_json     JSONB        NOT NULL,
    joint_angles_json  JSONB,
    rep_count_snapshot SMALLINT,
    frame_index        INTEGER      NOT NULL
);

CREATE INDEX idx_pose_records_session_set_id ON pose_records(session_set_id);
CREATE INDEX idx_pose_records_recorded_at    ON pose_records(recorded_at);
```

| カラム名             | 型          | 制約                    | 説明                              |
|--------------------|-------------|-------------------------|-----------------------------------|
| id                 | SERIAL      | PK                      | 自動採番                           |
| session_set_id     | INTEGER     | FK(session_sets), NOT NULL | セット参照                       |
| recorded_at        | TIMESTAMPTZ | NOT NULL                | 記録日時                           |
| landmarks_json     | JSONB       | NOT NULL                | MediaPipe 33ランドマーク座標        |
| joint_angles_json  | JSONB       |                         | 計算済み関節角度                    |
| rep_count_snapshot | SMALLINT    |                         | フレーム時点の累積レップ数           |
| frame_index        | INTEGER     | NOT NULL                | フレーム番号                        |

---

### 4.10 ai_reviews — Claude API フォームレビュー

> **AI処理テーブル — 変更禁止**

```sql
CREATE TABLE ai_reviews (
    id                   SERIAL       PRIMARY KEY,
    session_exercise_id  INTEGER      NOT NULL UNIQUE REFERENCES session_exercises(id) ON DELETE CASCADE,
    model_version        VARCHAR(50)  NOT NULL DEFAULT 'claude-sonnet-4-6',
    prompt_tokens        INTEGER,
    completion_tokens    INTEGER,
    overall_score        SMALLINT,
    feedback_text        TEXT         NOT NULL,
    strengths_json       JSONB,
    improvements_json    JSONB,
    injury_risk_level    VARCHAR(10),   -- 'low' | 'medium' | 'high' (AI出力値のため文字列のまま保持)
    generated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_ai_reviews_session_exercise_id ON ai_reviews(session_exercise_id);
CREATE INDEX idx_ai_reviews_generated_at ON ai_reviews(generated_at);
```

| カラム名              | 型           | 制約                          | 説明                               |
|--------------------|--------------|-------------------------------|-------------------------------------|
| id                 | SERIAL       | PK                            | 自動採番                            |
| session_exercise_id| INTEGER      | FK(session_exercises), UNIQUE | 種目参照（1種目に1レビュー）         |
| model_version      | VARCHAR(50)  | NOT NULL                      | 使用したClaudeモデルID              |
| prompt_tokens      | INTEGER      |                               | プロンプトトークン数（コスト管理用）  |
| completion_tokens  | INTEGER      |                               | 補完トークン数（コスト管理用）        |
| overall_score      | SMALLINT     |                               | フォームスコア (0〜100)              |
| feedback_text      | TEXT         | NOT NULL                      | AIフィードバック本文                 |
| strengths_json     | JSONB        |                               | 良かった点リスト                     |
| improvements_json  | JSONB        |                               | 改善点リスト                         |
| injury_risk_level  | VARCHAR(10)  |                               | 怪我リスクレベル（AI出力値）         |
| generated_at       | TIMESTAMPTZ  | NOT NULL                      | 生成日時                             |

---

### 4.11 programs — プログラムマスター

> **変更点**: `category` (VARCHAR) → `category_id` (FK to `program_categories`)、`difficulty` (VARCHAR) → `difficulty_level_id` (FK to `difficulty_levels`)

```sql
CREATE TABLE programs (
    id                  SERIAL       PRIMARY KEY,
    name                VARCHAR(100) NOT NULL UNIQUE,
    description         TEXT,
    category_id         SMALLINT     REFERENCES program_categories(id),
    difficulty_level_id SMALLINT     REFERENCES difficulty_levels(id),
    duration_weeks      SMALLINT,
    frequency_per_week  SMALLINT,
    thumbnail_url       VARCHAR(500),
    is_public           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by          INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_programs_name         ON programs(name);
CREATE INDEX idx_programs_category_id        ON programs(category_id);
CREATE INDEX idx_programs_difficulty_level_id ON programs(difficulty_level_id);
```

| カラム名              | 型            | 制約                    | 説明                                  |
|--------------------|---------------|-------------------------|---------------------------------------|
| id                 | SERIAL        | PK                      | 自動採番                               |
| name               | VARCHAR(100)  | NOT NULL, UNIQUE        | プログラム名                            |
| description        | TEXT          |                         | 説明文                                 |
| category_id        | SMALLINT      | FK(program_categories)  | プログラムカテゴリ（マスター参照）         |
| difficulty_level_id| SMALLINT      | FK(difficulty_levels)   | 難易度（マスター参照）                   |
| duration_weeks     | SMALLINT      |                         | プログラム期間 (週)                      |
| frequency_per_week | SMALLINT      |                         | 週実施頻度                              |
| thumbnail_url      | VARCHAR(500)  |                         | サムネイルURL                           |
| is_public          | BOOLEAN       | NOT NULL, DEFAULT TRUE  | 公開フラグ                              |
| created_by         | INTEGER       | FK(users), NULL可       | 作成者 (NULLは公式)                     |
| created_at         | TIMESTAMPTZ   | NOT NULL                | 作成日時                                |
| updated_at         | TIMESTAMPTZ   | NOT NULL                | 更新日時                                |

---

### 4.12 program_exercises — プログラム内の種目

```sql
CREATE TABLE program_exercises (
    id                SERIAL    PRIMARY KEY,
    program_id        INTEGER   NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    exercise_id       INTEGER   NOT NULL REFERENCES exercises(id),
    week_number       SMALLINT  NOT NULL,
    day_number        SMALLINT  NOT NULL,
    order_index       SMALLINT  NOT NULL DEFAULT 0,
    sets              SMALLINT  NOT NULL,
    reps_min          SMALLINT,
    reps_max          SMALLINT,
    rest_interval_sec INTEGER,
    note              TEXT
);

CREATE INDEX idx_program_exercises_program_id ON program_exercises(program_id);
CREATE INDEX idx_program_exercises_week_day   ON program_exercises(program_id, week_number, day_number);
```

---

### 4.13 user_programs — ユーザーのプログラム参加状態

> **変更点**: `status` (VARCHAR) → `status_id` (FK to `user_program_statuses`)

```sql
CREATE TABLE user_programs (
    id          SERIAL       PRIMARY KEY,
    user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_id  INTEGER      NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    status_id   SMALLINT     NOT NULL REFERENCES user_program_statuses(id) DEFAULT 1,
    current_week SMALLINT    NOT NULL DEFAULT 1,
    current_day  SMALLINT    NOT NULL DEFAULT 1,
    started_at  DATE         NOT NULL DEFAULT CURRENT_DATE,
    completed_at DATE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, program_id)
);

CREATE INDEX idx_user_programs_user_id    ON user_programs(user_id);
CREATE INDEX idx_user_programs_program_id ON user_programs(program_id);
CREATE UNIQUE INDEX uq_user_programs_user_program ON user_programs(user_id, program_id);
```

| カラム名     | 型           | 制約                          | 説明                              |
|------------|--------------|-------------------------------|-----------------------------------|
| id         | SERIAL       | PK                            | 自動採番                           |
| user_id    | INTEGER      | FK(users), NOT NULL           | ユーザー参照                        |
| program_id | INTEGER      | FK(programs), NOT NULL        | プログラム参照                      |
| status_id  | SMALLINT     | FK(user_program_statuses), DEFAULT 1 | 参加状態（マスター参照）       |
| current_week| SMALLINT    | NOT NULL, DEFAULT 1           | 現在の週番号                        |
| current_day | SMALLINT    | NOT NULL, DEFAULT 1           | 現在の日番号                        |
| started_at | DATE         | NOT NULL                      | 開始日                             |
| completed_at| DATE        |                               | 完了日                             |
| created_at | TIMESTAMPTZ  | NOT NULL                      | 作成日時                            |
| updated_at | TIMESTAMPTZ  | NOT NULL                      | 更新日時                            |

---

### 4.14 posts — コミュニティー投稿

> **変更点**: `post_type` (VARCHAR) → `post_type_id` (FK to `post_types`)

```sql
CREATE TABLE posts (
    id                 SERIAL       PRIMARY KEY,
    user_id            INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_type_id       SMALLINT     NOT NULL REFERENCES post_types(id) DEFAULT 1,
    title              VARCHAR(200),
    body               TEXT         NOT NULL,
    image_urls         JSONB,
    workout_session_id INTEGER      REFERENCES workout_sessions(id) ON DELETE SET NULL,
    is_pinned          BOOLEAN      NOT NULL DEFAULT FALSE,
    likes_count        INTEGER      NOT NULL DEFAULT 0,
    comments_count     INTEGER      NOT NULL DEFAULT 0,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_user_id      ON posts(user_id);
CREATE INDEX idx_posts_created_at   ON posts(created_at DESC);
CREATE INDEX idx_posts_post_type_id ON posts(post_type_id, created_at DESC);
```

| カラム名              | 型            | 制約                       | 説明                              |
|--------------------|---------------|----------------------------|-----------------------------------|
| id                 | SERIAL        | PK                         | 自動採番                           |
| user_id            | INTEGER       | FK(users), NOT NULL        | 投稿者参照                          |
| post_type_id       | SMALLINT      | FK(post_types), NOT NULL, DEFAULT 1 | 投稿種別（マスター参照）      |
| title              | VARCHAR(200)  |                            | タイトル（Q&A用）                   |
| body               | TEXT          | NOT NULL                   | 本文                               |
| image_urls         | JSONB         |                            | 添付画像URLリスト（最大5件）         |
| workout_session_id | INTEGER       | FK(workout_sessions)       | 紐づけたワークアウトセッション       |
| is_pinned          | BOOLEAN       | NOT NULL                   | ピン留めフラグ                       |
| likes_count        | INTEGER       | NOT NULL, DEFAULT 0        | いいね数（非正規化キャッシュ）        |
| comments_count     | INTEGER       | NOT NULL, DEFAULT 0        | コメント数（非正規化キャッシュ）      |
| created_at         | TIMESTAMPTZ   | NOT NULL                   | 作成日時                            |
| updated_at         | TIMESTAMPTZ   | NOT NULL                   | 更新日時                            |

---

### 4.15 post_likes — いいね

```sql
CREATE TABLE post_likes (
    id         SERIAL       PRIMARY KEY,
    post_id    INTEGER      NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE UNIQUE INDEX uq_post_likes_post_user ON post_likes(post_id, user_id);
CREATE INDEX idx_post_likes_user_id         ON post_likes(user_id);
```

---

### 4.16 post_comments — コメント

自己参照による返信（ネスト）に対応。

```sql
CREATE TABLE post_comments (
    id          SERIAL       PRIMARY KEY,
    post_id     INTEGER      NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id   INTEGER      REFERENCES post_comments(id) ON DELETE CASCADE,
    body        TEXT         NOT NULL,
    likes_count INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_comments_post_id   ON post_comments(post_id);
CREATE INDEX idx_post_comments_user_id   ON post_comments(user_id);
CREATE INDEX idx_post_comments_parent_id ON post_comments(parent_id);
```

---

### 4.17 follows — フォロー関係

```sql
CREATE TABLE follows (
    id          SERIAL       PRIMARY KEY,
    follower_id INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE(follower_id, followee_id),
    CHECK(follower_id <> followee_id)
);

CREATE UNIQUE INDEX uq_follows_pair  ON follows(follower_id, followee_id);
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_followee_id ON follows(followee_id);
```

---

## 5. インデックス設計方針

### 5.1 基本方針

| 優先度 | 対象                              | 理由                                       |
|-------|-----------------------------------|--------------------------------------------|
| 高    | 全テーブルの PK                    | 自動生成されるクラスタードインデックス        |
| 高    | 全 FK カラム                       | JOIN・外部キー検索の高速化                   |
| 高    | UNIQUE 制約カラム                  | 一意性検証 + 検索高速化                      |
| 中    | `created_at DESC` 系              | フィード・履歴の時系列ソート高速化            |
| 中    | `user_id + 時系列` 複合インデックス | ユーザー別データ取得の高速化                  |
| 低    | JSONB カラム (GIN)                 | ポーズデータの属性検索が必要になった時に追加  |

### 5.2 クエリ別インデックス設計

```
-- ユーザーのワークアウト履歴（日/月/年別）
INDEX: workout_sessions(user_id, started_at DESC)

-- カレンダー表示（日付別）
INDEX: workout_sessions(user_id, scheduled_date)

-- フィード（フォロー中ユーザーの投稿）
INDEX: follows(follower_id)  →  posts(user_id, created_at DESC)

-- 種目別の記録推移（最大重量・ボリュームの成長）
INDEX: session_exercises(exercise_id)  →  session_sets(session_exercise_id)

-- フォロワー数・フォロー数の集計
INDEX: follows(followee_id), follows(follower_id)

-- 種目の絞り込み（部位・PPL・器具）
INDEX: exercises(primary_muscle_id)
INDEX: exercises(movement_category_id)
```

### 5.3 非正規化キャッシュの方針

パフォーマンス上の理由から以下カラムにカウントを非正規化して保持する。
更新はアプリケーション層（またはDBトリガー）で行う。

| テーブル      | カラム           | 更新タイミング                 |
|-------------|-----------------|-------------------------------|
| posts       | likes_count     | post_likes INSERT/DELETE 時   |
| posts       | comments_count  | post_comments INSERT/DELETE 時|
| post_comments| likes_count    | コメントいいね INSERT/DELETE 時|

---

## 6. SQLAlchemy Model 命名規則と方針

### 6.1 ファイル構成

```
backend-core/
├── docker-compose.yml        # PostgreSQL Docker設定（kinpoyo/ 直下に配置）
├── .env                      # 環境変数（Git管理しない）
├── main.py                   # エントリーポイント
├── requirements.txt
├── scripts/
│   └── seed_masters.py       # マスターデータ投入スクリプト
└── app/
    ├── database.py           # Engineとセッション設定
    ├── models/
    │   ├── __init__.py       # 全Modelをまとめてエクスポート
    │   ├── base.py           # DeclarativeBase + TimestampMixin
    │   ├── master.py         # マスター10テーブル
    │   │                     #   Gender, DifficultyLevel, MuscleGroup,
    │   │                     #   MovementCategory, EquipmentType,
    │   │                     #   MeasurementUnit, GoalType, ProgramCategory,
    │   │                     #   UserProgramStatus, PostType
    │   ├── user.py           # User, UserProfile  (BE-A担当)
    │   ├── body.py           # BodyGoal           (BE-A担当)
    │   ├── exercise.py       # exercise_secondary_muscles (Table), Exercise  (BE-B担当)
    │   ├── workout.py        # WorkoutSession, SessionExercise, SessionSet  (BE-B担当)
    │   │                     #   PoseRecord（AI処理・変更禁止）,
    │   │                     #   AiReview（AI処理・変更禁止）
    │   ├── program.py        # Program, ProgramExercise, UserProgram  (BE-B担当)
    │   └── community.py      # Post, PostLike, PostComment, Follow  (BE-B担当)
    ├── schemas/              # Pydantic スキーマ（リクエスト・レスポンス定義）
    │   ├── master.py
    │   ├── user.py
    │   ├── workout.py
    │   ├── program.py
    │   └── community.py
    ├── routers/              # APIルーター（エンドポイント定義）
    │   ├── auth.py
    │   ├── users.py
    │   ├── exercises.py
    │   ├── workouts.py
    │   ├── records.py
    │   ├── programs.py
    │   ├── community.py
    │   └── masters.py
    ├── crud/                 # DB操作ロジック（SELECT/INSERT/UPDATE/DELETE）
    │   ├── user.py
    │   ├── workout.py
    │   ├── program.py
    │   └── community.py
    └── core/
        ├── config.py         # 環境変数管理（DATABASE_URL等）
        ├── security.py       # JWT・パスワードハッシュ（python-jose / passlib）
        └── deps.py           # 依存性注入（get_db, get_current_user）
```

> **モデルファイルの分割方針**
> 機能ドメインごとにファイルを分割する（`user.py` / `body.py` / `exercise.py` / `workout.py` / `program.py` / `community.py`）。
> `workout.py` に `PoseRecord` と `AiReview` も含めるが、これらは**AI処理テーブルのため変更禁止**。

### 6.2 命名規則

| 対象             | 規則                            | 例                              |
|-----------------|----------------------------------|---------------------------------|
| クラス名         | PascalCase・単数形               | `WorkoutSession`, `MuscleGroup` |
| テーブル名       | snake_case・複数形               | `workout_sessions`, `muscle_groups` |
| カラム名         | snake_case                      | `started_at`, `primary_muscle_id` |
| リレーション属性  | snake_case・意味のある名前        | `exercise.primary_muscle`, `post.post_type` |
| バックリファレンス| `back_populates` を使用          | `backref` は避ける              |

### 6.3 共通ベースクラス

```python
# app/models/base.py
from datetime import datetime, timezone
from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
```

### 6.4 マスターモデルの実装例

`exercise_secondary_muscles` は追加カラムのない純粋なジャンクションテーブルなので、
`relationship(secondary=...)` で使うために **マップドクラスではなく `Table` オブジェクト**として定義する。

```python
# app/models/models.py
from sqlalchemy import Table, Column, Integer, SmallInteger, ForeignKey
from app.models.base import Base

# Many-to-Many 中間テーブル（マップドクラスではなく Table オブジェクト）
exercise_secondary_muscles = Table(
    "exercise_secondary_muscles",
    Base.metadata,
    Column("exercise_id", Integer, ForeignKey("exercises.id", ondelete="CASCADE"), primary_key=True),
    Column("muscle_group_id", SmallInteger, ForeignKey("muscle_groups.id"), primary_key=True),
)
```

```python
# app/models/master.py
class MuscleGroup(Base):
    __tablename__ = "muscle_groups"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name_ja: Mapped[str] = mapped_column(String(50), nullable=False)
    name_en: Mapped[str] = mapped_column(String(50), nullable=False)
    body_region: Mapped[str] = mapped_column(String(10), nullable=False)
    color_hex: Mapped[Optional[str]] = mapped_column(String(7))
    sort_order: Mapped[int] = mapped_column(SmallInteger, default=0)

    # リレーション
    primary_exercises: Mapped[list["Exercise"]] = relationship(
        back_populates="primary_muscle"
    )
    secondary_exercises: Mapped[list["Exercise"]] = relationship(
        secondary=exercise_secondary_muscles,   # Table オブジェクトを渡す
        back_populates="secondary_muscles",
        viewonly=True,
    )
```

### 6.5 Mapped アノテーション方針

SQLAlchemy 2.0 の `Mapped[T]` 型ヒントを使用し、`Optional` で nullable を表現する。

```python
class UserProfile(Base, TimestampMixin):
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    gender_id: Mapped[Optional[int]] = mapped_column(SmallInteger, ForeignKey("genders.id"))
    experience_level_id: Mapped[int] = mapped_column(
        SmallInteger, ForeignKey("difficulty_levels.id"), default=1
    )

    # リレーション
    user: Mapped["User"] = relationship(back_populates="profile")
    gender: Mapped[Optional["Gender"]] = relationship()
    experience_level: Mapped["DifficultyLevel"] = relationship()
```

---

## 7. Alembic マイグレーション方針

### 7.1 初期セットアップ

```bash
cd backend-core
alembic init alembic
# alembic/env.py を編集してBase.metadataとDATABASE_URLを設定
```

### 7.2 env.py 設定例

```python
# alembic/env.py (抜粋)
import os
from app.models.base import Base
from app.models import *  # 全Modelをインポートしてautogenerateに認識させる

config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
target_metadata = Base.metadata
```

### 7.3 マイグレーション実行順序（初回）

マスターテーブルは他テーブルより先に作成・シードする必要がある。

```
1. create_master_tables          # マスター10テーブル作成
2. seed_master_data              # マスターデータ投入
3. create_users_table
4. create_user_profiles_table
5. create_body_goals_table
6. create_exercises_table
7. create_exercise_secondary_muscles_table
8. create_workout_sessions_table
9. create_session_exercises_table
10. create_session_sets_table
11. create_pose_records_table
12. create_ai_reviews_table
13. create_programs_table
14. create_program_exercises_table
15. create_user_programs_table
16. create_community_tables      # posts, post_likes, post_comments, follows
```

### 7.4 マイグレーション運用コマンド

| コマンド                                    | 用途                          |
|--------------------------------------------|-------------------------------|
| `alembic revision --autogenerate -m "説明"` | Modelの変更からマイグレーション自動生成 |
| `alembic upgrade head`                      | 最新版に適用                   |
| `alembic downgrade -1`                      | 1つ前に戻す                    |
| `alembic history`                           | マイグレーション履歴の確認       |
| `alembic current`                           | 現在の適用バージョン確認         |

### 7.5 注意事項

- **autogenerate は万能ではない**: CHECK 制約・GINインデックス等は手動記述
- **本番環境への適用前**: `alembic upgrade head --sql` でSQLを事前確認
- **ロールバック設計**: 全マイグレーションに `downgrade()` を必ず実装
- **チーム開発**: マイグレーションファイルは必ずコミットしてバージョン管理
- **データ移行**: スキーマ変更とデータ移行は別ファイルに分割

---

## テーブル間リレーション一覧

### マスター参照

```
genders              ←  user_profiles.gender_id
difficulty_levels    ←  user_profiles.experience_level_id
difficulty_levels    ←  programs.difficulty_level_id
muscle_groups        ←  exercises.primary_muscle_id
muscle_groups        ←  exercise_secondary_muscles.muscle_group_id
movement_categories  ←  exercises.movement_category_id
equipment_types      ←  exercises.equipment_type_id
goal_types           ←  body_goals.goal_type_id
measurement_units    ←  body_goals.unit_id
measurement_units    ←  goal_types.default_unit_id
program_categories   ←  programs.category_id
user_program_statuses←  user_programs.status_id
post_types           ←  posts.post_type_id
```

### エンティティ間

```
users              1──1   user_profiles
users              1──N   body_goals
users              1──N   workout_sessions
users              1──N   user_programs
users              1──N   posts
users              1──N   post_comments
users              N──N   users              (follows テーブル経由)
workout_sessions   1──N   session_exercises
exercises          1──N   session_exercises
exercises          1──N   program_exercises
exercises          N──N   muscle_groups      (exercise_secondary_muscles 経由)
session_exercises  1──N   session_sets
session_sets       1──N   pose_records
session_exercises  1──1   ai_reviews
programs           1──N   program_exercises
programs           N──N   users              (user_programs テーブル経由)
posts              1──N   post_likes
posts              1──N   post_comments
post_comments      1──N   post_comments      (self-referential: 返信)
```
