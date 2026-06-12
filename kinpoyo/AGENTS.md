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
│   │   ├── (screens)/                # フルスクリーン画面グループ（URLパスは変わらない）
│   │   │   ├── modal.tsx             # モーダル画面
│   │   │   ├── calendar.tsx          # カレンダー画面 ✅
│   │   │   ├── workout-register.tsx  # 筋トレ登録フォーム ✅
│   │   │   └── program/             # プログラム関連画面
│   │   │       ├── index.tsx           # プログラム一覧 ✅  (route: /program)
│   │   │       ├── big3.tsx            # BIG3強化プログラム詳細 ✅  (route: /program/big3)
│   │   │       ├── bodyweight.tsx      # ボディウェイト詳細 ✅  (route: /program/bodyweight)
│   │   │       ├── hypertrophy.tsx     # 筋肥大とは ✅  (route: /program/hypertrophy)
│   │   │       ├── program-design.tsx  # プログラム組み方 ✅  (route: /program/program-design)
│   │   │       └── rpe.tsx             # RPEとは ✅  (route: /program/rpe)
│   │   │       └── custom_program.tsx  # カスタムプログラム画面 ✅
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
    ├── routers/           # APIルーター
    ├── models/            # データモデル
    ├── requirements.txt   # 依存パッケージ一覧
    └── DATABASE.md        # DB設計書（テーブル定義・ER図・設計方針）
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
| 筋トレ登録             | `(screens)/workout-register.tsx`   | ✅ 実装済み           | 種目追加モーダル（Push/Pull/Leg・部位別フィルター、24種目）・セット数/レップ数/重量(kg) 3カラムテーブル・×でキャンセル                                                                    |
| プログラム一覧         | `(screens)/program/index.tsx`      | ✅ 実装済み           | BIG3強化・ボディウェイトの2プログラムカード                                                                                                                                               |
| BIG3プログラム詳細     | `(screens)/program/big3.tsx`       | ✅ 実装済み           | ヒーロー・概要グリッド・週スケジュール・3種目・開始ボタン                                                                                                                                 |
| ボディウェイト詳細     | `(screens)/program/bodyweight.tsx` | ✅ 実装済み           | ヒーロー・概要グリッド・週スケジュール・6種目・開始ボタン                                                                                                                                 |
| 筋肥大とは             | `(screens)/program/hypertrophy.tsx` | ✅ 実装済み          | ホーム「トレーニング知識」カードから遷移。筋肥大の三大原則（トレーニング・栄養・休養）の解説                                                                                              |
| プログラム組み方       | `(screens)/program/program-design.tsx` | ✅ 実装済み       | ホーム「トレーニング知識」カードから遷移。分割法・適切なボリューム設定の解説                                                                                                              |
| RPEとは                | `(screens)/program/rpe.tsx`        | ✅ 実装済み           | ホーム「トレーニング知識」カードから遷移。自覚的運動強度（RPE）を用いた強度管理の解説                                                                                                     |
| コミュニティー         | `(tabs)/community.tsx`             | ✅ 実装済み           | 4タブ(フォロー中・フィード・Q&A・お知らせ)・フォロー中空状態・ユーザーID検索モーダル・投稿カード一覧・投稿詳細モーダル(ワークアウトサマリー・種目リスト・いいね・コメント送信)・FABボタン |
| 筋トレ開始             | `(tabs)/workout.tsx`               | ✅ 実装済み           | 今日の登録メニュー一覧・種目数/セット数サマリー・開始ボタン（登録あり時のみ）・未登録時はカレンダーへ誘導                                                                                 |
| 記録                   | `(tabs)/records.tsx`               | ✅ 実装済み           | 週/月/年グラフ（折れ線・react-native-gifted-charts）・種目別最大重量・筋トレ履歴（期間+部位絞り込み・モーダル展開）                                                                       |
| プロフィール           | `(tabs)/profile.tsx`               | ✅ 実装済み           | ユーザーカード・実績4グリッド・BIG3(1RM)・身体情報・設定リスト                                                                                                                            |
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
- 初回セットアップ:
  ```
  cd backend-core
  python -m venv venv
  venv\Scripts\activate
  pip install -r requirements.txt
  ```
- 起動コマンド: `cd backend-core && venv\Scripts\activate && uvicorn main:app --reload`
- APIドキュメント: http://localhost:8000/docs

---

## 開発ルール

### コーディング規約

- バックエンド: PEP8準拠、型ヒント必須
- フロントエンド: TypeScript使用、コンポーネントはPascalCase

---

## API一覧

| メソッド | パス | 説明           |
| -------- | ---- | -------------- |
| GET      | `/`  | ヘルスチェック |

---

## 依存パッケージ

### バックエンド（requirements.txt）

- fastapi
- uvicorn[standard]

### フロントエンド（package.json）

- expo
- react-native
- typescript
- react-native-gifted-charts（折れ線グラフ・棒グラフ）
- react-native-linear-gradient（gifted-charts の依存）
- react-native-svg（Expo SDK に同梱・gifted-charts が使用）

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
| 2026-06-01 | Docker廃止：docker-compose.yml・backend-core/Dockerfile を削除。ローカル仮想環境（venv）で直接起動する構成に統一                                                                                                                                                                                                                                                                                                                               |
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
