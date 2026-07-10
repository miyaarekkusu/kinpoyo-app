# AGENTS.md — kinpoyo プロジェクト

> このファイルはAIエージェント（Claude Code など）向けのプロジェクトガイドです。
> **作業を開始する前に必ずこのファイルを最初に読むこと。**
> **変更を加えるたびに必ずこのファイルを更新・確認してください。**

---

## ⚠️ Expo 重要注意事項

> **Expo HAS CHANGED**
> フロントエンドのコードを書く前に、必ず以下の公式ドキュメントを確認すること：
> https://docs.expo.dev/versions/v54.0.0/

---

## ⚠️ AI処理テーブル — 絶対に触れないこと

> **以下の2テーブルは別担当者がAI設計を進めており、現在は仮実装の状態です。**
> **コード・マイグレーション・シードデータ、いかなる変更も禁止します。**
> **誤ってデータを投入したり構造を変更すると、統合時に深刻な競合が発生します。**

| テーブル | ファイル | 禁止理由 |
|---------|---------|---------|
| `pose_records` | `app/models/workout.py` | MediaPipe AI処理担当者が設計中 |
| `ai_reviews` | `app/models/workout.py` | Claude API連携担当者が設計中 |

**禁止事項（厳守）:**
- モデルクラスの編集禁止
- マイグレーションでのカラム追加・削除・変更禁止
- シードスクリプトでのデータ投入禁止
- これらのテーブルへの INSERT / UPDATE / DELETE 禁止

統合時は必ず担当者と確認・合意の上で作業すること。

---

## AIエージェントへの厳守事項

> **⚠️ 以下のルールは全作業において最優先で守ること**

1. **作業開始前に必ずこのファイル（AGENTS.md）を読むこと**
2. **正常に動作しているファイルは、指示がない限り絶対に勝手に修正しないこと**
   - 関係のないファイルへの変更・リファクタリング・整形は禁止
   - 依頼されたタスクのスコープ外のファイルには触れないこと
3. **変更後に必ずこのファイルを更新すること**（新しいルーター・モデル・コンポーネントの追加など）
4. 新しいAPIエンドポイントを追加したら「API一覧」セクションを更新する
5. 新しい依存パッケージを追加したら「依存パッケージ」セクションを更新する
6. コミット前に型チェック・リントを実行する

---

## プロジェクト概要

| 項目               | 内容                    |
| ------------------ | ----------------------- |
| プロジェクト名     | kinpoyo（きんぽよ）     |
| フロントエンド     | React Native (Expo)     |
| バックエンド       | FastAPI (Python 3.14)   |
| AIポーズ検出       | MediaPipe               |
| AIレビュー         | Claude API              |
| ルートディレクトリ | `C:\HAL名古屋\kinpoyo\` |

### アプリ説明

**kinpoyo** は、AIの技術を活用した筋トレ成長支援・筋トレ管理アプリ。

筋トレ中の主な課題：

- 筋トレに集中しているため、回数カウントを忘れてしまう
- 筋トレフォームが正しいかどうかわからない

**解決策：**
スマホのフロントカメラで自分のフォームを撮影し、事前登録された正しいフォームデータと比較しながら、アプリがRep数を自動カウントする。AIトレーナーがフォームのレビューとアドバイスを提供し、毎日の筋トレ実績を日・月・年別の成長レポートとして自動記録する。

### 機能フロー

1. 事前にトレーニング種目・Rep数・インターバル・重量を登録
2. 開始ボタンを押すと、フロントカメラが自動起動
3. MediaPipeのポーズ検出でAIが回数を自動カウント
4. 本人のポーズの関節角度データが記録される
5. 登録Rep数に達したらセッション終了
6. 事前登録の正しいフォームデータと本人フォームデータを比較し、誤差データを算出
7. 比較データをもとにClaude APIがトレーナーレビュー・アドバイスを生成
8. 実績データを記録し、成長レポートを自動作成

---

## 機能一覧

### 認証・ユーザー管理

- ログイン
- 会員登録（アカウント作成）
- プロフィール
- 設定

### 筋トレ目標設定

- 体重・体脂肪率の目標設定（任意）

### 筋トレメニュー管理

- 分割法選択
- 種目カテゴリーフィルター
- 種目検索
- 筋トレ種目一覧
- 筋トレメニュー作成（インターバル・Reps・重量）
- 筋トレメニュー編集
- おすすめ種目メニュー推奨

### 筋トレ計測

- 計測開始（フロントカメラのみで開始）
- AI回数カウント（MediaPipeポーズ検出）

### 筋トレ記録・結果

- AIトレーナーレビュー（フォーム改善点・アドバイス・トレーニング評価）
- 日・月・年・レポート別の成長実績表示

### 記録・ソーシャル

- 記録分析
- 記録閲覧（自分・他のユーザー）
- フォロー機能
- いいね機能

### コミュニティー

- フィード（トレーニング投稿一覧）
- フォロー中フィード
- Q&A
- お知らせ
- 投稿（FABボタンで記録をシェア）
- コメント・いいね

### モーダル機能

- 追加の広報
- 検索

---

## ディレクトリ構成

```
kinpoyo/
├── AGENTS.md              # このファイル（必ず更新すること）
├── frontend/              # React Native (Expo) フロントエンド ← Expoアプリのルート
│   ├── app/
│   │   ├── _layout.tsx               # ルートレイアウト（Stack ナビゲーション・起動アンカー: (auth)）
│   │   ├── (auth)/                   # 認証フローグループ（アプリ起動時の最初の画面）
│   │   │   ├── _layout.tsx          # 認証用 Stack（headerShown: false）
│   │   │   ├── login.tsx            # ログイン ✅  (route: /login)
│   │   │   ├── signup.tsx           # 新規登録 ✅  (route: /signup)
│   │   │   ├── forgot-password.tsx  # パスワードを忘れた（メール入力） ✅  (route: /forgot-password)
│   │   │   ├── verify-code.tsx      # 確認コード入力（5桁） ✅  (route: /verify-code)
│   │   │   ├── reset-complete.tsx   # パスワードリセット完了 ✅  (route: /reset-complete)
│   │   │   ├── new-password.tsx     # パスワード変更フォーム ✅  (route: /new-password)
│   │   │   └── success.tsx          # 完了アニメーション画面 ✅  (route: /success)
│   │   ├── (onboarding)/             # 初回ログイン後のプロフィール設定フロー
│   │   │   ├── _layout.tsx          # オンボーディング用 Stack（headerShown: false、anchor: gender）
│   │   │   ├── gender.tsx           # 性別選択 ✅  (route: /gender)
│   │   │   ├── height.tsx           # 身長設定（上下スクロールピッカー） ✅  (route: /height)
│   │   │   ├── weight.tsx           # 体重設定（左右スクロールピッカー） ✅  (route: /weight)
│   │   │   ├── weight-goal.tsx      # 目標体重設定（左右スクロールピッカー） ✅  (route: /weight-goal)
│   │   │   ├── year.tsx             # 生まれ年設定（上下スクロールピッカー） ✅  (route: /year)
│   │   │   └── train-goal.tsx       # 筋トレ目標選択（→ ログイン完了） ✅  (route: /train-goal)
│   │   │       ├── big3.tsx            # BIG3強化プログラム詳細 ✅  (route: /program/big3)
│   │   │       ├── bodyweight.tsx      # ボディウェイト詳細 ✅  (route: /program/bodyweight)
│   │   │       ├── hypertrophy.tsx     # 筋肥大とは ✅  (route: /program/hypertrophy)
│   │   │       ├── program-design.tsx  # プログラム組み方 ✅  (route: /program/program-design)
│   │   │       └── rpe.tsx             # RPEとは ✅  (route: /program/rpe)
│   │   │       └── custom_program.tsx  # カスタムプログラム画面 ✅
│   │   │       └── even_program.tsx  # プログラム画面 ✅
│   │   │       └── program_choice.tsx #重量設定画面
│   │   └── (tabs)/                   # タブナビゲーショングループ
│   │       ├── _layout.tsx           # タブナビゲーション（5タブ）
│   │       ├── index.tsx             # ホーム画面 ✅
│   │       ├── community.tsx         # コミュニティー ✅
│   │       ├── workout.tsx           # 筋トレ開始（準備中）
│   │       ├── records.tsx           # 記録 ✅
│   │       └── profile.tsx           # プロフィール ✅
│   ├── components/    # 共通コンポーネント
│   ├── constants/     # デザイントークン（theme.ts）
│   ├── styles/        # CSSテンプレート
│   ├── package.json
│   └── ...
└── backend-core/          # FastAPI バックエンド
    ├── main.py            # エントリーポイント
    ├── requirements.txt   # 依存パッケージ一覧
    ├── DATABASE.md        # DB設計書（テーブル定義・ER図・設計方針）
    ├── scripts/
    │   └── seed_masters.py    # マスターデータ投入スクリプト
    └── app/
        ├── database.py        # Engine・セッション設定
        ├── models/
        │   ├── __init__.py    # 全Modelをまとめてエクスポート
        │   ├── base.py        # DeclarativeBase・TimestampMixin
        │   ├── master.py      # マスター11テーブル
        │   ├── user.py        # User・UserProfile
        │   ├── body.py        # BodyGoal
        │   ├── exercise.py    # Exercise・ExerciseSecondaryMuscle
        │   ├── workout.py     # WorkoutSession・SessionExercise・SessionSet
        │   ├── program.py     # Program・ProgramExercise・UserProgram
        │   └── community.py   # Post・PostLike・PostComment・Follow
        ├── schemas/           # Pydantic スキーマ（リクエスト・レスポンス定義）
        │   ├── master.py
        │   ├── user.py
        │   ├── workout.py
        │   ├── program.py
        │   └── community.py
        ├── routers/           # APIルーター（エンドポイント定義）
        │   ├── auth.py
        │   ├── users.py
        │   ├── exercises.py
        │   ├── workouts.py
        │   ├── records.py
        │   ├── programs.py
        │   ├── community.py
        │   └── masters.py
        ├── crud/              # DB操作ロジック
        │   ├── user.py
        │   ├── workout.py
        │   ├── program.py
        │   └── community.py
        └── core/
            ├── config.py      # 環境変数管理（DATABASE_URL等）
            ├── security.py    # JWT・パスワードハッシュ（python-jose/passlib）
            └── deps.py        # 依存性注入（get_db, get_current_user）
