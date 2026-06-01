# kinpoyo データベース設計書

> バックエンド: FastAPI (Python 3.14) / ORM: SQLAlchemy 2.0 / マイグレーション: Alembic 1.16

---

## 目次

1. [ER図](#1-er図)
2. [テーブル定義](#2-テーブル定義)
3. [インデックス設計方針](#3-インデックス設計方針)
4. [SQLAlchemy Model 命名規則と方針](#4-sqlalchemy-model-命名規則と方針)
5. [Alembic マイグレーション方針](#5-alembic-マイグレーション方針)

---

## 1. ER図

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              認証・ユーザー領域                                    │
│                                                                                  │
│  ┌────────────┐  1     1  ┌─────────────────┐  1     N  ┌────────────────┐     │
│  │   users    │──────────►│  user_profiles  │           │  body_goals    │     │
│  └─────┬──────┘           └─────────────────┘           └────────────────┘     │
│        │                                                        ▲               │
│        │ 1                                                      │ N             │
│        └────────────────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ワークアウト領域                                      │
│                                                                                  │
│  ┌─────────────────┐  1     N  ┌──────────────────┐  1     N  ┌─────────────┐ │
│  │    exercises    │◄──────────│ session_exercises │──────────►│session_sets │ │
│  │  (マスター)      │           └──────────┬───────┘           └──────┬──────┘ │
│  └────────┬────────┘                      │ N                         │ 1      │
│           │                               │                            │        │
│           │ N                    1 ┌──────┴──────────┐                │ N      │
│  ┌────────┴────────┐     ┌────────►│workout_sessions │                │        │
│  │program_exercises│     │         └─────────────────┘       ┌────────┴──────┐ │
│  └────────┬────────┘     │ N                                  │ pose_records  │ │
│           │ N            │                                    └───────────────┘ │
│           │         ┌────┴────┐                                                 │
│  ┌────────┴──────┐  │  users  │                                                 │
│  │   programs    │  └────┬────┘                                                 │
│  └───────────────┘       │ N                                                    │
│           ▲              │                                                      │
│           │ N    ┌───────┴─────────┐                                           │
│           └──────│  user_programs  │                                            │
│                  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AI レビュー領域                                      │
│                                                                                  │
│  ┌──────────────────┐  1     1  ┌──────────────┐                               │
│  │ session_exercises│──────────►│  ai_reviews  │                               │
│  └──────────────────┘           └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              コミュニティー領域                                    │
│                                                                                  │
│  ┌─────────┐  1     N  ┌────────────┐  1     N  ┌───────────────┐             │
│  │  users  │──────────►│   posts    │──────────►│ post_comments │             │
│  └────┬────┘           └─────┬──────┘           └───────────────┘             │
│       │                      │ 1     N  ┌────────────┐                         │
│       │                      └─────────►│ post_likes │                         │
│       │ N                               └────────────┘                         │
│  ┌────┴────────┐                                                                │
│  │   follows   │ (follower_id → users, followee_id → users)                   │
│  └─────────────┘                                                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. テーブル定義

### 2.1 users — ユーザーアカウント

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

-- インデックス
CREATE UNIQUE INDEX uq_users_email    ON users(email);
CREATE UNIQUE INDEX uq_users_username ON users(username);
```

| カラム名      | 型            | 制約                  | 説明                      |
|--------------|---------------|-----------------------|--------------------------|
| id           | SERIAL        | PK                    | 自動採番                  |
| username     | VARCHAR(50)   | NOT NULL, UNIQUE      | 表示名・ログインID         |
| email        | VARCHAR(255)  | NOT NULL, UNIQUE      | メールアドレス             |
| password_hash| VARCHAR(255)  | NOT NULL              | bcrypt ハッシュ           |
| is_active    | BOOLEAN       | NOT NULL, DEFAULT TRUE| アカウント有効フラグ        |
| is_admin     | BOOLEAN       | NOT NULL, DEFAULT FALSE| 管理者フラグ              |
| created_at   | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()| 作成日時                 |
| updated_at   | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()| 更新日時                 |

---

### 2.2 user_profiles — 身体データ・プロフィール

ユーザーの最新の身体情報。1ユーザー1レコード（履歴は body_goals で管理）。

```sql
CREATE TABLE user_profiles (
    id              SERIAL          PRIMARY KEY,
    user_id         INTEGER         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name    VARCHAR(100),
    avatar_url      VARCHAR(500),
    bio             TEXT,
    birth_date      DATE,
    gender          VARCHAR(10),                    -- 'male' | 'female' | 'other'
    height_cm       NUMERIC(5, 1),                  -- 身長 (cm)
    weight_kg       NUMERIC(5, 2),                  -- 体重 (kg)
    body_fat_pct    NUMERIC(4, 1),                  -- 体脂肪率 (%)
    muscle_mass_kg  NUMERIC(5, 2),                  -- 筋肉量 (kg)
    experience_level VARCHAR(20) DEFAULT 'beginner', -- 'beginner' | 'intermediate' | 'advanced'
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE UNIQUE INDEX uq_user_profiles_user_id ON user_profiles(user_id);
```

| カラム名         | 型             | 制約                   | 説明                         |
|----------------|----------------|------------------------|------------------------------|
| id             | SERIAL         | PK                     | 自動採番                      |
| user_id        | INTEGER        | FK(users), UNIQUE      | ユーザー参照（1対1）           |
| display_name   | VARCHAR(100)   |                        | 表示名（ニックネーム）          |
| avatar_url     | VARCHAR(500)   |                        | プロフィール画像URL             |
| bio            | TEXT           |                        | 自己紹介文                    |
| birth_date     | DATE           |                        | 生年月日                      |
| gender         | VARCHAR(10)    |                        | 性別                         |
| height_cm      | NUMERIC(5,1)   |                        | 身長 (cm)                    |
| weight_kg      | NUMERIC(5,2)   |                        | 体重 (kg)                    |
| body_fat_pct   | NUMERIC(4,1)   |                        | 体脂肪率 (%)                  |
| muscle_mass_kg | NUMERIC(5,2)   |                        | 筋肉量 (kg)                   |
| experience_level| VARCHAR(20)   | DEFAULT 'beginner'     | トレーニング経験レベル          |
| created_at     | TIMESTAMPTZ    | NOT NULL, DEFAULT NOW()| 作成日時                      |
| updated_at     | TIMESTAMPTZ    | NOT NULL, DEFAULT NOW()| 更新日時                      |

---

### 2.3 body_goals — 体重・体脂肪率の目標

ユーザーが設定する目標値。複数の目標を時系列で持てる。

```sql
CREATE TABLE body_goals (
    id              SERIAL          PRIMARY KEY,
    user_id         INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_type       VARCHAR(30)     NOT NULL,   -- 'weight' | 'body_fat' | 'muscle_mass'
    target_value    NUMERIC(6, 2)   NOT NULL,
    current_value   NUMERIC(6, 2),
    unit            VARCHAR(10)     NOT NULL,   -- 'kg' | '%'
    deadline        DATE,
    is_achieved     BOOLEAN         NOT NULL DEFAULT FALSE,
    achieved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_body_goals_user_id ON body_goals(user_id);
CREATE INDEX idx_body_goals_user_type ON body_goals(user_id, goal_type);
```

| カラム名       | 型            | 制約                   | 説明                              |
|--------------|---------------|------------------------|-----------------------------------|
| id           | SERIAL        | PK                     | 自動採番                           |
| user_id      | INTEGER       | FK(users), NOT NULL    | ユーザー参照                        |
| goal_type    | VARCHAR(30)   | NOT NULL               | 目標種別 (weight / body_fat / muscle_mass) |
| target_value | NUMERIC(6,2)  | NOT NULL               | 目標値                             |
| current_value| NUMERIC(6,2)  |                        | 計測時の現在値                      |
| unit         | VARCHAR(10)   | NOT NULL               | 単位 (kg / %)                      |
| deadline     | DATE          |                        | 目標達成期限                        |
| is_achieved  | BOOLEAN       | NOT NULL, DEFAULT FALSE| 達成フラグ                          |
| achieved_at  | TIMESTAMPTZ   |                        | 達成日時                            |
| created_at   | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()| 作成日時                            |
| updated_at   | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()| 更新日時                            |

---

### 2.4 exercises — 種目マスター

アプリ共通の種目定義。管理者が登録・ユーザーが参照する。

```sql
CREATE TABLE exercises (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL UNIQUE,
    name_en         VARCHAR(100),
    description     TEXT,
    primary_muscle  VARCHAR(50)     NOT NULL,   -- 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' etc.
    secondary_muscles VARCHAR(200),             -- カンマ区切り or JSON配列
    movement_category VARCHAR(20)   NOT NULL,   -- 'push' | 'pull' | 'legs' (PPL分類)
    equipment       VARCHAR(50),                -- 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' etc.
    is_compound     BOOLEAN         NOT NULL DEFAULT FALSE,  -- 複合種目フラグ
    is_cardio       BOOLEAN         NOT NULL DEFAULT FALSE,  -- 有酸素フラグ
    mediapipe_enabled BOOLEAN       NOT NULL DEFAULT FALSE,  -- ポーズ検出対応フラグ
    thumbnail_url   VARCHAR(500),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE UNIQUE INDEX uq_exercises_name ON exercises(name);
CREATE INDEX idx_exercises_primary_muscle ON exercises(primary_muscle);
CREATE INDEX idx_exercises_movement_category ON exercises(movement_category);
```

| カラム名              | 型            | 制約                  | 説明                             |
|---------------------|---------------|-----------------------|----------------------------------|
| id                  | SERIAL        | PK                    | 自動採番                          |
| name                | VARCHAR(100)  | NOT NULL, UNIQUE      | 種目名（日本語）                   |
| name_en             | VARCHAR(100)  |                       | 種目名（英語）                     |
| description         | TEXT          |                       | 説明・フォームポイント              |
| primary_muscle      | VARCHAR(50)   | NOT NULL              | 主動筋                            |
| secondary_muscles   | VARCHAR(200)  |                       | 補助筋（カンマ区切り）              |
| movement_category   | VARCHAR(20)   | NOT NULL              | PPL分類 (push / pull / legs)      |
| equipment           | VARCHAR(50)   |                       | 使用器具                           |
| is_compound         | BOOLEAN       | NOT NULL              | 複合種目かどうか                    |
| is_cardio           | BOOLEAN       | NOT NULL              | 有酸素種目フラグ                    |
| mediapipe_enabled   | BOOLEAN       | NOT NULL              | AI回数カウント対応フラグ            |
| thumbnail_url       | VARCHAR(500)  |                       | サムネイル画像URL                  |
| created_at          | TIMESTAMPTZ   | NOT NULL              | 作成日時                           |

---

### 2.5 workout_sessions — ワークアウトセッション

1回のトレーニングセッションを表す。

```sql
CREATE TABLE workout_sessions (
    id          SERIAL          PRIMARY KEY,
    user_id     INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(100),
    memo        TEXT,
    started_at  TIMESTAMPTZ     NOT NULL,
    ended_at    TIMESTAMPTZ,
    duration_sec INTEGER,                        -- 終了時に計算して格納
    total_volume NUMERIC(10, 2),                 -- 総ボリューム (kg×reps の合計、終了時集計)
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_workout_sessions_user_id      ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_user_started ON workout_sessions(user_id, started_at DESC);
```

| カラム名       | 型            | 制約                   | 説明                             |
|--------------|---------------|------------------------|----------------------------------|
| id           | SERIAL        | PK                     | 自動採番                          |
| user_id      | INTEGER       | FK(users), NOT NULL    | ユーザー参照                       |
| title        | VARCHAR(100)  |                        | セッションタイトル（任意）           |
| memo         | TEXT          |                        | 自由メモ                           |
| started_at   | TIMESTAMPTZ   | NOT NULL               | セッション開始日時                  |
| ended_at     | TIMESTAMPTZ   |                        | セッション終了日時                  |
| duration_sec | INTEGER       |                        | セッション時間（秒）                |
| total_volume | NUMERIC(10,2) |                        | 総ボリューム (kg×reps合計)          |
| created_at   | TIMESTAMPTZ   | NOT NULL               | 作成日時                           |
| updated_at   | TIMESTAMPTZ   | NOT NULL               | 更新日時                           |

---

### 2.6 session_exercises — セッション内の種目

セッションに含まれる種目のリスト。順序を保持する。

```sql
CREATE TABLE session_exercises (
    id                  SERIAL      PRIMARY KEY,
    session_id          INTEGER     NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id         INTEGER     NOT NULL REFERENCES exercises(id),
    order_index         SMALLINT    NOT NULL DEFAULT 0,  -- セッション内の順番
    target_sets         SMALLINT,                        -- 目標セット数
    rest_interval_sec   INTEGER,                         -- インターバル (秒)
    memo                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_session_exercises_session_id  ON session_exercises(session_id);
CREATE INDEX idx_session_exercises_exercise_id ON session_exercises(exercise_id);
```

| カラム名            | 型          | 制約                      | 説明                        |
|-------------------|-------------|---------------------------|-----------------------------|
| id                | SERIAL      | PK                        | 自動採番                     |
| session_id        | INTEGER     | FK(workout_sessions), NOT NULL | セッション参照           |
| exercise_id       | INTEGER     | FK(exercises), NOT NULL   | 種目参照                     |
| order_index       | SMALLINT    | NOT NULL, DEFAULT 0       | セッション内の実施順           |
| target_sets       | SMALLINT    |                           | 目標セット数                  |
| rest_interval_sec | INTEGER     |                           | セット間インターバル (秒)       |
| memo              | TEXT        |                           | 種目メモ                      |
| created_at        | TIMESTAMPTZ | NOT NULL                  | 作成日時                      |

---

### 2.7 session_sets — セット記録

各種目のセットごとの記録。RPE (Rate of Perceived Exertion) も保存。

```sql
CREATE TABLE session_sets (
    id              SERIAL          PRIMARY KEY,
    session_exercise_id INTEGER      NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
    set_number      SMALLINT        NOT NULL,
    weight_kg       NUMERIC(6, 2),                  -- バーベル重量 (kg)。自重種目はNULL
    reps            SMALLINT,                        -- 実施回数
    rpe             NUMERIC(3, 1),                  -- RPE 1.0〜10.0
    duration_sec    INTEGER,                         -- 有酸素種目の継続時間
    is_warmup       BOOLEAN         NOT NULL DEFAULT FALSE,
    ai_counted_reps SMALLINT,                        -- AI回数カウント結果
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_session_sets_session_exercise_id ON session_sets(session_exercise_id);
```

| カラム名              | 型            | 制約                      | 説明                           |
|--------------------|---------------|---------------------------|--------------------------------|
| id                 | SERIAL        | PK                        | 自動採番                        |
| session_exercise_id| INTEGER       | FK(session_exercises), NOT NULL | 種目参照                  |
| set_number         | SMALLINT      | NOT NULL                  | セット番号（1始まり）             |
| weight_kg          | NUMERIC(6,2)  |                           | 重量 (kg)、自重はNULL            |
| reps               | SMALLINT      |                           | 実施回数                         |
| rpe                | NUMERIC(3,1)  |                           | 主観的強度 (1.0〜10.0)           |
| duration_sec       | INTEGER       |                           | 継続時間（有酸素種目用）           |
| is_warmup          | BOOLEAN       | NOT NULL, DEFAULT FALSE   | ウォームアップセットフラグ         |
| ai_counted_reps    | SMALLINT      |                           | MediaPipe AI カウント回数        |
| completed_at       | TIMESTAMPTZ   |                           | セット完了日時                    |
| created_at         | TIMESTAMPTZ   | NOT NULL                  | 作成日時                         |

---

### 2.8 pose_records — MediaPipe ポーズデータ

AI回数カウント時のフレームごとの関節角度データ。

```sql
CREATE TABLE pose_records (
    id                  SERIAL          PRIMARY KEY,
    session_set_id      INTEGER         NOT NULL REFERENCES session_sets(id) ON DELETE CASCADE,
    recorded_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    landmarks_json      JSONB           NOT NULL,   -- MediaPipe 33ランドマークの座標
    joint_angles_json   JSONB,                      -- 計算済み関節角度 (elbow_left, knee_right etc.)
    rep_count_snapshot  SMALLINT,                   -- このフレーム時点の累積カウント
    frame_index         INTEGER         NOT NULL    -- 動画フレーム番号
);

-- インデックス
CREATE INDEX idx_pose_records_session_set_id ON pose_records(session_set_id);
CREATE INDEX idx_pose_records_recorded_at    ON pose_records(recorded_at);
-- JSONBの検索用GINインデックス（必要に応じて追加）
-- CREATE INDEX idx_pose_records_landmarks_gin ON pose_records USING gin(landmarks_json);
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

### 2.9 ai_reviews — Claude API フォームレビュー

Claude API によるフォーム分析結果。セッション内の種目単位で生成される。

```sql
CREATE TABLE ai_reviews (
    id                  SERIAL          PRIMARY KEY,
    session_exercise_id INTEGER         NOT NULL UNIQUE REFERENCES session_exercises(id) ON DELETE CASCADE,
    model_version       VARCHAR(50)     NOT NULL DEFAULT 'claude-sonnet-4-5', -- 使用したClaudeモデル
    prompt_tokens       INTEGER,
    completion_tokens   INTEGER,
    overall_score       SMALLINT,                   -- フォームスコア 0〜100
    feedback_text       TEXT            NOT NULL,   -- AIからのフィードバック全文
    strengths_json      JSONB,                      -- 良かった点リスト
    improvements_json   JSONB,                      -- 改善点リスト
    injury_risk_level   VARCHAR(10),                -- 'low' | 'medium' | 'high'
    generated_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE UNIQUE INDEX uq_ai_reviews_session_exercise_id ON ai_reviews(session_exercise_id);
CREATE INDEX idx_ai_reviews_generated_at ON ai_reviews(generated_at);
```

| カラム名              | 型           | 制約                       | 説明                               |
|--------------------|--------------|----------------------------|------------------------------------|
| id                 | SERIAL       | PK                         | 自動採番                            |
| session_exercise_id| INTEGER      | FK(session_exercises), UNIQUE | 種目参照（1種目に1レビュー）        |
| model_version      | VARCHAR(50)  | NOT NULL                   | 使用したClaudeモデルID              |
| prompt_tokens      | INTEGER      |                            | プロンプトトークン数（コスト管理用）  |
| completion_tokens  | INTEGER      |                            | 補完トークン数（コスト管理用）        |
| overall_score      | SMALLINT     |                            | フォームスコア (0〜100)              |
| feedback_text      | TEXT         | NOT NULL                   | AIフィードバック本文                 |
| strengths_json     | JSONB        |                            | 良かった点リスト                     |
| improvements_json  | JSONB        |                            | 改善点リスト                         |
| injury_risk_level  | VARCHAR(10)  |                            | 怪我リスクレベル                     |
| generated_at       | TIMESTAMPTZ  | NOT NULL                   | 生成日時                             |

---

### 2.10 programs — プログラムマスター

BIG3強化・ボディウェイト等のトレーニングプログラム定義。

```sql
CREATE TABLE programs (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL UNIQUE,
    description     TEXT,
    category        VARCHAR(50),                    -- 'strength' | 'hypertrophy' | 'bodyweight' | 'cardio'
    difficulty      VARCHAR(20),                    -- 'beginner' | 'intermediate' | 'advanced'
    duration_weeks  SMALLINT,                       -- プログラム期間 (週)
    frequency_per_week SMALLINT,                    -- 週の実施頻度
    thumbnail_url   VARCHAR(500),
    is_public       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_by      INTEGER         REFERENCES users(id) ON DELETE SET NULL,  -- NULLは公式プログラム
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE UNIQUE INDEX uq_programs_name ON programs(name);
CREATE INDEX idx_programs_category   ON programs(category);
CREATE INDEX idx_programs_difficulty ON programs(difficulty);
```

| カラム名              | 型            | 制約                   | 説明                              |
|--------------------|---------------|------------------------|-----------------------------------|
| id                 | SERIAL        | PK                     | 自動採番                           |
| name               | VARCHAR(100)  | NOT NULL, UNIQUE       | プログラム名                        |
| description        | TEXT          |                        | 説明文                             |
| category           | VARCHAR(50)   |                        | カテゴリ                            |
| difficulty         | VARCHAR(20)   |                        | 難易度                             |
| duration_weeks     | SMALLINT      |                        | プログラム期間 (週)                  |
| frequency_per_week | SMALLINT      |                        | 週実施頻度                          |
| thumbnail_url      | VARCHAR(500)  |                        | サムネイルURL                       |
| is_public          | BOOLEAN       | NOT NULL, DEFAULT TRUE | 公開フラグ                          |
| created_by         | INTEGER       | FK(users), NULL可      | 作成者 (NULLは公式)                 |
| created_at         | TIMESTAMPTZ   | NOT NULL               | 作成日時                            |
| updated_at         | TIMESTAMPTZ   | NOT NULL               | 更新日時                            |

---

### 2.11 program_exercises — プログラム内の種目

プログラムに含まれる種目の定義（テンプレート）。

```sql
CREATE TABLE program_exercises (
    id              SERIAL      PRIMARY KEY,
    program_id      INTEGER     NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    exercise_id     INTEGER     NOT NULL REFERENCES exercises(id),
    week_number     SMALLINT    NOT NULL,        -- 何週目か
    day_number      SMALLINT    NOT NULL,        -- 何日目（曜日）か
    order_index     SMALLINT    NOT NULL DEFAULT 0,
    sets            SMALLINT    NOT NULL,
    reps_min        SMALLINT,
    reps_max        SMALLINT,
    rest_interval_sec INTEGER,
    note            TEXT
);

-- インデックス
CREATE INDEX idx_program_exercises_program_id  ON program_exercises(program_id);
CREATE INDEX idx_program_exercises_week_day    ON program_exercises(program_id, week_number, day_number);
```

| カラム名            | 型        | 制約                       | 説明                        |
|-------------------|-----------|----------------------------|-----------------------------|
| id                | SERIAL    | PK                         | 自動採番                     |
| program_id        | INTEGER   | FK(programs), NOT NULL     | プログラム参照               |
| exercise_id       | INTEGER   | FK(exercises), NOT NULL    | 種目参照                     |
| week_number       | SMALLINT  | NOT NULL                   | 実施週番号                    |
| day_number        | SMALLINT  | NOT NULL                   | 実施日番号（1〜7）             |
| order_index       | SMALLINT  | NOT NULL, DEFAULT 0        | 日内の実施順                  |
| sets              | SMALLINT  | NOT NULL                   | セット数                      |
| reps_min          | SMALLINT  |                            | 最小レップ数                  |
| reps_max          | SMALLINT  |                            | 最大レップ数                  |
| rest_interval_sec | INTEGER   |                            | インターバル (秒)              |
| note              | TEXT      |                            | 備考                          |

---

### 2.12 user_programs — ユーザーのプログラム参加状態

ユーザーがどのプログラムに参加しているかを管理する。

```sql
CREATE TABLE user_programs (
    id              SERIAL          PRIMARY KEY,
    user_id         INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_id      INTEGER         NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    status          VARCHAR(20)     NOT NULL DEFAULT 'active', -- 'active' | 'paused' | 'completed' | 'dropped'
    current_week    SMALLINT        NOT NULL DEFAULT 1,
    current_day     SMALLINT        NOT NULL DEFAULT 1,
    started_at      DATE            NOT NULL DEFAULT CURRENT_DATE,
    completed_at    DATE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, program_id)
);

-- インデックス
CREATE INDEX idx_user_programs_user_id    ON user_programs(user_id);
CREATE INDEX idx_user_programs_program_id ON user_programs(program_id);
CREATE UNIQUE INDEX uq_user_programs_user_program ON user_programs(user_id, program_id);
```

| カラム名       | 型           | 制約                         | 説明                              |
|--------------|--------------|------------------------------|-----------------------------------|
| id           | SERIAL       | PK                           | 自動採番                           |
| user_id      | INTEGER      | FK(users), NOT NULL          | ユーザー参照                        |
| program_id   | INTEGER      | FK(programs), NOT NULL       | プログラム参照                      |
| status       | VARCHAR(20)  | NOT NULL, DEFAULT 'active'   | 参加状態                            |
| current_week | SMALLINT     | NOT NULL, DEFAULT 1          | 現在の週番号                        |
| current_day  | SMALLINT     | NOT NULL, DEFAULT 1          | 現在の日番号                        |
| started_at   | DATE         | NOT NULL                     | 開始日                             |
| completed_at | DATE         |                              | 完了日                             |
| created_at   | TIMESTAMPTZ  | NOT NULL                     | 作成日時                            |
| updated_at   | TIMESTAMPTZ  | NOT NULL                     | 更新日時                            |

---

### 2.13 posts — コミュニティー投稿

フィード・Q&Aを含む汎用投稿テーブル。

```sql
CREATE TABLE posts (
    id              SERIAL          PRIMARY KEY,
    user_id         INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_type       VARCHAR(20)     NOT NULL DEFAULT 'feed', -- 'feed' | 'qa'
    title           VARCHAR(200),                   -- Q&Aの場合は質問タイトル
    body            TEXT            NOT NULL,
    image_urls      JSONB,                          -- 画像URL配列 (最大5枚)
    workout_session_id INTEGER      REFERENCES workout_sessions(id) ON DELETE SET NULL, -- ワークアウト結果の紐付け
    is_pinned       BOOLEAN         NOT NULL DEFAULT FALSE,
    likes_count     INTEGER         NOT NULL DEFAULT 0,   -- 非正規化キャッシュ
    comments_count  INTEGER         NOT NULL DEFAULT 0,   -- 非正規化キャッシュ
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_posts_user_id    ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_post_type  ON posts(post_type, created_at DESC);
```

| カラム名              | 型            | 制約                      | 説明                              |
|--------------------|---------------|---------------------------|-----------------------------------|
| id                 | SERIAL        | PK                        | 自動採番                           |
| user_id            | INTEGER       | FK(users), NOT NULL       | 投稿者参照                          |
| post_type          | VARCHAR(20)   | NOT NULL, DEFAULT 'feed'  | 投稿種別 (feed / qa)               |
| title              | VARCHAR(200)  |                           | タイトル（Q&A用）                   |
| body               | TEXT          | NOT NULL                  | 本文                               |
| image_urls         | JSONB         |                           | 添付画像URLリスト                   |
| workout_session_id | INTEGER       | FK(workout_sessions)      | 紐づけたワークアウトセッション       |
| is_pinned          | BOOLEAN       | NOT NULL                  | ピン留めフラグ                       |
| likes_count        | INTEGER       | NOT NULL, DEFAULT 0       | いいね数（非正規化）                 |
| comments_count     | INTEGER       | NOT NULL, DEFAULT 0       | コメント数（非正規化）               |
| created_at         | TIMESTAMPTZ   | NOT NULL                  | 作成日時                            |
| updated_at         | TIMESTAMPTZ   | NOT NULL                  | 更新日時                            |

---

### 2.14 post_likes — いいね

```sql
CREATE TABLE post_likes (
    id          SERIAL          PRIMARY KEY,
    post_id     INTEGER         NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- インデックス
CREATE UNIQUE INDEX uq_post_likes_post_user ON post_likes(post_id, user_id);
CREATE INDEX idx_post_likes_user_id ON post_likes(user_id);
```

| カラム名   | 型          | 制約                         | 説明            |
|----------|-------------|------------------------------|-----------------|
| id       | SERIAL      | PK                           | 自動採番         |
| post_id  | INTEGER     | FK(posts), NOT NULL          | 投稿参照         |
| user_id  | INTEGER     | FK(users), NOT NULL          | ユーザー参照     |
| created_at| TIMESTAMPTZ| NOT NULL                    | いいね日時       |
| -        | -           | UNIQUE(post_id, user_id)    | 重複いいね防止   |

---

### 2.15 post_comments — コメント

自己参照による返信（ネスト）に対応。

```sql
CREATE TABLE post_comments (
    id              SERIAL          PRIMARY KEY,
    post_id         INTEGER         NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id         INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id       INTEGER         REFERENCES post_comments(id) ON DELETE CASCADE, -- 返信の場合
    body            TEXT            NOT NULL,
    likes_count     INTEGER         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_post_comments_post_id   ON post_comments(post_id);
CREATE INDEX idx_post_comments_user_id   ON post_comments(user_id);
CREATE INDEX idx_post_comments_parent_id ON post_comments(parent_id);
```

| カラム名    | 型          | 制約                    | 説明                    |
|-----------|-------------|-------------------------|-------------------------|
| id        | SERIAL      | PK                      | 自動採番                 |
| post_id   | INTEGER     | FK(posts), NOT NULL     | 投稿参照                 |
| user_id   | INTEGER     | FK(users), NOT NULL     | コメント者参照            |
| parent_id | INTEGER     | FK(post_comments), NULL | 返信元コメント（NULL=最上位）|
| body      | TEXT        | NOT NULL                | コメント本文              |
| likes_count| INTEGER    | NOT NULL, DEFAULT 0     | いいね数（非正規化）       |
| created_at| TIMESTAMPTZ | NOT NULL                | 作成日時                 |
| updated_at| TIMESTAMPTZ | NOT NULL                | 更新日時                 |

---

### 2.16 follows — フォロー関係

ユーザー間のフォロー。自己フォロー禁止は CHECK 制約で担保。

```sql
CREATE TABLE follows (
    id              SERIAL          PRIMARY KEY,
    follower_id     INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id     INTEGER         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE(follower_id, followee_id),
    CHECK(follower_id <> followee_id)
);

-- インデックス
CREATE UNIQUE INDEX uq_follows_pair        ON follows(follower_id, followee_id);
CREATE INDEX idx_follows_follower_id       ON follows(follower_id);  -- 「フォロー中」取得
CREATE INDEX idx_follows_followee_id       ON follows(followee_id);  -- 「フォロワー」取得
```

| カラム名     | 型          | 制約                            | 説明                |
|-----------|-------------|----------------------------------|---------------------|
| id        | SERIAL      | PK                               | 自動採番             |
| follower_id| INTEGER    | FK(users), NOT NULL              | フォローする側        |
| followee_id| INTEGER    | FK(users), NOT NULL              | フォローされる側      |
| created_at| TIMESTAMPTZ | NOT NULL                         | フォロー日時          |
| -         | -           | UNIQUE(follower_id, followee_id) | 重複フォロー防止      |
| -         | -           | CHECK(follower_id <> followee_id)| 自己フォロー禁止      |

---

## 3. インデックス設計方針

### 3.1 基本方針

| 優先度 | 対象                              | 理由                                       |
|-------|-----------------------------------|--------------------------------------------|
| 高    | 全テーブルの PK                    | 自動生成されるクラスタードインデックス        |
| 高    | 全 FK カラム                       | JOIN・外部キー検索の高速化                   |
| 高    | UNIQUE 制約カラム                  | 一意性検証 + 検索高速化                      |
| 中    | `created_at DESC` 系              | フィード・履歴の時系列ソート高速化            |
| 中    | `user_id + 時系列` 複合インデックス | ユーザー別データ取得の高速化                  |
| 低    | JSONB カラム (GIN)                 | ポーズデータの属性検索が必要になった時に追加  |

### 3.2 クエリ別インデックス設計

```
-- ユーザーのワークアウト履歴（日/月/年別）
INDEX: workout_sessions(user_id, started_at DESC)

-- フィード（フォロー中ユーザーの投稿）
INDEX: follows(follower_id)  →  posts(user_id, created_at DESC)

-- 種目別の記録推移（最大重量・ボリュームの成長）
INDEX: session_exercises(exercise_id)  →  session_sets(session_exercise_id)

-- フォロワー数・フォロー数の集計
INDEX: follows(followee_id), follows(follower_id)
```

### 3.3 非正規化キャッシュの方針

パフォーマンス上の理由から以下カラムにカウントを非正規化して保持する。
更新はアプリケーション層（またはDBトリガー）で行う。

| テーブル    | カラム           | 更新タイミング          |
|-----------|-----------------|----------------------|
| posts     | likes_count     | post_likes INSERT/DELETE 時 |
| posts     | comments_count  | post_comments INSERT/DELETE 時 |

---

## 4. SQLAlchemy Model 命名規則と方針

### 4.1 ファイル構成

```
backend-core/
└── app/
    ├── models/
    │   ├── __init__.py       # 全Modelをエクスポート
    │   ├── base.py           # DeclarativeBase + TimestampMixin
    │   ├── user.py           # User, UserProfile
    │   ├── body.py           # BodyGoal
    │   ├── exercise.py       # Exercise
    │   ├── workout.py        # WorkoutSession, SessionExercise, SessionSet
    │   ├── pose.py           # PoseRecord
    │   ├── ai_review.py      # AiReview
    │   ├── program.py        # Program, ProgramExercise, UserProgram
    │   └── community.py      # Post, PostLike, PostComment, Follow
    └── database.py           # Engineとセッション設定
```

### 4.2 命名規則

| 対象             | 規則                            | 例                          |
|-----------------|----------------------------------|-----------------------------|
| クラス名         | PascalCase・単数形               | `WorkoutSession`, `PostLike` |
| テーブル名       | snake_case・複数形               | `workout_sessions`          |
| カラム名         | snake_case                      | `started_at`, `user_id`     |
| リレーション属性  | snake_case・意味のある名前        | `session.exercises`, `post.author` |
| バックリファレンス| `back_populates` を使用（`backref`は避ける）| |

### 4.3 共通ベースクラス

```python
# app/models/base.py
from datetime import datetime, timezone
from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    """created_at / updated_at を自動付与するMixin"""
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

### 4.4 Mapped アノテーション方針

SQLAlchemy 2.0 の `Mapped[T]` 型ヒントを使用し、`Optional` で nullable を表現する。

```python
# 良い例 (SQLAlchemy 2.0 スタイル)
class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # リレーション
    profile: Mapped["UserProfile"] = relationship(back_populates="user", uselist=False)
    sessions: Mapped[list["WorkoutSession"]] = relationship(back_populates="user")
```

---

## 5. Alembic マイグレーション方針

### 5.1 初期セットアップ

```bash
# プロジェクトルート (backend-core/) で実行
alembic init alembic

# alembic/env.py を編集:
# - target_metadata = Base.metadata を設定
# - DATABASE_URL を環境変数から読み込む
```

### 5.2 env.py 設定例

```python
# alembic/env.py (抜粋)
import os
from app.models.base import Base
from app.models import *  # 全Modelをインポートしてautogenerateに認識させる

config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
target_metadata = Base.metadata
```

### 5.3 マイグレーション運用ルール

| コマンド                                    | 用途                          |
|--------------------------------------------|-------------------------------|
| `alembic revision --autogenerate -m "説明"` | Modelの変更からマイグレーション自動生成 |
| `alembic upgrade head`                      | 最新版に適用                   |
| `alembic downgrade -1`                      | 1つ前に戻す                    |
| `alembic history`                           | マイグレーション履歴の確認       |
| `alembic current`                           | 現在の適用バージョン確認         |

### 5.4 命名規則

マイグレーションファイルのメッセージ（`-m` オプション）は以下のフォーマットを使用する。

```
<動詞>_<テーブル名>_<内容>

例:
  create_users_table
  add_body_fat_pct_to_user_profiles
  create_community_tables
  add_index_workout_sessions_user_started
```

### 5.5 注意事項

- **autogenerate は万能ではない**: CHECK 制約・一部のインデックス種別（GIN等）は手動で記述する
- **本番環境への適用前**: `alembic upgrade head --sql` でSQLを事前確認すること
- **ロールバック設計**: 全マイグレーションに `downgrade()` を必ず実装する
- **チーム開発**: マイグレーションファイルは必ずコミットしてバージョン管理する
- **データ移行**: スキーマ変更とデータ移行は別のマイグレーションファイルに分割する

---

## テーブル間リレーション一覧

```
users              1──1   user_profiles
users              1──N   body_goals
users              1──N   workout_sessions
users              1──N   user_programs
users              1──N   posts
users              1──N   post_comments
users              N──N   users            (follows テーブル経由)
workout_sessions   1──N   session_exercises
exercises          1──N   session_exercises
exercises          1──N   program_exercises
session_exercises  1──N   session_sets
session_sets       1──N   pose_records
session_exercises  1──1   ai_reviews
programs           1──N   program_exercises
programs           N──N   users            (user_programs テーブル経由)
posts              1──N   post_likes
posts              1──N   post_comments
post_comments      1──N   post_comments    (self-referential: 返信)
```