```

> **Expo Router ルートグループについて**
> `(screens)` と `(tabs)` はどちらもルートグループ（括弧で囲んだフォルダー）。
> URLパスには影響しない（例: `(screens)/calendar.tsx` → `/calendar`）。
> ファイル整理のためだけに使用している。

---

## 画面一覧・実装状況

| 画面                   | ファイル                           | 状態                  | 備考                                                                                                                                                                                      |
| ---------------------- | ---------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ログイン               | `(auth)/login.tsx`                 | ✅ 実装済み（モック） | メール/パスワード入力・パスワード表示切替・パスワードを忘れたリンク・Apple/Googleログインボタン・新規登録リンク（→ /signup）・アプリ起動時の最初の画面                                    |
| 新規登録               | `(auth)/signup.tsx`                | ✅ 実装済み（モック） | ニックネーム/メール/パスワード入力・パスワード表示切替・Apple/Googleログインボタン・ログインリンク（→ /login）                                                                            |
| パスワードを忘れた     | `(auth)/forgot-password.tsx`       | ✅ 実装済み（モック） | メールアドレス入力→Reset Password（入力で活性化）                                                                                                                                         |
| 確認コード入力         | `(auth)/verify-code.tsx`           | ✅ 実装済み（モック） | 5桁コード入力ボックス（自動フォーカス送り）・Resend email                                                                                                                                 |
| パスワードリセット完了 | `(auth)/reset-complete.tsx`        | ✅ 実装済み（モック） | 完了メッセージ・Confirmボタン                                                                                                                                                             |
| パスワード変更         | `(auth)/new-password.tsx`          | ✅ 実装済み（モック） | 新パスワード・確認パスワード入力（表示切替付き）・決定ボタン                                                                                                                              |
| 完了アニメーション     | `(auth)/success.tsx`               | ✅ 実装済み（モック） | チェックマークのスケール+フェードアニメーション（reanimated）→自動でログインへ遷移                                                                                                        |
| ホーム                 | `(tabs)/index.tsx`                 | ✅ 実装済み           | ヒーローバナー・スクロール週カレンダー・統計グリッド・体重・プログラムカード（→遷移接続済）                                                                                               |
| カレンダー             | `(screens)/calendar.tsx`           | ✅ 実装済み           | 月表示・色フィルターモーダル・筋トレ登録（→workout-register）・修正ボタン・筋トレ一覧                                                                                                     |
| 筋トレ登録             | `(screens)/workout-register.tsx`   | ✅ 実装済み           | 種目追加モーダル（pageSheet表示、Push/Pull/Leg・部位別フィルター、24種目）・セット数/レップ数/重量(kg) 3カラムテーブル・×でキャンセル                                                                    |
| プログラム一覧         | `(screens)/program/index.tsx`      | ✅ 実装済み           | BIG3強化・ボディウェイトの2プログラムカード                                                                                                                                               |
| BIG3プログラム詳細     | `(screens)/program/big3.tsx`       | ✅ 実装済み           | ヒーロー・概要グリッド・週スケジュール・3種目・開始ボタン                                                                                                                                 |
| ボディウェイト詳細     | `(screens)/program/bodyweight.tsx` | ✅ 実装済み           | ヒーロー・概要グリッド・週スケジュール・6種目・開始ボタン                                                                                                                                 |
| 筋肥大とは             | `(screens)/program/hypertrophy.tsx` | ✅ 実装済み          | ホーム「トレーニング知識」カードから遷移。筋肥大の三大原則（トレーニング・栄養・休養）の解説                                                                                              |
| プログラム組み方       | `(screens)/program/program-design.tsx` | ✅ 実装済み       | ホーム「トレーニング知識」カードから遷移。分割法・適切なボリューム設定の解説                                                                                                              |
| RPEとは                | `(screens)/program/rpe.tsx`        | ✅ 実装済み           | ホーム「トレーニング知識」カードから遷移。自覚的運動強度（RPE）を用いた強度管理の解説                                                                                                     |
| コミュニティー         | `(tabs)/community.tsx`             | ✅ 実装済み           | 4タブ(フォロー中・フィード・Q&A・お知らせ)・フォロー中空状態・ユーザーID検索モーダル（My ID CardにQRコード表示ボタン追加、モーダル内で検索画面⇄マイQRコード画面を切替表示）・ヘッダー右上のアバターから/profileへ遷移・投稿カード一覧（自分の投稿は文字表記「編集」「削除」ボタン表示）・投稿詳細モーダル(画像・いいね・コメント送信・自分の投稿は文字表記「編集」「削除」ボタン表示)・FABボタン（投稿作成・編集モーダル：フィード/Q&A選択・タイトル/本文入力・画像添付（expo-image-picker、最大5枚）） |
| 筋トレ開始             | `(tabs)/workout.tsx`               | ✅ 実装済み           | 今日の登録メニュー一覧・種目数/セット数サマリー・開始ボタン（登録あり時のみ）・未登録時はカレンダーへ誘導                                                                                 |
| 記録                   | `(tabs)/records.tsx`               | ✅ 実装済み           | 週/月/年グラフ（折れ線・react-native-gifted-charts）・AIトレーナーカード（モック・TrainerAvatar+期間別コメント）・種目別最大重量・筋トレ履歴（期間+部位絞り込み・モーダル展開）        |
| プロフィール           | `(tabs)/profile.tsx`               | ✅ 実装済み           | ユーザーカード・実績4グリッド・BIG3(1RM)・身体情報                                                                                                                                        |
| 性別選択               | `(onboarding)/gender.tsx`          | ✅ 実装済み（モック） | 男性/女性カード選択・「その他／回答しない」ピル・選択時のみ次へ活性化（人物画像なし）                                                                                                     |
| 身長設定               | `(onboarding)/height.tsx`          | ✅ 実装済み（モック） | cm/ft単位切替・上下スクロールの定規ピッカー（スナップ）・中央インジケーター・大きい数値表示                                                                                              |
| 体重設定               | `(onboarding)/weight.tsx`          | ✅ 実装済み（モック） | kg/lbs単位切替・左右スクロールの定規ピッカー（スナップ）・BMIカード（TrainerAvatar+コメント）                                                                                             |
| 目標体重設定           | `(onboarding)/weight-goal.tsx`     | ✅ 実装済み（モック） | 左右スクロールの定規ピッカー・現在値→目標値の帯表示・減量/増量/維持メッセージカード（TrainerAvatar）                                                                                      |
| 生まれ年設定           | `(onboarding)/year.tsx`            | ✅ 実装済み（モック） | 上下スクロールのホイールピッカー（スナップ）・選択中の年をハイライト表示                                                                                                                  |
| 筋トレ目標選択         | `(onboarding)/train-goal.tsx`      | ✅ 実装済み（モック） | 「痩せたい/筋肉を増やしたい/体型を維持したい」カード選択（画像なし）・「はじめる」ボタンでログイン状態に遷移し (tabs) へ                                                                  |

### 認証フロー（(auth) グループ・実装済み）

- **アプリ起動時の最初の画面**: `unstable_settings.anchor` を `(auth)` に設定し、`login.tsx` から開始する
- ログイン・新規登録は別ルート（`/login` ⇄ `/signup`）。画面下部のリンクで相互に遷移
- フロー: login → (パスワードを忘れた) → forgot-password → verify-code → reset-complete → new-password → success → login（自動遷移）
- ログイン/新規登録のボタン押下で `(onboarding)` グループの `gender` 画面へ遷移（モック動作。実際の認証処理は未実装）
- success.tsx はチェックマークのポップインアニメーション（react-native-reanimated）後、自動的にログイン画面へ戻る
- icon-symbol.tsx に認証画面用アイコンを追加: `eye` / `eye.slash`（パスワード表示切替）/ `envelope` / `checkmark`

### オンボーディングフロー（(onboarding) グループ・実装済み）

- **画面遷移**: ログイン/新規登録 → gender → height → weight → weight-goal → year → train-goal → （`signIn` 実行で `isLoggedIn` が true になり `(tabs)` へ）
- Figmaデザイン（screenshots/starter/*.jpeg、ポルトガル語）の内容を日本語に翻訳して実装
- 共通ヘッダー `components/onboarding-header.tsx`（`OnboardingHeader`）: 戻るボタン・6セグメントの進捗バー・タイトル・説明カード（`TrainerAvatar` + 説明文）を各画面で共通表示
- `components/ui/trainer-avatar.tsx`（`TrainerAvatar`）: `assets/gif/personal-trainer.gif` を表示。`expo-image` の `startAnimating`/`stopAnimating` を使い、1ループ分（2400ms）再生後に自動停止（無限ループさせない）
- 身長・体重・目標体重・生まれ年は `ScrollView` + `snapToInterval` を使った自作スクロールピッカー（定規型／ホイール型）で実装。外部ピッカーライブラリは未使用
- 機能は未実装（数値はモック・画面間の状態連携なし。例: weight-goal.tsx の現在体重・weight.tsx のBMI計算は仮の固定値を使用）

### ホーム画面の構成（実装済み）

- ヘッダー: 🔥 連続記録・アプリ名・通知ベル・カレンダーアイコン
- 週間カレンダー: 当日ハイライト（グリーン）・スワイプで8週先まで閲覧
- 今日のトレーニング空状態表示（選択日）
- 統計カード: 合計時間・今週の筋トレ回数
- プログラムカード（→ /program へ遷移）
- トレーニング知識セクション: 「筋肥大とは」「プログラム組み方」「RPEとは」の3カード（→各詳細画面へ遷移）

### 筋トレ開始タブの構成（実装済み）

- 今日の日付・曜日表示
- カレンダーで登録済みのメニュー一覧（種目名・部位バッジ・セット/重量）
- 登録あり: 種目数・セット数サマリー + 「筋トレを開始する」ボタン
- 登録なし: 空状態 + 「カレンダーで登録する」ボタン（/calendar へ遷移）
- **開始ボタンはナビのタブが唯一のエントリーポイント**（ホーム・カレンダーに開始ボタンは置かない）

### 記録タブの構成（実装済み）

- グラフ期間セレクター（週/月/年）
- AIトレーナーカード（モック）: TrainerAvatar + 週/月/年ごとのレビューコメント（ボリューム推移から簡易判定）。Claude API連携は今後実装予定
- サマリーカード: 筋トレ回数・ボリューム(kg)
- ボリューム推移折れ線グラフ（areaChart + curved）
- 種目別最大重量グラフ（種目チップで切替・yAxisOffsetでズームイン）
- 筋トレ履歴: 期間（全期間/今月/今週）× 部位（色分けチップ）絞り込み
  - メイン: 最新3件表示 → 「もっと見る」で中央ダイアログモーダル展開
  - モーダル: calendar.tsx の筋トレ修正と同一スタイル（fade・中央・Radius.xl）

### ホーム画面に**含めないもの**（設計方針）

- 食事管理（食事記録・カロリー）
- ルーティン管理
- ライブラリー
- インターバルタイマー

---

## 環境情報

### フロントエンド（React Native / Expo）

- Node.js: v22.20.0
- npm: 10.9.3
- Expo SDK: 最新版
- Expoアプリルート: `kinpoyo/frontend/`（※ kinpoyo-app サブフォルダーは廃止済み）
- 起動コマンド: `cd kinpoyo/frontend && npx expo start`

### バックエンド（FastAPI）

- Python: 3.14.0 (`C:\Python314\python.exe`)
- 仮想環境: `backend-core\venv\`
- DB: PostgreSQL 16（**Docker で起動**）
- FastAPI: venv で直接起動（Docker不使用）

**初回セットアップ:**
```bash
# 1. DB起動（Docker）
docker compose up -d db

# 2. FastAPI セットアップ
cd backend-core
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# 3. マイグレーション適用
alembic upgrade head
```

**通常の起動コマンド:**
```bash
docker compose up -d db                              # DB起動
cd backend-core && venv\Scripts\activate && uvicorn main:app --reload  # API起動
```

- APIドキュメント: http://localhost:8000/docs
- DB接続: `postgresql+psycopg://kinpoyo:kinpoyo@localhost:5432/kinpoyo`
- `docker-compose.yml` はリポジトリルート（`kinpoyo/`）に配置

---

## 開発スケジュール・チーム総合確認

### スケジュール概要

| フェーズ | 期間 | 内容 |
| -------- | ---- | ---- |
| Phase 1 | 〜6/27 | DB基盤・SQLAlchemyモデル・Alembic・シードデータ |
| Phase 2 | 〜7/4  | 認証・ユーザー・種目マスター・ワークアウトAPI |
| Phase 3 | 〜7/11 | 記録統計・プログラム・コミュニティーAPI + FE統合 |
| Phase 4 | 〜7/18 | AI機能（MediaPipe・Claude API）・E2Eテスト |

### チーム総合確認（4回）

> 月曜・火曜・第2/第4土曜に実施。現状把握と計画再調整を目的とする。

| 回 | 日付 | 目的 |
|----|------|------|
| 第1回 | **2026-06-27（土・第4土曜）** | Phase 1 完了確認・DB基盤レビュー・Phase 2 着手調整 |
| 第2回 | **2026-07-07（火）** | Phase 2 完了確認・API動作レビュー・Phase 3 着手調整 |
| 第3回 | **2026-07-11（土・第2土曜）** | Phase 3 中間確認・FE-BE統合状況・課題洗い出し |
| 第4回 | **2026-07-14（月）** | Phase 3〜4 最終確認・全体品質チェック・リリース判断 |

### フロントエンド修正・FE-BE 統合確認（Phase 3 内）

| # | タスク | タイミング |
|---|--------|------------|
| 73 | FE-BE 統合確認（認証・プロフィール・ワークアウト） | Phase 2 完了後・7/7前 |
| 74 | FE-BE 統合確認（記録・プログラム・コミュニティー） | Phase 3 完了後・7/11前 |
| 75 | フロントエンド修正（統合確認で発見した不具合対応） | Phase 3 内・随時 |
| 76 | E2E 動作確認（全画面フロー通し確認） | Phase 4 内・7/14前 |

---

## 開発ルール

### コーディング規約

- バックエンド: PEP8準拠、型ヒント必須
- フロントエンド: TypeScript使用、コンポーネントはPascalCase

---

## API一覧

### ヘルスチェック

| メソッド | パス | 説明           |
| -------- | ---- | -------------- |
| GET      | `/`  | ヘルスチェック |

### 認証 `/auth`

| メソッド | パス                      | 説明                          | 備考              |
| -------- | ------------------------- | ----------------------------- | ----------------- |
| POST     | `/auth/register`          | ユーザー登録                  |                   |
| POST     | `/auth/login`             | ログイン・JWT返却             |                   |
| GET      | `/auth/me`                | ログインユーザー取得           | JWT必須           |
| POST     | `/auth/forgot-password`   | パスワードリセットメール送信   |                   |
| POST     | `/auth/verify-code`       | コード検証（有効期限5分）      |                   |
| POST     | `/auth/reset-password`    | 新パスワード設定              |                   |

### ユーザー `/users`

| メソッド | パス                      | 説明                          | 備考              |
| -------- | ------------------------- | ----------------------------- | ----------------- |
| GET      | `/users/me/profile`       | プロフィール取得              |                   |
| PUT      | `/users/me/profile`       | プロフィール更新（身長・体重等）|                   |
| POST     | `/users/me/goals`         | 体重目標登録                  |                   |
| GET      | `/users/me/goals`         | 目標一覧取得                  |                   |
| GET      | `/users/search?q=`        | ユーザー検索                  |                   |
| POST     | `/users/{id}/follow`      | フォロー                      |                   |
| DELETE   | `/users/{id}/follow`      | フォロー解除                  |                   |

### 種目マスター

| メソッド | パス                              | 説明                           | 備考                     |
| -------- | --------------------------------- | ------------------------------ | ------------------------ |
| GET      | `/exercises`                      | 種目一覧（部位・PPL・器具フィルター）|                       |
| GET      | `/masters/muscle-groups`          | 筋肉部位一覧                   | フロント色分けチップ用    |
| GET      | `/masters/movement-categories`    | PPL分類一覧                    |                          |
| GET      | `/masters/equipment-types`        | 器具一覧                       |                          |

### ワークアウト `/workouts`

| メソッド | パス                                            | 説明                              | 備考                      |
| -------- | ----------------------------------------------- | --------------------------------- | ------------------------- |
| POST     | `/workouts`                                     | セッション新規作成（カレンダー事前登録）| `scheduled_date` 必須  |
| GET      | `/workouts?date=YYYY-MM-DD`                     | 日付別セッション取得              | カレンダー表示用          |
| GET      | `/workouts/{id}`                                | セッション詳細取得                |                           |
| PUT      | `/workouts/{id}`                                | セッション編集（種目・セット修正） |                           |
| DELETE   | `/workouts/{id}`                                | セッション削除                    |                           |
| POST     | `/workouts/{id}/start`                          | セッション開始（`started_at`設定）|                           |
| POST     | `/workouts/{id}/end`                            | セッション終了（duration_sec・total_volume集計）| |
| POST     | `/workouts/{session_id}/exercises`              | 種目追加                          |                           |
| POST     | `/workouts/{session_id}/exercises/{ex_id}/sets` | セット記録                        |                           |

### 記録・統計 `/records`

| メソッド | パス                                      | 説明                        | 備考 |
| -------- | ----------------------------------------- | --------------------------- | ---- |
| GET      | `/records/summary?period=week\|month\|year` | ボリューム推移            |      |
| GET      | `/records/max-weight?exercise_id=`        | 種目別最大重量              |      |
| GET      | `/records/history`                        | 筋トレ履歴（部位・期間フィルター）| |

### プログラム `/programs`

| メソッド | パス                          | 説明                    | 備考 |
| -------- | ----------------------------- | ----------------------- | ---- |
| GET      | `/programs`                   | プログラム一覧          |      |
| POST     | `/programs/{id}/join`         | プログラム参加          |      |
| PUT      | `/user-programs/{id}/status`  | 参加状態更新            |      |

### コミュニティー `/posts`

| メソッド | パス                      | 説明                              | 備考                      |
| -------- | ------------------------- | --------------------------------- | ------------------------- |
| POST     | `/posts`                  | 投稿作成                          |                           |
| GET      | `/posts?type=feed`        | フィード一覧（全体・フォロー中切替）|                          |
| GET      | `/posts?type=qa`          | Q&A一覧                           |                           |
| PUT      | `/posts/{id}`             | 投稿編集                          |                           |
| DELETE   | `/posts/{id}`             | 投稿削除                          |                           |
| POST     | `/posts/{id}/likes`       | いいね                            | `likes_count` 更新        |
| DELETE   | `/posts/{id}/likes`       | いいね取り消し                    |                           |
| POST     | `/posts/{id}/comments`    | コメント投稿                      | `comments_count` 更新     |
| GET      | `/posts/{id}/comments`    | コメント一覧                      |                           |

---

## 依存パッケージ

### バックエンド（requirements.txt）

- fastapi
- uvicorn[standard]
- sqlalchemy[asyncio]
- alembic
- psycopg2-binary
- python-jose[cryptography]
- passlib[bcrypt]
- bcrypt==4.0.1（passlib 1.7.4 が bcrypt 4.1+ のAPI変更に未対応のため明示固定）
- python-dotenv
- python-multipart
- pydantic[email]

### フロントエンド（package.json）

- expo
- react-native
- typescript
- react-native-gifted-charts（折れ線グラフ・棒グラフ）
- react-native-linear-gradient（gifted-charts の依存）
- react-native-svg（Expo SDK に同梱・gifted-charts が使用）
- react-native-qrcode-svg（QRコード表示）
- expo-image-picker（投稿作成画面の画像添付：端末の写真ライブラリから選択）

---

## 変更履歴

| 日付       | 変更内容                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-29 | 初期セットアップ：React Native (Expo) + FastAPI 環境構築                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-29 | ディレクトリ名変更：kinpoyo-app→frontend、backend→backend-core                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-29 | 初期セットアップ：React Native (Expo) + FastAPI 環境構築                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-29 | ディレクトリ名変更：kinpoyo-app→frontend、backend→backend-core                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-31 | AGENTS.md更新：プロジェクト概要・機能一覧・機能フロー・技術スタック・AIエージェント厳守事項を追記                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-01 | デザイントークン作成：styles/theme.css・styles/components.css・constants/theme.ts（白×明るいグリーン配色）                                                                                                                                                                                                                                                                                                                                     |
| 2026-06-01 | AGENTS.md更新：コミュニティー機能を機能一覧に追加                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-01 | Docker廃止：docker-compose.yml・backend-core/Dockerfile を削除。ローカル仮想環境（venv）で直接起動する構成に統一 |
| 2026-06-19 | Docker再導入（DB限定）：PostgreSQL 16のみ docker-compose で起動する構成に変更。FastAPIはvenvのまま。docker-compose.ymlをkinpoyo/直下に配置                                                                                                                                                                                                                                                                                                                               |
| 2026-06-02 | ホーム画面実装：週間カレンダー・今日のトレーニング・体重・プログラムカード。5タブナビ（ホーム・コミュニティー・筋トレ開始・記録・プロフィール）。食事管理・ルーティン・ライブラリー・インターバルタイマーは除外                                                                                                                                                                                                                                |
| 2026-06-02 | explore.tsx削除。ホーム週カレンダーをスワイプ対応（8週先まで）・ボタン名を「ワークアウト登録」に変更・ヘッダーにカレンダーアイコン追加。calendar.tsx新規作成（月表示・色フィルター・前後月ナビ・筋トレ記録/修正ボタン）                                                                                                                                                                                                                        |
| 2026-06-02 | 全画面mockup実装（サブエージェント2並列）。ホーム：ヒーローバナー・炎ストリーク・統計グリッド追加。コミュニティー：4タブ・投稿カード・FAB。記録：期間セレクター・AI週間レポート・曜日サークル・筋肉疲労度バー。プロフィール：ユーザーカード・実績4グリッド・BIG3・身体情報・設定。icon-symbol.tsx拡充                                                                                                                                          |
| 2026-06-02 | ナビゲーション接続：ワークアウト登録→calendar、プログラムカード→program-ichiran、筋トレ登録→kintore-touroku。新規画面：kintore-touroku・program-ichiran・program-shousa1・program-shousa2                                                                                                                                                                                                                                                      |
| 2026-06-02 | ホームのヒーローバナー削除。筋トレ登録：種目追加モーダル(PPL/部位別)・セット/種目×削除・空状態UI。カレンダー：ヘッダー2行構成・月タイトル小さく・筋トレ修正を中央ダイアログ化・削除をメイン一覧に反映。backend-core/DATABASE.md作成（16テーブルDB設計書）                                                                                                                                                                                      |
| 2026-06-02 | フォルダー構成整理：app/直下の画面ファイルを `(screens)/` ルートグループに移動。URLパスは変更なし。\_layout.tsx のStack.Screen名を更新                                                                                                                                                                                                                                                                                                         |
| 2026-06-02 | ファイル名を英語に統一・プログラム画面を `(screens)/program/` サブフォルダーにまとめる：kintore-touroku→workout-register、program-ichiran→program/index、program-shousa1→program/big3、program-shousa2→program/bodyweight。ナビゲーションルートも更新                                                                                                                                                                                          |
| 2026-06-07 | ホーム週カレンダーの曜日と日付のずれ修正（weekPage に paddingHorizontal: Space[4] 追加）                                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-07 | 画面ロール整理：登録はカレンダー・開始はnavタブ・ホームはダッシュボードに統一。ホームから「ワークアウト登録」ボタン削除                                                                                                                                                                                                                                                                                                                        |
| 2026-06-07 | 筋トレ開始タブ（workout.tsx）実装：今日の登録メニュー表示・サマリー・開始ボタン・未登録時の空状態UI                                                                                                                                                                                                                                                                                                                                            |
| 2026-06-07 | 記録タブ（records.tsx）全面実装：react-native-gifted-charts 導入（LineChart）・ボリューム推移・種目別最大重量・筋トレ履歴（絞り込み+モーダル）                                                                                                                                                                                                                                                                                                 |
| 2026-06-07 | 記録タブ 履歴モーダルを calendar.tsx の筋トレ修正モーダルと同一スタイルに統一（fade・中央ダイアログ・Radius.xl）                                                                                                                                                                                                                                                                                                                               |
| 2026-06-07 | 記録タブ 筋肉部位チップを部位ごとの色分け対応（選択時：枠・背景・文字を部位色で表示）                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-07 | コミュニティータブ全面実装：フォロー中(空状態・ユーザーID検索モーダル)・フィード(投稿一覧・ワークアウトサマリー表示)・Q&A(質問一覧)・お知らせ(admin投稿)・投稿詳細モーダル共通(サマリー4グリッド・種目セットテーブル・いいね・ブックマーク・コメント送信)・FABボタン                                                                                                                                                                           |
| 2026-06-07 | コミュニティー投稿カードのインタラクション改善：いいねアイコンはその場で色変更のみ(グリーン)・コメントアイコンで詳細モーダルへ遷移。投稿詳細モーダルをフルスクリーン化＋useSafeAreaInsetsでノッチ・ホームインジケーター対応（Modal内SafeAreaView非対応の回避）。ユーザー検索モーダルから友達招待1+1カードを削除                                                                                                                                |
| 2026-06-07 | コミュニティーフィードカード：画像＋筋トレ実績を130×130正方形・水平スクロール対応(ScrollView horizontal)に変更。カード全体のTouchableOpacityをViewに変更し、タイトル・本文エリアのみタップで詳細遷移・画像エリアは独立スクロール可能に分離。FeedItemにimageCountフィールド追加                                                                                                                                                                 |
| 2026-06-08 | 認証フロー（(auth)グループ）新規作成：login（ログイン/新規作成タブ切替）・forgot-password・verify-code・reset-complete・new-password・success（チェックマークアニメーション）。screenshots/user-auth/ のFigmaデザインに準拠、共通スタイル(theme.ts)を使用。機能は未実装（画面遷移のみのモック）。アプリ起動時のアンカーを (tabs) → (auth) に変更し、ログイン画面から起動するように。icon-symbol.tsx に eye/eye.slash/envelope/checkmark を追加 |
| 2026-06-08 | カレンダー：絞り込みボタンを年月表示の上に移動し、年月（期間）を絞り込みボタンの下で中央ぞろえに変更（今日ボタンは右端に絶対配置）。筋トレ登録：種目選択モーダルのSafeAreaViewをuseSafeAreaInsetsによる手動paddingに置き換え（Modal内SafeAreaView非対応のため、ノッチ・ホームインジケーター部分が種目リストの上下と重なる不具合を修正。community.tsxのPostDetailScreenと同じ回避パターンを適用）                                               |
| 2026-06-08 | login.tsx のタブ切替UI（ログイン⇄新規作成）を廃止し、ログイン画面と新規登録画面を別ルートに分割（signup.tsx を新規作成、(auth)/_layout.tsx に登録）。最初の画面は常にログインのみとし、画面下部の既存リンク「アカウントをお持ちでない方は 新規登録」（→ /signup）・「すでにアカウントをお持ちの方は ログイン」（→ /login）で行き来する構成に変更。ログインのパスワード欄に常時表示されていた赤色エラー枠（inputFocused）を削除。プレースホルダーを例示文言（きんぽよ太郎・contact@dscodetech.com）から項目名（ニックネーム・メールアドレス）に変更                                  |
| 2026-06-08 | オンボーディングフロー（(onboarding)グループ）新規作成：gender→height→weight→weight-goal→year→train-goalの6画面。screenshots/starter/ のFigmaデザイン（ポルトガル語）を日本語に翻訳して実装。共通コンポーネント OnboardingHeader（戻るボタン・進捗バー・タイトル・説明カード）と TrainerAvatar（assets/gif/personal-trainer.gif を expo-image の startAnimating/stopAnimating で1ループのみ再生）を新規作成。身長・体重・目標体重・生まれ年は ScrollView+snapToInterval の自作スクロールピッカーで実装。ログイン/新規登録ボタン押下で gender 画面へ遷移し、train-goal の「はじめる」で signIn を実行して (tabs) へ。ルートレイアウトの Stack.Protected に (onboarding) を追加 |
| 2026-06-09 | weight.tsx 定規ピッカーの数字・目盛り描画を weight-goal.tsx に統一：全数字表示→10の倍数のみ表示・tickLabel に height:16 追加 |
| 2026-06-09 | height.tsx・weight.tsx の単位切替を実装：cm↔ft（大数字・定規ラベルともに変換表示、cmToFtIn関数追加）・kg↔lbs（大数字・定規ラベルともに変換表示、kgToLbs関数追加） |
| 2026-06-09 | weight-goal.tsx 差分バンド修正：zoneBand の位置計算をビューポート中央基準に修正（旧実装はスクロール内容の絶対座標のため画面外に描画されていた）・色を primarySubtle→primaryLight (opacity:0.7) の緑色に変更 |
| 2026-06-09 | weight.tsx→weight-goal.tsx へ体重・単位をルーターパラメータで渡す実装：router.push に params: { currentWeight, unit } 追加・weight-goal.tsx で useLocalSearchParams で受け取り、currentWeightKg・初期 unit に反映。大数字・現在体重ラベル・定規ラベルの kg/lbs 変換も対応 |
| 2026-06-09 | オンボーディング完了フロー修正：train-goal.tsx の「はじめる」で signIn を直接呼ぶ代わりに /success へ遷移（params: { from: 'onboarding' }）。success.tsx で from=onboarding 時は signIn() を呼んで tabs へ、それ以外は /login へ。success.tsx のコンテンツを画面中央に修正（paddingTop → justifyContent: center） |
| 2026-06-09 | login.tsx：ログインボタンを /gender（オンボーディング）→ signIn() 直接呼び出しに変更。オンボーディングは signup.tsx からのみ開始するよう修正 |
| 2026-06-09 | ホーム画面（index.tsx）：体重カード・体重入力モーダル・関連ステート・未使用インポート（KeyboardAvoidingView/Modal/TextInput/Platform）・未使用スタイルを削除 |
| 2026-06-11 | ホーム画面に「💡トレーニング知識」セクション追加（プログラムカードの下）：「筋肥大とは」「プログラム組み方」「RPEとは」の3カードから各詳細画面へ遷移。新規画面 `(screens)/program/hypertrophy.tsx`・`program-design.tsx`・`rpe.tsx` を追加（解説コンテンツのみ・ナビゲーションのみ） |
| 2026-06-12 | カスタムプログラム画面（custom_program.tsx）の画面表示不具合および型エラーを修正。Expo Routerのネイティブヘッダーを非表示（headerShown: false）にし、theme.tsに準拠した独自ヘッダーへ統合。合わせて、解説画面3ファイル（hypertrophy.tsx、rpe.tsx、program-design.tsx）からも黒いヘッダー帯を排除し、統一感のある戻るボタン付きヘッダーへ修正。 |
| 2026-06-12 | 記録タブ（records.tsx）にAIトレーナーカードを仮実装：期間セレクター(週/月/年)の下に追加。TrainerAvatar + 期間別レビューコメント（aiComment関数、ボリューム推移の増減で簡易判定）。Claude API連携による本実装は今後対応 |
| 2026-06-12 | 「AIアドバイザー」表記をすべて「AIトレーナー」に統一（records.tsx・AGENTS.md）。weight.tsx・weight-goal.tsx のBMI/目標カード内TrainerAvatarを28→56pxに拡大し、gender.tsx等の説明カードのアバターサイズと統一 |
| 2026-06-12 | 筋トレ登録（workout-register.tsx）：種目選択モーダルの種目リストScrollViewに `flex: 1` を追加。フィルターチップ（全て・部位別すべて等）で表示件数が多い場合にリスト下部が画面外で切れてスクロールできなかった不具合を修正 |
| 2026-06-12 | 通知モーダルを新規実装：`components/notifications-modal.tsx`（`NotificationsModal`、calendar.tsx筋トレ修正モーダルと同じfade・中央・Radius.xlスタイル、モック通知5件）。ホーム・コミュニティーの通知ベルボタン押下で表示。コミュニティーの通知ボタンをホームの円形`iconBtn`スタイル（36×36・bgCard・Shadow.sm）に統一（`s.notifBtn`） |
| 2026-06-12 | オンボーディング（gender/height/weight/weight-goal/year/train-goal）の説明カードをrecords.tsxのAIトレーナーカードと同じ見出し構成に統一：TrainerAvatarの横に「AIトレーナー」タイトルを表示し、その下に説明文/コメントを表示するレイアウトに変更（OnboardingHeaderのdescCard）。weight.tsx・weight-goal.tsxは「AIトレーナー」タイトル＋サブタイトル（weight.tsxは"現在のBMI"、weight-goal.tsxはgoalMessageのheading）を表示（bmiCard、goalCard） |
| 2026-06-12 | コミュニティー（community.tsx）：投稿から「筋トレサマリー」「種目リスト」を削除し、画像＋本文（タイトル/テキスト）のみのシンプルな構成に変更（投稿登録画面を作りやすくするため）。FeedItem型からworkoutSummary/exercises/ExerciseRowを削除、フィードカードは画像枚数(imageCount)があれば画像のみ横スクロール表示、投稿詳細モーダルからサマリーカード・種目テーブルを削除。いいね・コメント機能はそのまま維持 |
| 2026-06-12 | コミュニティー：投稿詳細モーダルの画像表示を複数枚対応（main画像＋2枚目以降をサムネイル横スクロール、タップでmain切替）に変更。フィードに画像なし投稿(f3)を1件追加。投稿詳細ヘッダー右上の不要なinfoアイコンを削除 |
| 2026-06-12 | コミュニティー：FABボタン（鉛筆アイコン）から投稿作成モーダル（`PostCreateScreen`、pageSheet）を開けるように実装。フィード/Q&Aを選択してタイトル・本文を入力、画像添付（モックプレースホルダー、最大5枚・追加/削除可）。投稿するとfeedData/qaDataの先頭に追加され該当タブに切り替わる。画像表示条件をpost.type==='feed'限定から!!post.imageCountに一般化（Q&A投稿でも画像表示可） |
| 2026-06-12 | コミュニティー：投稿作成画面（PostCreateScreen）のレイアウトを調整し余白を解消。本文入力欄をflex:1で残りスペースいっぱいに拡大、画像添付プレースホルダーを80x80→110x110に拡大（追加ボタンのアイコンも28→36に拡大、削除ボタンも20x20→24x24に拡大） |
| 2026-06-12 | コミュニティー：投稿作成画面の不具合修正。①画像添付プレースホルダーの削除（×）ボタンが横スクロール領域でクリップされて見切れる問題を、ボタン位置を画像の外側(top:-8,right:-8)から内側(top:6,right:6)に変更して解消。②入力欄フォーカス時にキーボードが出ると本文欄(flex:1)が圧縮され画像添付が不自然な位置に来る問題を、コンテンツ全体をScrollView化（contentContainerStyleでflexGrow:1、本文欄はflex:1+minHeight:100）し、キーボード表示時はフォーム全体がスクロールしてフォーカス中の入力欄が自動的に見える位置に収まるよう変更 |
| 2026-06-12 | 筋トレ登録（workout-register.tsx）：種目選択モーダルをコミュニティーのモーダルと統一し、全画面表示からpageSheet表示（`presentationStyle="pageSheet"`）に変更。Modal内の手動`useSafeAreaInsets`によるpaddingTop/paddingBottom指定を`SafeAreaView edges={['top','bottom']}`に置き換え |
| 2026-06-12 | 筋トレ登録：種目選択モーダルのヘッダーの「種目を選ぶ」タイトルが画面端に寄って詰まって見えるため、`marginLeft: Space[2]`を追加し少し右にずらして余白を確保 |
| 2026-06-12 | カレンダー→筋トレ登録の日付連携：calendar.tsxの「筋トレ登録」ボタンでrouter.pushする際に選択中の日付（year/month/date）をパラメータとして渡すように変更。workout-register.tsxは`useLocalSearchParams`でこれを受け取り、指定があればその日付を、なければ本日の日付をdateLabelに表示 |
| 2026-06-12 | 筋トレ登録：日付カードの「変更」ボタン（未実装のスタブ）を削除。日付はカレンダーから渡された値を表示するのみとし、changeBtn/changeBtnTextスタイルも削除 |
| 2026-06-12 | 筋トレ登録：①日付カードの「変更」ボタンを復活させ、押すとカレンダー画面に戻る（router.back()）。②ヘッダーの「完了」ボタンを押すと筋トレ開始画面（/workout）に遷移するよう変更。③「筋トレを保存する」ボタンを押すと中央ダイアログ（centeredOverlay/centeredDialog）で「筋トレを保存しました」のお知らせモーダルを表示し、OKでカレンダーに戻る |
| 2026-06-12 | コミュニティー：ユーザー検索モーダルのMy ID Cardに「マイQRコード」表示ボタン（MaterialIcons qr-code-2）を追加。押すと中央ダイアログ（centeredOverlay/centeredDialog、workout-register.tsxの保存完了モーダルと同様のfade表示）でreact-native-qrcode-svgによるQRコード（user_kinpoyo、200px）・ユーザーID・閉じるボタンを表示。依存パッケージにreact-native-qrcode-svgを追加 |
| 2026-06-12 | コミュニティー：①ヘッダー右上のアバターをTouchableOpacity化し、押すと`/profile`へ遷移するように修正。②マイQRコード表示で別の`<Modal>`を二重表示すると画面全体のボタンが反応しなくなる不具合を修正：QRコード用の独立Modal（centeredOverlay/centeredDialog）を廃止し、ユーザー検索モーダル内でヘッダータイトル・本文を「ユーザー検索」⇄「マイQRコード」に切り替える方式に変更（戻るボタンでQR画面→検索画面→モーダルを閉じる、の順に戻る）。centeredOverlay/centeredDialog/qrTitle/qrCloseBtn系スタイルを削除しqrContainerを追加 |
| 2026-06-12 | icon-symbol.tsx（共通コンポーネント）の型エラー修正：`MAPPING`に対する誤った`as IconMapping`キャスト（`Record<SFSymbol, MaterialIconName>`で全SF Symbol名を要求してしまい不整合だった）を削除し`as const`に変更、`IconSymbolName`をMAPPINGの実際のキーから導出するように修正。存在しないSF Symbol名だった`'search'`キーを正しい`'magnifyingglass'`に変更し、community.tsx側の`<IconSymbol name="search">`も`name="magnifyingglass"`に更新。`npx tsc --noEmit`のエラーが0件になった |
| 2026-06-12 | コミュニティー：投稿作成画面（PostCreateScreen）①ヘッダー右上の「投稿」ボタンに`marginRight`を追加し、画面端から少し左にずらして表示。②画像添付をモックプレースホルダーから`expo-image-picker`による実機の写真ライブラリ選択に変更（最大5枚・複数選択・権限リクエスト・選択画像をプレビュー表示・×ボタンで削除）。依存パッケージに`expo-image-picker`を追加し、app.jsonのpluginsに写真権限の説明文（日本語）を設定 |
| 2026-06-12 | コミュニティー：投稿した画像が一覧・詳細に表示されない不具合を修正。FeedItem型に`images?: string[]`を追加し、PostCreateScreenの`onSubmit`を画像枚数(number)ではなく選択した画像URI配列(string[])を渡すように変更。FeedTabのフィード画像・PostDetailScreenのmain画像/サムネイルで、`images`があれば`expo-image`で実画像を表示、なければ既存のモック用グレープレースホルダーを表示するように分岐（既存モック投稿の表示は変更なし） |
| 2026-06-12 | コミュニティー：自分の投稿（`user === 'あなた'`）を編集・削除できるように対応。投稿詳細モーダルのヘッダー右上に編集（鉛筆）・削除（ゴミ箱）アイコンを追加。編集はPostCreateScreenを再利用し、タイトル・本文・画像を初期値として開き「投稿を編集」「更新」表記に切替（投稿先タイプ選択は編集時非表示・変更不可）。削除はネストしたModalを避けるため、PostDetailScreen内に画面内オーバーレイ（dialogOverlay/dialogBox、Radius.xl）で「投稿を削除しますか？」確認ダイアログを表示し、削除確定でfeedData/qaDataから該当投稿を除去して詳細モーダルを閉じる。CommunityScreenに`editingPost`・`postModalKey`状態を追加し、投稿作成・編集モーダルを1つに統合（`key`で都度マウントし直し、編集→新規作成時に前回入力が残らないようにする） |
| 2026-06-12 | コミュニティー：編集・削除ボタンをアイコンから文字表記「編集」「削除」に変更し、投稿一覧（FeedTab）でも自分の投稿に表示されるように対応。投稿カードのアクション行を左（編集・削除テキストボタン、自分の投稿のみ）と右（いいね・コメント）に分割（postActionsLeft/postActionsRight、postActionsをjustifyContent: 'space-between'に変更）。削除確認ダイアログを`DeleteConfirmDialog`コンポーネントとして共通化し、投稿詳細モーダルでは画面内オーバーレイ、投稿一覧では新規追加した`deletingPost`状態によるtransparent Modal（ネストしたModal問題を避けるため、一覧画面では他のModalが開いていない時のみ表示される）として再利用 |
| 2026-06-12 | コミュニティー：投稿検索機能を実装。ヘッダーの検索アイコン（虫眼鏡）押下で検索バー（テキスト入力＋クリアボタン）の表示/非表示を切替（押下中はアイコンが×に変化）。フィード・Q&A・お知らせの各タブで、入力文字列をタイトル・本文・投稿者名に対して大文字小文字を区別しない部分一致でフィルタリング（`filterByQuery`、リアルタイム反映）。該当なしの場合はFeedTabに検索結果なしの空状態（search-offアイコン＋メッセージ）を表示 |
| 2026-06-13 | プロフィール・コミュニティーから「IDを登録してください」系のプロンプトを削除。profile.tsx：ユーザーカードの「IDを登録してアカウントを保護しましょう」リンク（idPrompt/idPromptTextスタイル含む）を削除。community.tsx：検索バー下の「コミュニティ機能を利用するにはIDを登録してください」インフォバナー（infoBanner系スタイル含む）を削除 |
| 2026-06-13 | プロフィール画面：下部の「トレーニング記録」（カレンダー・マイメモ・エクササイズについて）・「設定」（通知設定・プライバシー設定・ヘルプ・お問い合わせ）リストを削除し、ユーザーカード・実績・BIG3・身体情報のみの構成に変更。未使用となったRECORD_ROWS/SETTING_ROWS/SectionRow/RowItem型・rowGroup系スタイル・未使用のReactインポートを削除 |
| プログラム均等振分     | `(screens)/program/even_program.tsx` | ✅ 実装済み           | 各分割法（PPL、上半身/下半身、その他分割）に対応した部位別（胸・肩・背中・腕・脚など）のカスタム種目選択・設定画面。チェックボックスUIでの複数選択に対応。 |
| 2026-06-27 | 新規画面 `even_program.tsx`（プログラム均等振分画面）の実装。`custom_program.tsx` から選択された分割法（PPL、上半身/下半身、4・5分割など）をパラメータとして安全に引き継ぎ、ヘッダーおよび対象部位タブを動的に切り替える仕組みを構築。<br>Figmaデザインに準拠し、ブックマークアイコンを排除してチェックボックス型UIおよび右側インフォアイコン（`info.circle`）を配置。画像ベースの主要種目に加えて「デッドリフト」「ハックスクワット」を追加。各分割法ごとの種目マージ連動（例：「上半身」に胸・肩・背中・腕をすべてマージ）を完全に実装。`constants/theme`（`Space`）の小数の型エラーおよび `useEffect` のeslint依存関係警告をすべて解消。 |
| 種目詳細設定         | `(screens)/program/program_choice.tsx` | ✅ 実装済み           | `even_program.tsx` から遷移。選択された各種目ごとに、セット数の追加・削除、および重量（kg）・目標レップ数を細かくカスタム設定する最終確認画面。 |
| 2026-06-19 | AGENTS.md・README.md・DATABASE.md 更新：バックエンドのディレクトリ構成を `app/` サブディレクトリ構成（models/旧モノリシックmodels.py→機能別ファイル分割）に修正。API一覧にPhase2〜3の全エンドポイントを追記。依存パッケージにsqlalchemy/alembic/python-jose/passlib等を追加。DATABASE.mdセクション6.1のファイル構成をモデル分割ファイル対応に更新 |
| 2026-06-19 | AGENTS.md 更新：開発スケジュール・チーム総合確認（4回：6/27・7/7・7/11・7/14）・FE-BE統合確認タスク（#73〜76）を追加 |
| 2026-06-27 | DATABASE.md 正規化評価・修正（Phase 1 完了確認）：`workout_session_statuses` マスターテーブル（3.11）を追加。`workout_sessions.status_id` FK追加。マスター計11テーブルに更新。ER図・リレーション一覧・マイグレーション手順・AGENTS.md を同期更新 |
| 2026-07-10 | ユーザーAPI実装：`app/core/security.py`（bcryptハッシュ化・JWT発行/検証）・`app/core/deps.py`（get_current_user）新規作成。`app/schemas/user.py`・`app/crud/user.py`・`app/routers/auth.py`（register/login/me）・`app/routers/users.py`（profile取得/更新）実装、main.pyに登録。`.env`にSECRET_KEY等追加。動作確認中にpasslib 1.7.4がbcrypt 5.0.0のAPI変更(`__about__`属性削除)に対応できず例外になる不具合を発見、`bcrypt==4.0.1`に固定して解決 |
| 2026-07-10 | 筋トレ・プログラム・コミュニティAPI実装：`app/schemas`・`app/crud`・`app/routers`に`workout.py`/`record.py`/`program.py`/`community.py`を追加、`users.py`にフォロー・検索を追加。main.pyに全ルーター登録。設計上の判断点（要レビュー）：①`POST /workouts`は種目・セットをネストして一括作成可能に拡張（workout-register.tsxが一括保存する作りのため。個別追加用の`POST .../exercises`・`.../exercises/{id}/sets`はAGENTS.md記載どおり別途維持）②`DELETE /workouts/{id}`はDATABASE.md 4.6の状態遷移表に従い物理削除ではなく`status_id=4(cancelled)`への更新として実装③`GET /posts`に`scope=all\|following`パラメータを追加（AGENTS.mdに厳密なパラメータ名の記載がなかったため設計で補完）④レスポンスに`status_code`/`exercise_name`等マスターの参照先を人間可読な形で埋め込み、フロント側でのID→ラベル変換を不要にした。`programs`テーブルはシードデータが無く空配列を返す状態（シード投入は今回のスコープ外） |
