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

> **以下のテーブルは別担当者がAI設計を進めており、現在は仮実装の状態です。**
> **コード・マイグレーション・シードデータ、いかなる変更も禁止します。**
> **誤ってデータを投入したり構造を変更すると、統合時に深刻な競合が発生します。**

| テーブル       | ファイル                | 禁止理由                       |
| -------------- | ----------------------- | ------------------------------ |
| `pose_records` | `app/models/workout.py` | MediaPipe AI処理担当者が設計中 |

**禁止事項（厳守・`pose_records`のみ対象）:**

- モデルクラスの編集禁止
- マイグレーションでのカラム追加・削除・変更禁止
- シードスクリプトでのデータ投入禁止
- このテーブルへの INSERT / UPDATE / DELETE 禁止

統合時は必ず担当者と確認・合意の上で作業すること。

> **`ai_reviews`について（2026-08-24更新）**: 従来はClaude API連携担当者が別途設計中として
> 上記と同様に変更禁止だったが、AIレビュー機能の設計・実装を担当者本人（ユーザー）が兼任する
> ことになったため、上記の禁止対象から外れた。`session_sets.rep_cycles_json`・
> `ai_reviews.matched_part_codes_json`・新規`ai_review_prompt_parts`テーブルを含め、
> 通常のテーブルと同様に変更・実装してよい（詳細は`backend-core/DATABASE.md`のAIレビュー領域節）。

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

## 修正予定タスク（2026-08-28、ユーザー指摘・未着手）

> **⚠️ 以下はまだ着手していないTODOリスト。実装済みの内容と混同しないこと。**
> 着手したら、このセクションから該当項目を削除し、対応する画面の実装状況・
> セクションに反映すること。

### ~~ログイン画面~~（`frontend/app/(auth)/login.tsx`、2026-08-28対応済み）

- [x] kinpoyoのロゴを表示する → タイトル「ログイン」の上に`kinpoyo`ワードマーク
      （`FontSize['3xl']`・`Colors.primaryDark`、`AppHeader`のブランド文字と同系統の
      スタイル）を追加。画像アセットは無いため、他画面と同じテキストロゴ方式を踏襲
- [x] Apple/Googleログインボタンを削除 → `onPress`が無い純粋なモックだったため、
      ボタン本体と「または」の区切り線、関連スタイル（`dividerRow`/`socialBtn`等）・
      未使用になった`FontAwesome`importを削除
- `tsc --noEmit`通過済み
- **追記（同日、レイアウト再修正）**：最初に`justifyContent: 'center'`で全体を
  中央寄せしたが、「ちょっと違う」とフィードバックがあり、選択肢を提示して
  「上下に要素を分散」案を採用。**ロゴ＝画面上部固定・フォーム本体＝中央付近・
  アカウント切替リンク＝画面下部固定**という3ブロック構成に変更：
  - `switchRow`（新規登録/ログインへのリンク）を`form`の中から出し、ロゴ・
    フォームと同階層の兄弟要素にした
  - `scroll`のスタイルを`justifyContent: 'center'` → `'space-between'`に変更
    （3ブロックが等間隔で上下に配置され、結果的に中央のフォームが画面中央
    付近に来る）
  - login.tsx・signup.tsx両方に同じ構造を適用（見た目を統一する方針は継続）
- **追記（同日）**：ロゴをもっと大きくとの要望で、`fontSize`を`FontSize['3xl']`
  （34、テーマの最大トークン）から**48**に変更（トークンの範囲を超えるため
  直接数値指定。login.tsx・signup.tsx両方）
- **追記（同日、キーボード対策）**：「キーボードが出ると画面全体が持ち上がって
  窮屈」という相談に対し、3つのパターン（①何もしない、②キーボード表示時に
  ロゴを縮小、③上下固定＋フォームのみスクロール）を提示し、②を採用して実装：
  - `Keyboard.addListener`（iOSは`keyboardWillShow`/`Hide`、Androidは
    `keyboardDidShow`/`Hide`）でキーボードの表示・非表示を検知し、
    `Animated.Value`（0〜1）を200msでアニメーションさせる
  - ロゴを`Text`から`Animated.Text`に変更し、`fontSize`を48→26、`opacity`を
    1→0.7へ補間。`fontSize`のアニメーションは`useNativeDriver: false`が必須
    （ネイティブドライバは`transform`/`opacity`のみ対応のため）
  - login.tsx・signup.tsx両方に同じ実装を適用

### ~~身体情報入力画面~~（オンボーディング：`frontend/app/(onboarding)/height.tsx`・
`weight.tsx`、2026-08-28対応済み）

- [x] 身長のft説明文 → `unit === 'ft'`の時だけ、単位トグルの下に
      「ft = フィート・インチ表記（例: 5'9" ＝ 5フィート9インチ）」を表示
- [x] 体重UIの目盛り/表示値ズレ → **原因判明**：`contentContainerStyle`の
      `paddingHorizontal`が画面端の固定余白（`Layout.screenPaddingH`）に
      なっており、目盛りを中央線に正しく揃えるのに必要な「ルーラー表示幅の
      半分 − アイテム幅の半分」になっていなかった。height.tsx（縦方向 piker）の
      `SIDE_PADDING = VIEWPORT_HEIGHT/2 - ITEM_HEIGHT/2`と同じ考え方に揃えて
      修正（`useWindowDimensions()`でルーラー幅を取得し動的に算出）。
      `handleScroll`側の計算式は変更不要（パディングを正しくすれば辻褄が合う）
- `tsc --noEmit`通過済み

### 筋トレメニュー登録画面（`frontend/app/(screens)/workout-register.tsx`、
2026-08-28一部対応。確定ボタンのみ未解決で残っている）

調査の結果、実際に「種目を追加するUI」（種目選択モーダル）を持つのは
`workout-register.tsx`と`workout-template-edit.tsx`のみと判明（`program_choice.tsx`は
前の画面から渡された種目リストを編集するだけで、種目選択UI自体は持たない）。今回は
指示通り`workout-register.tsx`のみ対応。`workout-template-edit.tsx`は全く同じ実装
パターン（同じ問題）を抱えているが、今回のスコープ外として未対応のまま。

- [x] 種目選択の視認性・解除 → 選択済み行に`Colors.primarySubtle`背景＋
      `Colors.primary`枠線＋太字（フィルターチップの`chipActive`と同じ視覚言語に
      揃えた）。`disabled={added}`を廃止し、選択済み行タップで解除
      （`removeExerciseByExerciseId`新設。確認ダイアログ無し＝メインカードの
      削除ボタンと同じ挙動に合わせた）
- [ ] レップ数入力の確定ボタン → **未解決**。3案（`InputAccessoryView`・
      Keyboardイベント自前バー・自作数値キーパッド）を試したがいずれも不採用
      （詳細は本セクション末尾の追記参照）
- [x] レップ数の小数点禁止 → `keyboardType`を`"numeric"`（小数点あり）から
      `"number-pad"`（整数のみ）に変更。ペースト対策で`onChangeText`側でも
      `[^0-9]`を除去。休憩の分/秒も同様に整数化
- [x] 種目の並び替え → ドラッグ&ドロップ用ライブラリを新規追加せず、各種目
      カードのヘッダーに▲▼ボタンを追加し、隣接要素と入れ替える方式で実装
      （`moveExercise`。`chevron.up`/`chevron.down`を`icon-symbol.tsx`の
      MAPPINGに追加）
- [x] レップ数未入力での保存禁止 → `handleSave`内でセット配列を`reps`未入力
      チェックし、該当種目名を添えたエラーメッセージで保存をブロック
- `tsc --noEmit`通過済み
- **追記（同日、バグ修正）**：選択済み行の枠線が下辺だけ緑にならない不具合を
  報告あり。原因はReact Nativeのスタイル上書きの仕様——`exerciseListItem`が
  `borderBottomColor: Colors.divider`を個別指定しており、選択スタイルの
  `borderColor`（一括指定）は上下左右まとめて指定するが、**個別指定の方が
  優先される**ため下辺だけ灰色のまま残っていた。`exerciseListItemSelected`に
  `borderBottomColor: Colors.primary`を追加して明示的に上書きして解決
- **追記（同日、間隔調整）**：「種目の間に小さいスペースが欲しい」との要望で
  `exerciseListContent`に`gap: Space[1]`を追加。これに伴い、ベースの
  `exerciseListItem`が持っていた`borderBottomWidth`/`borderBottomColor`
  （行間の区切り線）は、gap導入後は冗長（角丸＋余白で既に区切られている）に
  なったため削除し、上記の枠線バグ修正で追加していた`borderBottomColor`の
  明示的な上書きも不要になったため合わせて削除（今は`borderWidth`/
  `borderColor`の一括指定だけで四辺とも正しく緑になる）
- **追記（同日、確定ボタンが実機で出ないとの報告）**：`InputAccessoryView`
  （iOS専用API）で実装した「完了」ボタンが実機で表示されないと報告があった。
  RN/Expoでは環境・バージョン次第で`InputAccessoryView`が効かないことがある
  既知の不安定さがあるため、**Keyboardイベントで実装する自前方式に切り替えた**：
  - `Keyboard.addListener('keyboardDidShow'/'keyboardDidHide', ...)`で
    キーボードの高さ（`e.endCoordinates.height`）を`keyboardHeight` stateに保持
  - `keyboardHeight > 0`の間だけ、`position: 'absolute', bottom: keyboardHeight`
    で画面下部・キーボードのすぐ上に「完了」ボタンのバーを重ねて表示
  - `InputAccessoryView`・`NUMERIC_ACCESSORY_ID`・各TextInputの
    `inputAccessoryViewID`は全て削除
  - **副次的な利点**：`keyboardDidShow`/`Hide`はiOS/Android両対応のイベントの
    ため、`Platform.OS === 'ios'`分岐が不要になり、**Androidでも同時に効くように
    なった**（従来はiOS専用でAndroidは未対応のままだった）
  - `tsc --noEmit`通過済み。実機再検証はこれから
- **追記（同日、確定ボタン機能を撤回）**：自前実装（Keyboardイベント方式）も
  ユーザーから「元の状態に戻してほしい」との指示があり撤回。`keyboardHeight`
  state・`useEffect`・キーボードバーのJSX・`keyboardAccessory`/
  `keyboardAccessoryDone`スタイル・`Keyboard`のimportを全て削除し、
  reps/weight/rest欄は確定ボタン機能追加前の状態（`keyboardType`のみ、
  small改善: number-padでの整数化はこの回答の対象外なので維持）に戻した。
  **「確定ボタンが分かりづらい」というTODO項目自体は未解決のまま残っている**
  （再挑戦する場合は別アプローチを検討すること）

- **追記（同日、自作キーパッドを試すも撤回）**：ユーザーから「キーボード自体
  （左下の空きスペース）にボタンを入れられないか」という相談があり、**iOSの
  システムキーボード内部にはアプリ側から一切手を入れられない**（Apple非公開
  領域）ことを説明。唯一の方法として「システムキーボードを諦めて自作の数値
  キーパッドに置き換える」案を提示・承認を得て実装（`ActiveField`型・
  `showSoftInputOnFocus={false}`・電卓配置の自作キーパッド・「確定」ボタン）
  したが、**実機で試した結果「前の状態が良かった」とのことで撤回**。
  `ActiveField`型・`activeField` state・`getActiveValue`/`setActiveValue`/
  `handleKeypadPress`・キーパッドのJSX・`keypad`系スタイル・
  `icon-symbol.tsx`の`delete.left`マッピングを全て削除し、4つのTextInputは
  `keyboardType`（weight="numeric"、reps/分/秒="number-pad"）＋整数化の
  `onChangeText`サニタイズのみの状態（確定ボタン撤回時点の状態）に戻した。
  **「確定ボタンが分かりづらい」というTODO項目は再び未解決**。今後同じ方向で
  再挑戦する場合は、今回の2案（キーボードイベント方式・自作キーパッド方式）
  がどちらも不採用だったことを踏まえること
  - `tsc --noEmit`通過済み

- **追記（同日、並び替えの再実装）**：上下ボタン方式から`react-native-draggable-flatlist`
  を使った長押しドラッグ並び替えに変更済み（`renderExerciseCard`・
  `DraggableFlatList`・ハンドルアイコン`line.3.horizontal`を`icon-symbol.tsx`に
  追加）。ハンドルアイコンだけを長押し起点にし、TextInputや他のボタンと
  ジェスチャーが競合しないようにしている

- **追記（同日、バリデーションのリアルタイム化）**：「レップ数未入力」等のエラー
  表示を、保存ボタンを押した時だけの判定から**リアルタイム判定**に変更
  （ユーザー要望：「直したらすぐエラーが消えるように」）：
  - `validationError`を`useMemo(() => ..., [sessionExercises])`で算出する
    ように変更。フロントエンド側だけの判定でサーバー送信は行わない
  - `hasAttemptedSave`（一度でも保存を押したか）を導入し、これが`false`の間は
    `validationError`があっても表示しない（未入力のまま何も操作していない
    状態からいきなり赤字が出るのを防ぐ、一般的なUXパターン）
  - 保存失敗時のエラー（サーバー通信エラー）は`submitError`として分離。
    これはリアルタイムには消えない（次の保存試行まで残る、通信結果のため）
  - 表示は`displayError = (hasAttemptedSave && validationError) || submitError`
    の優先順位。`sessionExercises`を直すと`validationError`が自動的に`null`に
    なり、保存ボタンを押し直さなくても即座にエラーが消える
  - `tsc --noEmit`通過済み
### 筋トレメニュー編集画面（`frontend/app/(screens)/program/program_choice.tsx`、
編集モード。`(tabs)/workout.tsx`の`handleEditMenu`から`mode: 'edit'`で遷移）

- [ ] **画面自体を削除し、筋トレメニュー登録画面に統合する**。理由：編集画面は登録画面と
      本質的に同じ機能なのにUIが異なり、かつ編集画面では種目の新規追加ができないため、
      UIが違うこと自体がユーザーにとって使いづらさの原因になっている。登録画面のUIに
      一本化し、新規登録・既存編集の両方を同じ画面・同じ挙動で扱えるようにする

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
│   │       ├── workout.tsx           # 筋トレ開始 ✅（結合済み）
│   │       ├── records.tsx           # 記録 ✅
│   │       └── profile.tsx           # プロフィール ✅
│   ├── components/    # 共通コンポーネント
│   ├── constants/     # デザイントークン（theme.ts）
│   ├── hooks/
│   │   └── use-auth.tsx      # 認証状態（isLoggedIn/isRestoring/token・login/register/completeOnboarding/signOut）
│   ├── services/      # バックエンドAPI呼び出し
│   │   ├── api.ts            # 共通fetchラッパー（ベースURL自動解決・ApiError）
│   │   ├── auth.ts           # register/login/me
│   │   ├── token-storage.ts  # JWT保存（ネイティブ:expo-secure-store／Web:localStorage）
│   │   ├── exercises.ts      # GET /exercises
│   │   ├── workout.ts        # POST/GET /workouts系・start/end
│   │   └── program.ts        # プログラム一覧/参加/次メニュー提案/advance
│   │       # exercises.ts に countRepsFromVideo（AI回数カウント：動画アップロード）も含む
│   ├── styles/        # CSSテンプレート
│   ├── package.json
│   └── ...
└── backend-core/          # FastAPI バックエンド
    ├── main.py            # エントリーポイント
    ├── requirements.txt   # 依存パッケージ一覧
    ├── DATABASE.md        # DB設計書（テーブル定義・ER図・設計方針）
    ├── ml_assets/         # AI回数カウント用MediaPipeモデルの自動ダウンロード先（.gitignore済み・手動配置不要）
    ├── scripts/
    │   ├── seed_masters.py    # マスターデータ投入スクリプト
    │   ├── seed_demo_program.py  # デモ用BIG3プログラム投入（動作確認用）
    │   └── import_rep_model.py   # model-studioから較正済みAI回数カウント設定を取り込む
    └── app/
        ├── database.py        # Engine・セッション設定
        ├── models/
        │   ├── __init__.py    # 全Modelをまとめてエクスポート
        │   ├── base.py        # DeclarativeBase・TimestampMixin
        │   ├── master.py      # マスター11テーブル
        │   ├── user.py        # User・UserProfile
        │   ├── body.py        # BodyGoal
        │   ├── exercise.py    # Exercise・ExerciseSecondaryMuscle・RepCountModel（AI回数カウント設定）
        │   ├── workout.py     # WorkoutSession・SessionExercise・SessionSet
        │   ├── program.py     # Program・ProgramExercise・UserProgram
        │   └── community.py   # Post・PostLike・PostComment・Follow
        ├── schemas/           # Pydantic スキーマ（リクエスト・レスポンス定義）
        │   ├── master.py
        │   ├── user.py
        │   ├── exercise.py
        │   ├── workout.py
        │   ├── program.py
        │   └── community.py
        ├── routers/           # APIルーター（エンドポイント定義）
        │   ├── auth.py
        │   ├── users.py
        │   ├── exercises.py   # 種目一覧・AI回数カウント（rep-model取得・count-reps動画解析）
        │   ├── workouts.py
        │   ├── records.py
        │   ├── programs.py
        │   ├── community.py
        │   └── masters.py
        ├── crud/              # DB操作ロジック
        │   ├── user.py
        │   ├── exercise.py    # RepCountModel取得を含む
        │   ├── workout.py
        │   ├── program.py
        │   └── community.py
        └── core/
            ├── config.py         # 環境変数管理（DATABASE_URL等）
            ├── security.py       # JWT・パスワードハッシュ（python-jose/passlib）
            ├── deps.py           # 依存性注入（get_db, get_current_user）
            ├── pose.py           # AI回数カウント：1フレーム→ポーズランドマーク抽出（MediaPipe Tasks API）
            ├── pose_analysis.py  # AI回数カウント：ランドマーク→関節角度計算
            └── rep_model.py      # AI回数カウント：録画動画からの回数判定（テンプレート照合＋統計ゲート、推論のみ）
```

> **Expo Router ルートグループについて**
> `(screens)` と `(tabs)` はどちらもルートグループ（括弧で囲んだフォルダー）。
> URLパスには影響しない（例: `(screens)/calendar.tsx` → `/calendar`）。
> ファイル整理のためだけに使用している。

---

## 画面一覧・実装状況

| 画面                   | ファイル                               | 状態                    | 備考                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | -------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ログイン               | `(auth)/login.tsx`                     | ✅ 実装済み（モック）   | kinpoyoロゴ・メール/パスワード入力・パスワード表示切替・パスワードを忘れたリンク・新規登録リンク（→ /signup）・アプリ起動時の最初の画面。Apple/Googleログインボタンは未実装モックだったため2026-08-28に削除済み                                                                                                                                                                                                                                                  |
| 新規登録               | `(auth)/signup.tsx`                    | ✅ 実装済み（モック）   | kinpoyoロゴ・ニックネーム/メール/パスワード入力・パスワード表示切替・ログインリンク（→ /login）。ログイン画面と同じ見た目に統一（中央配置）。Apple/Googleログインボタンは未実装モックだったため2026-08-28に削除済み                                                                                                                                                                                                                                                                                                                                                                                          |
| パスワードを忘れた     | `(auth)/forgot-password.tsx`           | ✅ 実装済み（モック）   | メールアドレス入力→Reset Password（入力で活性化）                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 確認コード入力         | `(auth)/verify-code.tsx`               | ✅ 実装済み（モック）   | 5桁コード入力ボックス（自動フォーカス送り）・Resend email                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| パスワードリセット完了 | `(auth)/reset-complete.tsx`            | ✅ 実装済み（モック）   | 完了メッセージ・Confirmボタン                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| パスワード変更         | `(auth)/new-password.tsx`              | ✅ 実装済み（モック）   | 新パスワード・確認パスワード入力（表示切替付き）・決定ボタン                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 完了アニメーション     | `(auth)/success.tsx`                   | ✅ 実装済み（モック）   | チェックマークのスケール+フェードアニメーション（reanimated）→自動でログインへ遷移                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ホーム                 | `(tabs)/index.tsx`                     | ✅ 実装済み（結合済み） | 月表示カレンダー（旧`calendar.tsx`を統合）・選択日の「本日のトレーニングメニュー」カード（登録済みなら実績、未登録＋参加中プログラムありなら次メニュー提案、両方無ければ空状態）・統計グリッド（未結合）・プログラムカード・トレーニング知識セクション。「筋トレ登録」ボタンは削除（登録は筋トレ開始タブのみ）                                                                                                                                                                                                             |
| 筋トレ登録             | `(screens)/workout-register.tsx`       | ✅ 実装済み（結合済み） | `GET /exercises`から取得した実データで種目選択モーダル（pageSheet、Push/Pull/Legs・部位別フィルター）。セットごとの重量/回数入力→`POST /workouts`で保存                                                                                                                                                                                                                                                                                                                                                 |
| AI回数カウント（動画録画・解析） | `(screens)/workout-camera.tsx`   | ✅ 実装済み・DB保存済み・実機テスト済み | 筋トレ開始タブの「筋トレを開始する」から、較正済み種目（現状スクワットのみ）があれば自動遷移。「録画開始」→「終了」で動画を録画し、`POST /exercises/{id}/count-reps`へアップロード、backend側でまとめて解析した回数を結果画面に表示（バッチ方式。リアルタイムWebSocket版は2026-08-24に精度・遅延の問題で削除済み）。計測結果は`session_sets`へ自動保存され、「AIレビューを見る」ボタンからAIトレーナーのフォームレビューを生成できる。未対応種目の場合は遷移せず開始タブ側に通知を表示。**既知の制約：今日の種目に較正済みモデルが複数含まれていても、最初に見つかった1種目にしかカメラは起動しない**（2種目目以降の対応は保留）。**セット管理フロー（休憩・複数セット・全体レポート）は設計のみで未実装**（下記「筋トレフロー刷新」節参照） |
| プログラム一覧         | `(screens)/program/index.tsx`          | ✅ 実装済み             | BIG3強化・ボディウェイトの2プログラムカード                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| BIG3プログラム詳細     | `(screens)/program/big3.tsx`           | ✅ 実装済み             | ヒーロー・概要グリッド・週スケジュール・3種目・開始ボタン                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ボディウェイト詳細     | `(screens)/program/bodyweight.tsx`     | ✅ 実装済み             | ヒーロー・概要グリッド・週スケジュール・6種目・開始ボタン                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 筋肥大とは             | `(screens)/program/hypertrophy.tsx`    | ✅ 実装済み             | ホーム「トレーニング知識」カードから遷移。筋肥大の三大原則（トレーニング・栄養・休養）の解説                                                                                                                                                                                                                                                                                                                                                                                                            |
| プログラム組み方       | `(screens)/program/program-design.tsx` | ✅ 実装済み             | ホーム「トレーニング知識」カードから遷移。分割法・適切なボリューム設定の解説                                                                                                                                                                                                                                                                                                                                                                                                                            |
| RPEとは                | `(screens)/program/rpe.tsx`            | ✅ 実装済み             | ホーム「トレーニング知識」カードから遷移。自覚的運動強度（RPE）を用いた強度管理の解説                                                                                                                                                                                                                                                                                                                                                                                                                   |
| コミュニティー         | `(tabs)/community.tsx`                 | ✅ 実装済み             | 4タブ(フォロー中・フィード・Q&A・お知らせ)・フォロー中空状態・ユーザーID検索モーダル（My ID CardにQRコード表示ボタン追加、モーダル内で検索画面⇄マイQRコード画面を切替表示）・ヘッダー右上のアバターから/profileへ遷移・投稿カード一覧（自分の投稿は文字表記「編集」「削除」ボタン表示）・投稿詳細モーダル(画像・いいね・コメント送信・自分の投稿は文字表記「編集」「削除」ボタン表示)・FABボタン（投稿作成・編集モーダル：フィード/Q&A選択・タイトル/本文入力・画像添付（expo-image-picker、最大5枚）） |
| 筋トレ開始             | `(tabs)/workout.tsx`                   | ✅ 実装済み（結合済み） | `GET /workouts?date=`で今日の登録メニューを実データ表示・種目数/セット数サマリー・開始/終了ボタン（`POST /workouts/{id}/start`・`/end`、完了後はduration/total_volume表示）。未登録時はその場で登録できるフォーム（`program_choice.tsx`ベースのセット/重量/レップ/RPEテーブル＋`GET /exercises`種目ピッカー）を表示、保存後は画面遷移せずそのまま登録済み表示に切替                                                                                                                                                                                                                                                                                                                                                                                               |
| 記録                   | `(tabs)/records.tsx`                   | ✅ 実装済み             | 週/月/年グラフ（折れ線・react-native-gifted-charts）・AIトレーナーカード（モック・TrainerAvatar+期間別コメント）・種目別最大重量・筋トレ履歴（期間+部位絞り込み・モーダル展開）                                                                                                                                                                                                                                                                                                                         |
| プロフィール           | `(tabs)/profile.tsx`                   | ✅ 実装済み             | ユーザーカード・実績4グリッド・BIG3(1RM)・身体情報                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 性別選択               | `(onboarding)/gender.tsx`              | ✅ 実装済み（モック）   | 男性/女性カード選択・「その他／回答しない」ピル・選択時のみ次へ活性化（人物画像なし）                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 身長設定               | `(onboarding)/height.tsx`              | ✅ 実装済み（モック）   | cm/ft単位切替・上下スクロールの定規ピッカー（スナップ）・中央インジケーター・大きい数値表示                                                                                                                                                                                                                                                                                                                                                                                                             |
| 体重設定               | `(onboarding)/weight.tsx`              | ✅ 実装済み（モック）   | kg/lbs単位切替・左右スクロールの定規ピッカー（スナップ）・BMIカード（TrainerAvatar+コメント）                                                                                                                                                                                                                                                                                                                                                                                                           |
| 目標体重設定           | `(onboarding)/weight-goal.tsx`         | ✅ 実装済み（モック）   | 左右スクロールの定規ピッカー・現在値→目標値の帯表示・減量/増量/維持メッセージカード（TrainerAvatar）                                                                                                                                                                                                                                                                                                                                                                                                    |
| 生まれ年設定           | `(onboarding)/year.tsx`                | ✅ 実装済み（モック）   | 上下スクロールのホイールピッカー（スナップ）・選択中の年をハイライト表示                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 筋トレ目標選択         | `(onboarding)/train-goal.tsx`          | ✅ 実装済み（モック）   | 「痩せたい/筋肉を増やしたい/体型を維持したい」カード選択（画像なし）・「はじめる」ボタンでログイン状態に遷移し (tabs) へ                                                                                                                                                                                                                                                                                                                                                                                |

### 認証フロー（(auth) グループ・実装済み）

- **アプリ起動時の最初の画面**: `unstable_settings.anchor` を `(auth)` に設定し、`login.tsx` から開始する
- ログイン・新規登録は別ルート（`/login` ⇄ `/signup`）。画面下部のリンクで相互に遷移
- フロー: login → (パスワードを忘れた) → forgot-password → verify-code → reset-complete → new-password → success → login（自動遷移）
- ログイン/新規登録のボタン押下で `(onboarding)` グループの `gender` 画面へ遷移（モック動作。実際の認証処理は未実装）
- success.tsx はチェックマークのポップインアニメーション（react-native-reanimated）後、自動的にログイン画面へ戻る
- icon-symbol.tsx に認証画面用アイコンを追加: `eye` / `eye.slash`（パスワード表示切替）/ `envelope` / `checkmark`

### オンボーディングフロー（(onboarding) グループ・実装済み）

- **画面遷移**: ログイン/新規登録 → gender → height → weight → weight-goal → year → train-goal → （`signIn` 実行で `isLoggedIn` が true になり `(tabs)` へ）
- Figmaデザイン（screenshots/starter/\*.jpeg、ポルトガル語）の内容を日本語に翻訳して実装
- 共通ヘッダー `components/onboarding-header.tsx`（`OnboardingHeader`）: 戻るボタン・6セグメントの進捗バー・タイトル・説明カード（`TrainerAvatar` + 説明文）を各画面で共通表示
- `components/ui/trainer-avatar.tsx`（`TrainerAvatar`）: `assets/gif/personal-trainer.gif` を表示。`expo-image` の `startAnimating`/`stopAnimating` を使い、1ループ分（2400ms）再生後に自動停止（無限ループさせない）
- 身長・体重・目標体重・生まれ年は `ScrollView` + `snapToInterval` を使った自作スクロールピッカー（定規型／ホイール型）で実装。外部ピッカーライブラリは未使用
- 機能は未実装（数値はモック・画面間の状態連携なし。例: weight-goal.tsx の現在体重・weight.tsx のBMI計算は仮の固定値を使用）

### ホーム画面の構成（実装済み・結合済み。旧`(screens)/calendar.tsx`を統合、削除済み）

- ヘッダー: 🔥 連続記録・アプリ名・通知ベル（カレンダーアイコンは廃止、画面自体がカレンダーになったため）
- 月表示カレンダー: 前後月ナビ・今日ボタン・`GET /exercises`＋表示月分の`GET /workouts?date=`並列取得によるドット/選択日一覧の実データ化
- 選択日の「本日のトレーニングメニュー」カード（タグバッジ＋タイトル＋種目行、旧モックの見た目を踏襲）:
  - 登録済み: その日のセッションの実績を表示
  - 未登録＋参加中プログラムあり: 「次のメニュー」提案（`GET /programs/{id}/exercises`）＋「このメニューを登録する」ボタン（登録すると`POST /user-programs/{id}/advance`で`current_day`が進む）
  - どちらも無い: 空状態「トレーニングなし」
- 登録専用のボタンはホームに置かない（登録は筋トレ開始タブのインラインフォームのみ）
- 統計カード: 合計時間・今週の筋トレ回数（未結合、プレースホルダーのまま）
- プログラムカード（→ /program へ遷移、参加中プログラム名を動的表示）
- トレーニング知識セクション: 「筋肥大とは」「プログラム組み方」「RPEとは」の3カード（→各詳細画面へ遷移）

### 筋トレ開始タブの構成（実装済み・結合済み）

- 今日の日付・曜日表示
- `GET /workouts?date=今日`で取得した実データのメニュー一覧（種目名・部位バッジ・セット/重量）
- 登録あり・`scheduled`: 種目数・セット数サマリー + 「筋トレを開始する」ボタン（`POST /workouts/{id}/start`）
- `in_progress`: 「実施中」バナー + 「筋トレを終了する」ボタン（`POST /workouts/{id}/end`）
- `completed`: 完了サマリー（`duration_sec`/`total_volume`表示）
- 登録なし: 「今日のメニューは登録されていません」の空状態 + **その場で登録できるフォーム**（`program_choice.tsx`を参考にしたセット/重量(kg)/レップ数/RPEのテーブルUI、種目追加は`workout-register.tsx`と同じ`GET /exercises`ピッカー）。保存すると画面遷移せずそのまま登録済み表示に切り替わる
- **開始ボタンはナビのタブが唯一のエントリーポイント**（ホームに開始ボタンは置かない）
- 「筋トレを開始する」押下時、今日の種目にAI回数カウント較正済みのもの（現状スクワットのみ）があれば`workout-camera.tsx`へ自動遷移してカメラ計測、無ければ未登録の通知を表示（詳細は「AI回数カウント機能」セクション参照）

### 記録タブの構成（2026-08-25、実データ接続済み）

2026-08-25までは全データがハードコードされたモックだったが、既存の`/records`系
バックエンドAPI（実装済みだったが未接続だった）に接続し、`frontend/services/records.ts`
を新設して実データを流すようにした。

- グラフ期間セレクター（週/月/年 ↔ API `period=week|month|year`）→ `GET /records/summary`
- AIトレーナーカード: 実データ（`total_sessions`・ボリューム推移）を使った決定的
  ヒューリスティックのコメント（`aiComment()`、期間集計に対する本物のAI生成レビューは
  まだ無い。DeepSeek連携は将来やるなら新規エンドポイントが必要）
- サマリーカード: `total_sessions`・`total_volume`（選択期間の実績）
- ボリューム推移折れ線グラフ：`points[].period_start`からラベルを算出
  （週=曜日、月=`{週番号}週`（配列の並び順そのまま利用）、年=`{月}月`）
- 種目別最大重量グラフ：`GET /records/history?period=all`の結果から実際に記録の
  ある種目一覧を作って種目チップにする（種目マスター全件ではなく「やったことが
  ある種目」だけ表示）。選択した種目IDで`GET /records/max-weight?exercise_id=`を呼ぶ
- 筋トレ履歴: 期間（全期間/今月/今週 ↔ API `period=all|month|week`）は`GET
  /records/history`で毎回サーバー側フィルタ。**部位の絞り込みは複数選択UIだが
  APIの`muscle_group_id`は単一値のみ対応**のため、`period=all`で取得した全履歴
  から部位の選択肢一覧（色・名前）を作り、複数選択の絞り込み自体はクライアント側で
  行う（`histMuscles`配列でフィルタ）
  - メイン: 最新3件表示 → 「もっと見る」で中央ダイアログモーダル展開
  - モーダル: calendar.tsx の筋トレ修正と同一スタイル（fade・中央・Radius.xl）
- **バックエンド側の修正**：`app/crud/record.py`の3関数（`get_volume_summary`/
  `get_max_weight`/`get_history`）は元々`status_id != CANCELLED`（予定済み・実施中
  セッションも含む）でフィルタしていたため、開始前/実施中のセッションが実績として
  混入するバグがあった。`status_id == COMPLETED`に修正済み（実機接続時に発覚）
- **筋トレ履歴カードから過去のAIレポートを閲覧可能（2026-08-25追加）**：
  `HistoryItem`に`duration_sec`を追加（`WorkoutSession.duration_sec`をそのまま
  露出。カードに「6/6（土）· 52分」のように表示、`fmtDuration()`で分/時間分に整形。
  0秒以下は非表示）。カードをタップすると`GET /workouts/{id}/report`（新設、
  `generate-report`とは別の読み取り専用エンドポイント。再生成はしない）で
  そのセッションの`WorkoutSessionReportOut`を取得し、`workout-report-result.tsx`
  （筋トレ終了直後と同じ画面）へ`reportJson`＋`dateLabel`パラメータで遷移する。
  レポート未生成のセッションは404（通常は`/end`成功時に自動生成されるので
  基本発生しない想定。発生時は`Alert.alert`でエラー表示）

### ホーム画面に**含めないもの**（設計方針）

- 食事管理（食事記録・カロリー）
- ルーティン管理
- ライブラリー
- インターバルタイマー

---

## プロフィール画面（2026-08-25、Phase 1実装済み）

以前は完全にモック（`useAuth().signOut()`以外はAPIを一切呼ばない静的UI）だった
`profile.tsx`を実データ接続した。ユーザーから「①実データ接続（既存API中心）→
②新規サブシステム（BIG3の1RM登録・My筋トレテンプレート）」の2フェーズで進める
方針を確認済み。**今回実装したのはPhase 1のみ**。

### Phase 1（実装済み）

- **ユーザーカード**：`GET /auth/me`（`fetchMe`、既存）＋`GET /users/me/profile`
  （新規`frontend/services/user.ts`）から表示名（無ければusername）を表示
- **実績スタッツ**：新規`GET /records/achievements`（`app/crud/record.py`の
  `get_achievements`）で全期間累計の「トレーニング時間・総ボリューム・合計
  ワークアウト数・週間ストリーク」を返す。`status_id == COMPLETED`のセッションのみ
  対象（records機能全体の既存方針と統一）
  - 週間ストリークの定義（ユーザー確認済み）：ISO週単位で「今週を含めて連続で
    完了済みワークアウトが1回以上あった週の数」。`_compute_weekly_streak()`が
    `date.isocalendar()`/`date.fromisocalendar()`で年またぎも正しく処理する
- **最近の身体情報**：`UserProfileOut`の現在値（体重/筋肉量/体脂肪率）をそのまま
  表示。**履歴機能ではなく単一スナップショット**（DBに時系列テーブルが無いため。
  「最近の」＝「直近に更新した値」という扱い）
- **参加プログラム（新規セクション）**：`GET /user-programs/me`から`status_code
  === 'active'`のものを表示し、`current_week`/`current_day`の進捗と「プログラムを
  やめる」ボタン（既存の`leaveProgram`をそのまま利用）を出す。元のモックUIには
  無かったセクションを新規追加
- **ユーザー情報変更**：新規画面`frontend/app/(screens)/profile-edit.tsx`。
  ヘッダーの歯車アイコン（元々onPressが無かった）と「最近の身体情報」カードの
  タップで遷移。編集対象はプロフィール画面に実際に表示されているフィールドのみ
  （表示名・体重・筋肉量・体脂肪率）に絞った（`UserProfileOut`の他フィールド
  〔身長・性別・生年月日・bio・アバター〕は今回のUIに出ていないため対象外）
- **ログアウト**：`useAuth().signOut()`は元から実装済みでそのまま維持

### 表示順（2026-08-26変更）

`profile.tsx`のセクション表示順は、ユーザーカードの直下に「最近の身体情報」を
配置する順に変更済み：ユーザーカード → **最近の身体情報** → 実績スタッツ →
BIG3の合計(1RM) → 参加プログラム → My筋トレ → ログアウト（変更前は実績スタッツ・
BIG3の後だった）。

### Phase 2（2026-08-25実装済み）

- **BIG3の合計(1RM)**：自動計算＋手入力登録の両方に対応（ユーザー確認済み）。
  - 新規テーブル`user_exercise_maxes`（`user_id, exercise_id, weight_kg,
    recorded_at`）に手入力値を保存（マイグレーション`3a7c9e1f5b02`）
  - `app/core/rpe_predictor.py`の`get_prior_best_e1rm`を拡張し
    `exclude_session_id`を`Optional`化（Noneなら全期間ベストを返す。元々は
    セッションレポートの「今回より前の自己ベスト」専用だったが、BIG3表示は
    「今回を含む生涯ベスト」が欲しいため）
  - `app/crud/exercise_max.py`の`get_big3`：種目ごとに手入力値と自動推定1RMの
    大きい方を採用し`source`（"manual"|"workout"）を返す。TOTALは3種目全ての
    ベストが分かっている場合のみ計算（1つでも不明ならNone）
  - `GET /records/big3`・`POST /records/exercise-max`
  - `profile.tsx`：BIG3カードをタップすると手入力登録モーダルが開く
    （SQUAT=exercise_id 17、BENCH=1、DEADLIFT=9で固定）
- **My筋トレ（新規追加）**：よく行う筋トレを保存して、カレンダーからワンタップで
  その日に登録できる機能。既存の`Program`/`UserProgram`は「1ユーザー1アクティブ
  プログラムまで」という制約（`join_program`の`AlreadyHasActiveProgramError`）
  があるため**流用せず**、独立した新規テーブルにした：
  - `workout_templates`（id, user_id, name, created_at）→
    `workout_template_exercises`（exercise_id, order_index）→
    `workout_template_sets`（weight_kg, reps, rest_after_sec）の3階層。
    `WorkoutSession → SessionExercise → SessionSet`と同じ形にすることで、
    テンプレート適用時にそのまま`WorkoutSessionCreate`へ変換できる
    （マイグレーション`7d4f2a8c91e6`）
  - `app/crud/workout_template.py`の`apply_template`：テンプレートの内容から
    `SessionExerciseCreate`/`SessionSetCreate`を組み立て、既存の
    `workout_crud.create_session`をそのまま呼ぶ（セッション作成ロジックを
    重複させない）。`target_sets`はテンプレートのセット数をそのまま使う
    （達成率バグ修正と同じ理由で実績計算の基準になるため必須）
  - エンドポイント：`POST/GET /workout-templates`、
    `GET/DELETE /workout-templates/{id}`、`POST /workout-templates/{id}/apply`
  - `profile.tsx`に「My筋トレ」セクション（一覧＋新規追加＋削除）を追加。
    新規追加は`workout-template-edit.tsx`（`workout-register.tsx`と同じ
    種目/セット組み立てUIだが日付が無い。休憩時間の個別設定は今回スコープ外＝
    シンプルさ優先）
  - `frontend/app/(tabs)/index.tsx`：カレンダーの空き日カードに「My筋トレから
    登録」チップ行を追加（`selDayWorkouts.length === 0 && templates.length > 0`
    の時のみ表示）。タップで`applyWorkoutTemplate`→即座にその日へセッション作成
- **実装時の落とし穴**：`WorkoutTemplateExerciseOut.exercise_name`は
  `WorkoutTemplateExercise`の直接属性ではなく`exercise.name`というリレーション
  越しの値のため、`model_validate(from_attributes=True)`では埋まらず
  `ValidationError`になった（`session_to_out`と同じ理由）。`crud/workout_template.py`
  の`template_to_out()`で手動組み立てするよう修正して解決

---

## AI回数カウント機能 — バッチ（録画→アップロード→解析）方式が本番導線（2026-08-24）

> **現状：「筋トレを開始する」ボタンから、model-studioで較正済みの種目（現状はスクワットのみ）
> であれば自動で**バッチ版**のカメラ画面（`workout-camera.tsx`）が開く。録画→アップロード→
> backend側でまとめて解析→結果表示。model-studio本番APIと数値完全一致まで検証済み。**
>
> 経緯：2026-08-22にリアルタイム版（WebSocket）を精度・遅延問題で一度廃止しバッチ方式へ。
> 2026-08-24、バッチ版でmodel-studioとの数値完全一致を確認後、同日中にリアルタイム版を
> 再設計・実装し、一時的に本番導線をリアルタイム版に切り替えて実機テストを行った。
> しかしテストの結果、`takePictureAsync`連写方式に由来するシャッター音・速い動作への
> 耐性不足が判明し、根本解決にはカメラ処理の本格的な刷新（react-native-vision-camera等
> への移行、custom dev client必須）が必要と分かった。ユーザー判断により、それは大規模な
> 変更のため見送り、**同日中にリアルタイム版のコード自体を削除**（詳細は下記
> 「リアルタイム版」節）し、本番導線をバッチ版へ戻して、AIレビュー機能を優先することにした。
> カウント結果は`session_sets.ai_counted_reps`・`rep_cycles_json`へ保存されるようになった
> （AIレビュー機能実装時に対応。下記「AIレビュー機能」節参照）。
> 詳しいデバッグの経緯（長期間、数値が一致しなかった原因調査の記録）は
> `notes/ai-count-debug-memo.txt`を参照。
> 続きに着手する際は、このセクションを起点に更新すること。

### 背景

`../model-studio/`（別リポジトリ扱い・変更禁止。詳細は `model-studio/AGENTS.md` 参照）で、
MediaPipeのポーズランドマークから種目ごとの「回数カウント用モデル」を学習済み。
このモデルは **ニューラルネットではなく軽量なJSON設定**（ヒステリシス状態機械の閾値＋
1レップ形状テンプレート＋統計ゲート、`RepModel.config_json`）。

model-studioはAzure App Service + Azure SQL Databaseで動いており、**1フレームごとに
同期でDBへINSERTする設計**のため処理が非常に遅い。本アプリではこの構成を踏襲せず、
**Azureを使わずbackend-coreでローカルに処理する**方針とした。

### 決定したアーキテクチャ（現行版）

```
① スマホで動画を録画（expo-cameraの録画機能。mode="video"、録画開始/終了ボタン）
② 録画終了後、動画ファイルをmultipartでbackend-coreへアップロード
   POST /exercises/{id}/count-reps
③ backend-coreがOpenCVで動画を1フレームずつ読み込み、MediaPipeでランドマーク抽出
④ 較正済み設定（rep_count_models）を使い、app/core/rep_model.pyの
   count_with_template（1レップ形状テンプレート照合＋統計ゲート＋ヒステリシス、
   model-studioでmae=0.0の実績があるフル版アルゴリズム）で判定
⑤ 結果（回数・採用/棄却したサイクルの内訳と理由）をまとめて返す→画面に表示
```

model-studio（変更禁止）自身の`POST /models/{id}/count`と同じ設計（動画アップロード→
バッチ解析→結果を返す、非同期ジョブ化はしない）。判定は全てbackend側で行うため、
**フロントには回数カウントのロジックが一切無い**（録画・アップロード・結果表示のみ）。

- **backend-core**：動画受信→フレームごとにMediaPipeでランドマーク抽出→関節角度計算→
  レップ判定まで全てを担う。フレーム単位の画像・ランドマークはDBに永続化しない
  （処理用の一時ファイルも処理後に削除）。実装確認用に、毎フレームの関節角度と
  各サイクルの採用/棄却理由をターミナル（uvicornのログ）に出力する
- **frontend**：`expo-camera`で動画を録画し、multipartでアップロードして結果を表示するだけ

### past: リアルタイムストリーミング版（2026-08-13〜08-22、廃止）

最初は「フロントカメラで定期的に静止画を撮影→WebSocketでbackend-coreへ送信→都度
関節角度を受け取りフロント側でリアルタイムにカウント」という設計で実装し、実機テストで
数々の不具合を発見・修正した（`StreamingRepCounter`によるカウント巻き戻りの修正、遅延
蓄積対策、姿勢ロスト判定の実時間ベース化など）。しかし精度・遅延の問題が解決しきれず、
「①アルゴリズムが正しいか」と「②リアルタイム通信が正しいか」という2つの変数が絡まって
デバッグが難しい状態が続いたため、**ユーザーと相談の上、②を完全に排除できるバッチ方式
（model-studio自身と同じ設計）に戻すことにした**。このとき得られた教訓（下記「実装中に
判明した重要な制約」の①②③）は現行のバッチ方式でも通用するため引き続き有効。

このとき作った`/ws/pose`（WebSocket）・`frontend/lib/repCount.ts`
（`StreamingRepCounter`等）・`frontend/services/pose-ws.ts`・
`frontend/app/(screens)/pose-test.tsx`・`components/pose-skeleton-overlay.tsx`は
**全て削除済み**。`app/core/pose.py`（ランドマーク抽出）・`app/core/pose_analysis.py`
（角度計算）・`rep_count_models`テーブルと較正データ取り込みはそのまま現行版でも再利用している。

### 較正済みモデルの取り込み

model-studioのAzure App Service（`https://kinpoyo-api.azurewebsites.net`、読み取り専用アクセス。
model-studio自体は変更禁止）から、`backend-core/scripts/import_rep_model.py`で
較正済みの`RepModel`を取得し`rep_count_models`へ取り込む。

```bash
cd backend-core && venv\Scripts\activate
python scripts/import_rep_model.py <model-studioのタグ名> <本アプリの種目名>
# 例: python scripts/import_rep_model.py スクワット スクワット
```

現状、実データとして**スクワット（exercise_id=17）のみ**投入済み（model-studio側
`model_id=15`、`mae=0.0`、`exact_match_rate=1.0`）。他の種目でカメラ計測を有効にするには、
model-studio側で該当タグの`build-model`が実行済みであることを確認した上でこのスクリプトを
実行する。

### ⚠️ 実装中に判明した重要な制約（要一読）

1. **mediapipeは最終的にlegacy API（`mp.solutions.pose`）を使う。** 当初はPython 3.14
   環境の都合で新Tasks API（`mediapipe.tasks.python.vision.PoseLandmarker`）に
   書き直していたが、Tasks APIの骨格検出モデルはlegacy API（0.10系）とは別に
   学習・パッケージされた別物で、model-studioの較正済み閾値と噛み合わないことが
   判明したため、**backend-core全体をPython 3.12＋legacy API
   （`mediapipe>=0.10.14,<0.10.22`）に揃えた**（`app/core/pose.py`参照）。
2. **⭐最重要・最後まで気づかなかった根本原因：角度計算には`pose_landmarks`
   （画像正規化座標）ではなく`pose_world_landmarks`（腰を原点とする実世界3D
   メートル座標）を使うこと。** `pose_landmarks`はx/yが画像の幅・高さで別々に
   正規化されておりアスペクト比の分だけ歪み、zは全く別スケールなので、3点の
   角度計算に混ぜると無意味な値になる（特に奥行きを含む動き＝スクワットの
   ような動作で顕著）。`pose_world_landmarks`は座標系の回転・平行移動に対して
   角度が不変なので、カメラ位置・動画サイズに依存しない正しい角度が出る。
   config・アルゴリズム・mediapipeバージョンを全て一致させても数値が合わない、
   という長い調査の末にたどり着いた結論（詳細な経緯は
   `notes/ai-count-debug-memo.txt`参照）。**今後MediaPipeのランドマークを
   扱うコードを書く際は、必ず`result.pose_world_landmarks`を使うこと。**
3. **プロジェクトのルートパスに日本語（`HAL名古屋`）が含まれるため、MediaPipe・
   OpenCVの内部C++層に非ASCIIパスを渡すとファイルを開けず`FileNotFoundError`
   になる**（モデルファイルパス・`cv2.imwrite()`の保存先どちらでも発生を確認済み）。
   backend-core全体の venv は `C:\venvs\kinpoyo-backend-core`（ASCIIパス）に
   置いている（`backend-core\venv`ではない。`start.txt`参照）。
4. MediaPipeの推論・動画のフレームループはCPUバウンドな同期処理。
   `POST /exercises/{id}/count-reps`は`async def`ではなく**普通の`def`
   （非async）で定義しており、FastAPIが自動的にスレッドプールで実行するため
   イベントループをブロックしない（`UploadFile`の読み込みも`await video.read()`
   ではなく同期API`video.file.read()`を使う。`def`内では`await`できないため）。
5. **スマホの縦撮り動画は、横長ピクセルバッファ＋90度回転メタデータで保存される
   ことがある。** これを適用しないとMediaPipeに横倒しの画像を渡すことになり
   姿勢推定が崩れる。`cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)`で対応済み。
6. **iPhoneの動画はHEVCで録画されることが多く、backend-coreのOpenCVがデコード
   できないことがある**（model-studio側にも同種の既知問題があった）。
   `expo-camera`の`recordAsync({ codec: 'avc1' })`でiOS側にH.264を強制している
   （`codec`オプションはiOSのみ有効）。
7. **`model-studio`はローカルリポジトリのファイルとAzure実機のデプロイ内容が
   ズレることがある**（`deploy.ps1`は手動zipデプロイで、デプロイし忘れ・
   部分的な更新が起こり得る構成）。ローカルのコードを読んで移植しても、
   Azure実機と結果が一致しない場合は、まずmd5ハッシュ等でファイルの中身が
   本当に同じか比較すること（詳細は`notes/ai-count-debug-memo.txt`）。

### 実装状況

| 場所 | 内容 | 状態 |
| ---- | ---- | ---- |
| `backend-core/app/core/pose.py` | 1フレーム（OpenCVの生配列）→`pose_world_landmarks`抽出。legacy API（`mp.solutions.pose.Pose(static_image_mode=False, model_complexity=1)`）使用 | ✅ 実装済み・model-studio本番APIと数値一致まで検証済み |
| `backend-core/app/core/pose_analysis.py` | 関節定義・角度計算（`JOINT_DEFINITIONS_JA`・`angle_at`・`compute_joint_angles`） | ✅ 実装済み・動作確認済み |
| `backend-core/app/core/rep_model.py` | model-studio`rep_model.py`から**推論に必要な部分のみ**移植：`count_with_template`（1レップ形状テンプレート照合＋ヒステリシス）・`joint_series_from_frames`・`model_from_dict`等 | ✅ 実装済み・実データ（スクワット動画）でmodel-studio本番APIと完全一致（回数・ROM・採用サイクル区間まで一致）を確認済み（2026-08-24の統計ゲート廃止より前の状態での検証。廃止後も同じ動画で同じ回数・区間になることは再確認済み） |
| `POST /exercises/{exercise_id}/count-reps` | 動画アップロード→バッチ解析→結果を返す。`def`（非async）でスレッドプール実行、JWT認証必須。フレーム単位の永続化はしない。毎フレームの関節角度・各サイクルの採用/棄却理由をuvicornのターミナルに出力 | ✅ 実装済み・実機（スマホアプリ）での録画→アップロード→解析→表示の通しテスト済み |
| `rep_count_models`テーブル・`GET /exercises/{id}/rep-model`・`scripts/import_rep_model.py` | ストリーミング版から変更なし、そのまま再利用 | ✅ 実装済み（スクワットのみデータ投入済み） |
| `frontend/app/(screens)/workout-camera.tsx` | `expo-camera`の録画機能で動画を録画→`count-reps`へアップロード→結果表示。実装確認用に「ライブラリから選ぶ」ボタンも追加（既存動画で再テスト可能）。**本番導線（2026-08-24、リアルタイム版への一時切り替え→問題判明により差し戻し）** | ✅ 実装済み・実機テスト済み |
| `frontend/services/exercises.ts`の`countRepsFromVideo` | `FormData`でのmultipartアップロード | ✅ 実装済み |
| `frontend/app/(tabs)/workout.tsx`の`handleStart` | 遷移先は`workout-camera`（バッチ版）。2026-08-24中に一時`workout-camera-live`（リアルタイム版）へ変更したが、実機テストで判明した制約（下記「リアルタイム版」節参照）とAIレビュー機能優先の判断により、同日中にバッチ版へ差し戻し、リアルタイム版自体も削除した | ✅ 実装済み |

### 残っている論点

- カウント結果のDB保存（`session_sets.ai_counted_reps`/`rep_cycles_json`）はAIレビュー機能実装（2026-08-24）で対応済み（`addSessionSet`/`updateSessionSet`）
- 複数種目対応（今日のメニューに較正済み種目が複数あっても最初の1つしか案内しない制約）は保留のまま
- 動画アップロードのファイルサイズ・処理時間の上限は未検証（長時間の録画だとMediaPipe処理に時間がかかる想定。ユーザー指定で「終了ボタンまで録画」とし自動停止時間は設けていない）
- デバッグ用に追加した`debug_uploads/`保存機能・Docker検証環境（`Dockerfile`・`docker-compose.yml`のbackend-coreサービス・requirements.txtの`gunicorn`）は調査用。今後片付けるか、検証環境として残すか要判断

### リアルタイム版（2026-08-24: 設計・実装・実機テスト → 削除）

2026-08-24中に、WebSocketベースのリアルタイム版（`StreamingRepCounter`・
`app/routers/exercises_ws.py`・`frontend/services/pose-ws.ts`・
`frontend/app/(screens)/workout-camera-live.tsx`等）を設計・実装し、一時的に
本番導線にもした。実機テストの結果、`takePictureAsync`連写方式に起因する
シャッター音・低フレームレートでの精度不足（速い動作・ハーフレップへの耐性が
低い）が判明し、根本解決には`react-native-vision-camera`等への移行（Expo Go
が使えなくなりカスタムdev clientが必要な大きめの変更）が要ることが分かった。

**ユーザー判断により、リアルタイム版は同日中に削除した。** バッチ版
（`workout-camera.tsx`）が唯一の本番導線に戻っている。理由：①上記の精度課題の
根本解決の規模が大きいこと、②それよりAIレビュー機能・セット管理フローの改善
（アプリの中核価値）を優先すべきと判断したこと。

**このプロジェクトはgitリポジトリではない**ため、削除したコードは
`c:\HAL名古屋\kinpoyo\_backup\realtime-ai-count-2026-08-24\`にバックアップして
ある（`streaming_rep_counter.py`・`frame_warnings.py`・`exercises_ws.py`・
`workout-camera-live.tsx`・`pose-ws.ts`）。再度着手する場合は、設計方針
（WebSocket・因果的ヒステリシス閾値・実時間ベースのギャップ判定・警告機能等）
・実機で判明した制約（シャッター音・低フレームレート耐性）は上記バックアップの
コード内コメントと、このファイルの過去のgit差分に相当する情報が無いため、
着手前に一からその場で再設計すること（詳細な設計判断の記録はバックアップの
コード内docstringに残っている）。`app/core/pose.py`の`extract_frame_analysis`/
`FrameAnalysis`（リアルタイム版専用に追加していた関数）も同時に削除済み。
`main.py`から`exercises_ws`ルーターの登録も削除済み。

## AIレビュー機能（2026-08-24実装・実機テスト待ち）

AI回数カウント（バッチ版）の計測結果をもとに、DeepSeek APIでコーチ風のフォームレビュー文章を生成する機能。設計方針は`notes/ai-review-design-memo.txt`参照。

### 基本方針

- **「判定」と「文章生成」を分離する。** 深さ・テンポの良し悪しは決定的なロジック（閾値比較）で判定し、AIには「その観点についてコーチ風の自然な文章にする」ことだけをやらせる。AIに判定させない
- **ベース＋パーツ差し替え方式。** ベースプロンプトは固定・共通（コード内定数）。観点ごとの差し替え文言（パーツ）は`ai_review_prompt_parts`テーブルで管理し、該当する観点のパーツを複数選んで結合する

### スキーマ

- `session_sets.rep_cycles_json`（JSONB）：count-repsのサイクル内訳を要約保存（`period`はフレーム数ではなく**秒に変換して**保存する。`app/schemas/exercise.py`の`RepCycleJson`参照）
- `ai_reviews.matched_part_codes_json`（JSONB）：生成時に選ばれたパーツcodeの配列（追跡用）
- 新規`ai_review_prompt_parts`テーブル：`code`（例：`squat_depth_shallow`）・`exercise_id`（NULL可＝種目共通）・`label_ja`・`prompt_fragment`・`is_active`。**`code`は`{種目}_{観点}_{方向}`という命名規則**（判定ロジックがサフィックス一致でパーツを検索する）
- `ai_reviews`は`pose_records`と異なり変更禁止の対象外（担当者本人が設計・実装を兼任）。`PoseRecord`・`pose_records`には一切触れていない

### 判定ロジック（`app/core/review_judge.py`）

- 深さ：`session_sets.rep_cycles_json`の`accepted=true`サイクルの`bottom_deg`平均を、`rep_count_models.config_json["cycleStats"]["bottomDeg"]`（較正済み帯域）の上限と比較。超えていれば`depth_shallow`、それ以外は`depth_good`
- テンポ：`period_sec`平均を固定しきい値`TEMPO_FAST_THRESHOLD_SEC = 1.5`と比較（model-studio側にテンポの較正データが無いため、一般的な目安の定数。実測値に基づく較正ではない）。それ未満なら`tempo_fast`、それ以外は`tempo_good`

### プロンプト・API（`app/core/review_prompt.py`・`app/core/deepseek_client.py`）

- ベースプロンプト（固定、日本語、コーチ口調指定）＋選ばれたパーツの`prompt_fragment`＋実測値（採用/棄却数・平均角度・平均テンポ）を組み立ててDeepSeek API（`deepseek-chat`）へ送る
- DeepSeek APIはOpenAI互換のREST APIのため、SDKは使わず`requests`で直接`POST https://api.deepseek.com/chat/completions`を呼ぶ（追加のSDK依存を増やさない判断）
- `DEEPSEEK_API_KEY`は`backend-core/.env`に設定（`app/core/config.py`、未設定でもアプリ起動は失敗しない設計。実際にレビュー生成を呼んだ時だけ500エラーになる）

### エンドポイント・フロントエンド

- `POST /workouts/{session_id}/exercises/{session_exercise_id}/generate-review`：該当種目の全セットの`rep_cycles_json`を集計→判定→プロンプト組み立て→DeepSeek呼び出し→`ai_reviews`に保存（既存があれば削除して作り直す＝再生成）して返す。有効な計測データが無ければ400
- カメラ計測完了時（`workout-camera.tsx`）に自動で`session_sets`へ保存する導線を追加（`ai_counted_reps`・`rep_cycles_json`。保存失敗はカウント結果表示を止めない）
- 結果画面の「AIレビューを見る」ボタン→専用画面`ai-review-result.tsx`（`TrainerAvatar`のAIトレーナーキャラクター＋`records.tsx`の「AIトレーナー」カードと同じ視覚言語で表示）

### 「カウント」と「フォーム評価」の分離（2026-08-24、重要な設計変更）

`app/core/rep_model.py`の`count_with_template`・`app/core/streaming_rep_counter.py`の`_evaluate_cycle`から、**統計ゲート（深さ・ROM）と形状ゲートの両方を「カウントするかどうか」の判定に使うのをやめた。**

**変更の経緯（2段階）：**
1. まず深さ・ROMの統計ゲート（`_passes_cycle_stats`によるreason="stats"棄却）を廃止。較正データ（cycleStats）の範囲から外れた深さでもカウントするようにした
2. その後、「形状ゲート（テンプレートとの距離）による棄却も同じ問題（カウントと評価の混同）を抱えている」「棄却された分もカウントした上で“良いフォーム／改善必要”に分類すべき」「AIレビューに“棄却”という概念を持ち込むのもおかしい」という指摘を受け、形状ゲートも「カウントの可否」から「品質ラベル付け」に用途を変更した

**現在の設計：** 測定可能な候補サイクル（形状ベクトルが計算できるもの）は**全て1回としてカウント**する。形状テンプレートとの距離（`shape_threshold`）は、カウントするかどうかではなく`form_quality`（`"good"` | `"needs_improvement"`）のラベル付けにのみ使う。カウントされないのは`counted=false`（点数が少なすぎて形状ベクトルすら計算できない＝測定不能）の場合のみ——これはフォーム評価ではなくデータ有効性の問題。

**関連するAPI・スキーマの変更（"accepted"/"rejected"/"棄却"という語を全廃）：**
- `RepCycleOut`/`RepCycleJson`：`accepted: bool` + `reason: str` → `counted: bool` + `form_quality: "good"|"needs_improvement"|None`
- `CountRepsResult`：`accepted`/`rejected` → `good_form_count`/`needs_improvement_count`（`count`は両者の合計＝測定可能だった全レップ数）
- WebSocketの`count`メッセージ：`rejected` → `good_form_count`/`needs_improvement_count`
- `app/core/review_judge.py`の`ReviewMeasurements`：`accepted_cycle_count`/`rejected_cycle_count` → `total_rep_count`/`good_form_count`/`needs_improvement_count`。`aggregate_cycles`は`counted=true`の全サイクル（良し悪し問わず）から深さ・テンポの平均を計算する
- AIレビューのベースプロンプト（`review_prompt.py`）からも「棄却」に相当する語を削除し、「総レップ数・フォームが安定していたレップ数・改善余地があったレップ数」という前向きな表現に統一
- フロントエンド（`services/exercises.ts`・`services/workout.ts`・`services/pose-ws.ts`・`workout-camera.tsx`・`workout-camera-live.tsx`）も同様にリネーム。表示文言も「採用/棄却」→「良いフォーム/改善余地あり」に変更

これによりmodel-studioとの「数値完全一致」はもはや保証されない（意図的な仕様分岐。model-studio本体は変更禁止のまま無変更）。実データ・エンドツーエンドで検証済み：深いスクワット（bottom=37.6°、較正範囲60.7〜111.6°を大きく外れる）・浅いスクワットを模したテストデータの両方が正しくカウントされ、AIレビューが「棄却」の概念を一切含まず深さ・テンポについて自然にコメントすることを確認。通常深さのケース（3回分）は回帰なく引き続き正しくカウントされることも確認済み。

> **⚠️ 注意（このスキーマ変更で実際に踏んだ落とし穴）**：`session_sets.rep_cycles_json`は
> JSONB列にPydanticモデルをそのまま保存しているため、フィールド名を変更（`accepted`/`reason`
> → `counted`/`form_quality`）すると、**変更前に保存済みの行が新しいバリデーションに
> 通らなくなり、`GET /workouts`が500エラーになる**（実際に発生・修正済み）。現状は
> 本番ユーザーデータが無い開発段階のため、古い形式の行の`rep_cycles_json`をNULLに
> クリアして対応した。今後この種のJSONB保存スキーマを変更する際は、既存行への影響
> （必要ならデータマイグレーション、または後方互換のデフォルト値）を先に検討すること。

### 妥当性ゲートの復活（2026-08-28、腕立て伏せモデル追加時に発覚・対応）

model-studioで新規に「腕立て（アレックス）」モデルを作成し（`monitored_joints`を
`右肘`/`左肘`のみに限定して較正、mae=0.0・exact_match_rate=1.0）、kinpoyoへ
`import_rep_model.py`で取り込んで実機テストしたところ、上記「棄却の廃止」の副作用が
2つ具体的に見つかった：

1. **姿勢準備の誤カウント**：腕立て伏せは録画開始→プランク姿勢を整える、という
   準備動作が録画に含まれやすい。model-studio側の学習データは`start_time_sec`/
   `end_time_sec`で範囲指定してトリミング済みだが、kinpoyo側の`count-reps`には
   トリミング機構が無く、録画全体（準備動作込み）を解析するため、`low`/`high`
   しきい値が準備動作の角度で歪んだり、準備動作自体が1レップとしてカウントされ
   得ることが判明。**対応：まずはUI側で「準備を整えてから録画開始を押す」運用で
   回避する方針**（アルゴリズム側の対応は保留）
2. **「変な動き」が"良いフォーム"と判定される**：実機で明らかにフォームが崩れた
   腕立て伏せを行ったところ`form_quality: "good"`と判定された。原因は
   `count_with_template`の品質判定が**主役関節（肘）の角度カーブのみ**を見ており、
   股関節・体幹の崩れ等は原理的に検出できないため（1関節ベースの軽量な閾値検出
   というアーキテクチャ自体の限界）。さらに検証の結果、**腕立て伏せと無関係な
   動きでも、肘が十分な振れ幅で一往復しさえすれば無条件にカウントされる**ことも
   判明（棄却廃止の設計上、ROM・周期の緩い条件を満たせば形状・統計ゲートに
   関わらずcounted=Trueになるため）。

上記2番目（無関係な動きの誤カウント）への対応として、`app/core/rep_model.py`に
**妥当性ゲート**（`_passes_validity_gate`）を追加した：

- `cycle_stats`（品質ラベル用、±25°マージン）とは別に、さらに緩いマージン
  （`_VALIDITY_GATE_EXTRA_MARGIN_DEG=40.0`・ROM倍率`(0.5, 2.0)`を`cycle_stats`の
  レンジにさらに掛ける）で「そもそもこの種目の動きらしいか」だけを判定し、これに
  外れる候補のみ`counted=False`にする（`info["invalid"]=True`も付与）
- `cycle_stats`自体・`shape_threshold`は**品質ラベル（good/needs_improvement）
  のみに使い続ける**（変更なし）。マージンを`cycle_stats`よりずっと広く取っている
  のは、深さ・テンポが多少ズレた本物のレップまで棄却してしまった旧設計
  （2026-08-24以前）の失敗を繰り返さないため——「明らかに別の動き」だけを弾く
  最後の砦、という位置づけ
- `app/routers/exercises.py`のデバッグprintも、`counted=False`の理由を
  「カウント外(別動作の可能性)」／「カウント外(測定不能)」で区別するよう変更
- 1番目（姿勢準備の誤カウント）は今回は未対応。UI側の運用回避で十分か、録画側の
  トリミング機構が必要かは今後実機テストで判断する
- `_VALIDITY_GATE_EXTRA_MARGIN_DEG`/`_VALIDITY_GATE_ROM_SCALE`は初期値であり、
  実機での腕立て伏せ検証を通じてチューニングが必要になる可能性がある

**追記（同日）**：角度帯・ROMのみの妥当性ゲートでは、腕立て伏せと無関係な
「変な動き」が実機でまだ通過することを確認。腕の曲げ伸ばしを伴う動きは種目が
違っても絶対角度・ROMが被りやすく、この2つだけでは判別力が弱いと判断。
以下2点を追加変更：

- マージンを縮小：`_VALIDITY_GATE_EXTRA_MARGIN_DEG` 40.0→**20.0**、
  `_VALIDITY_GATE_ROM_SCALE` (0.5, 2.0)→**(0.6, 1.6)**
- **形状テンプレート距離も妥当性ゲートに追加**（新定数
  `_VALIDITY_GATE_SHAPE_MULTIPLIER=1.6`。品質判定の`shape_threshold`より
  1.6倍緩い距離までは許容しつつ、それも超えたら棄却）。カーブの"形"は
  種目間でより差が出やすいため、角度帯・ROMより強い判別力を期待している
- これに伴い`count_with_template`内の距離計算（`template_distance`）を
  品質判定ブロックから妥当性ゲート呼び出しの直前に移動し、1回の計算結果を
  両方の判定で使い回すようリファクタ（`_passes_validity_gate`の引数に
  `dist`/`shape_threshold`を追加）
- 実機再検証はこれから（マージン値は依然として初期値であり、要調整の可能性あり）

**再修正（同日）**：角度帯マージン・ROM倍率の縮小（20.0/(0.6,1.6)）により、今度は
本物のレップまでカウントされなくなる逆方向の問題が実機で発生。**角度帯マージン・
ROM倍率は元の40.0/(0.5,2.0)に戻した**。判別力の強化は形状テンプレート距離
（`_VALIDITY_GATE_SHAPE_MULTIPLIER=1.6`、8/28に追加した分）側だけに委ねる方針に
変更。角度帯・ROMは「明らかに別の動き」だけを弾く最後の砦という当初の位置づけに
戻し、種目間の判別は形状（カーブの形）に任せる。実機再検証はこれから。

### 姿勢ゲートの追加（2026-08-28、立ったままの誤カウント対策）

上記の妥当性ゲート（角度帯・ROM・形状）を追加しても、**「立ったまま肘だけ曲げ
伸ばしする」ような、プッシュアップと無関係な動きが実機でまだカウントされる**
ことが判明。原因は肘の角度だけでは体全体の向き（立位かうつ伏せか）が分からない
ため。これに対応する姿勢ゲートを新設した：

- `app/core/pose_analysis.py`に`torso_orientation_deg`/`torso_orientation_series`
  を追加（kinpoyo側のみ・model-studioには無い概念）。肩の中点→股関節中点の
  ベクトルが垂直軸(y軸)から何度傾いているかを`pose_world_landmarks`から算出
  （0°=垂直、90°=水平）
- `app/core/rep_model.py`に`EXERCISE_POSTURE`（`exercise_id → "upright"|"prone"`
  の対応表。現状`{17: "upright"（スクワット）, 4: "prone"（プッシュアップ）}`）
  ・`_passes_posture_gate`（想定姿勢と実測の体幹の向きが大まかに合っているかの
  粗いチェック、`_POSTURE_UPRIGHT_MAX_DEG=55.0`/`_POSTURE_PRONE_MIN_DEG=35.0`）
  を追加。`count_with_template`に`torso_orientation`/`posture`引数を追加し、
  角度帯・ROM・形状の妥当性ゲートと同じ扱い（外れたら`counted=False`・
  `invalid=True`）で組み込んだ
- `EXERCISE_POSTURE`はmodel-studioの`config_json`とは無関係の**kinpoyo側だけの
  追加情報**（model-studio側の較正には姿勢の概念が無いため）。新しい種目を
  追加する際は、この対応表に1行追加する必要がある（追加し忘れると姿勢チェック
  はスキップされるだけで、エラーにはならない＝後方互換だが、対策が効かなくなる
  点に注意）
- **既知の限界**：`upright`/`prone`の2値だけでは、仰向け種目（ベンチプレス等、
  体幹はproneと同じく水平になる）を区別できない。対応する種目が無いうちは
  対応不要と判断し先送りしている。ベンチプレス等を追加する際は、体幹の向き
  だけでなく別の判別軸（例：顔・胸がカメラのどちら向きか）の追加を検討すること
- `app/routers/exercises.py`のcount-repsエンドポイントで`torso_orientation_series`
  を呼び出し、`EXERCISE_POSTURE`から該当種目のpostureを引いて渡すよう変更。
  デバッグprintにも`torso=X.X°`を追加
- 実機ログで動作確認済み：立ったままの動画（torso≈4.0°/5.1°、ほぼ垂直）で
  `count=0`となり正しく棄却された（プッシュアップの想定postureは"prone"で
  `_POSTURE_PRONE_MIN_DEG=35.0`未満のため）

### 姿勢不一致をAIレビューに反映（2026-08-28）

上記の姿勢ゲートで棄却された候補があっても、今までは結果画面に「カウント外」
と出るだけでAIレビューには一切反映されなかった。ユーザーから「別の種目をやって
いることをAIレビューに出してほしい」との要望があり対応：

- 棄却理由を区別するため、`app/core/rep_model.py`の`count_with_template`が
  付与する`info["invalid"]`に加えて`info["invalid_reason"]`
  （`"movement"`＝角度帯/ROM/形状の妥当性ゲート、`"posture"`＝姿勢ゲート）を
  追加
- `RepCycleOut`/`RepCycleJson`（`app/schemas/exercise.py`）に`invalid`/
  `invalid_reason`フィールドを追加（DB保存・API応答の両方に反映。既存行は
  デフォルト値`invalid=False`で後方互換）
- `app/core/review_judge.py`：`ReviewMeasurements`に`posture_mismatch_count`
  を追加。`aggregate_cycles`は`invalid_reason=="posture"`の候補数を
  カウント（品質評価とは別軸の情報として、実測値の平均計算には混ぜない）。
  `judge_aspects`は`posture_mismatch_count > 0`なら観点`"posture_mismatch"`
  を追加（良し悪しの対にはならない一方向の観点）
- `app/core/review_prompt.py`：ベースプロンプトの実測データに「種目と異なる
  姿勢・動きだった可能性がある候補: N件」を追加
- `scripts/seed_ai_review_prompt_parts.py`に種目共通パーツ`"code":
  "general_posture_mismatch"`（`exercise_id=None`）を追加・DB投入済み。
  「責めるのではなく確認を促す」トーンをprompt_fragmentで明示的に指定
- `app/routers/workouts.py`の`generate_review`：`total_rep_count==0`だけを
  理由にした400エラーを、`posture_mismatch_count==0`も同時に満たす場合のみ
  に変更（立ったままの動画しか無いセットでも、姿勢不一致の情報自体は伝える
  価値があるため、レビュー生成を続行できるようにした）
- フロントエンド（`services/exercises.ts`の`RepCycle`・`services/workout.ts`の
  `RepCycleJson`・`workout-camera.tsx`の保存処理）も`invalid`/`invalid_reason`
  を受け渡すよう対応。`tsc --noEmit`で型チェック済み
- 実機再検証はこれから（`generate-review`を呼んで実際にAIコメントが出るか
  確認が必要）

### AIレビューを「今回のセットのみ」に変更 + movement理由もレビューへ反映（2026-08-28）

ユーザーから2点要望があり対応：

1. **AIレビューの対象を「その種目の全セット」から「今回記録した1セットのみ」に変更**。
   `ai_reviews`テーブルは`session_exercise_id`にUNIQUE制約があり元々「1種目1件・
   再生成のたびに削除して作り直す」設計だったため、**スキーマ変更は不要**——
   `generate_review`（`app/routers/workouts.py`）に`set_id`クエリパラメータを
   追加し、指定時はその1セットの`rep_cycles_json`のみを集計するよう変更した
   （省略時は後方互換で従来の全セット集計にフォールバック）。フロントエンド
   （`services/workout.ts`の`generateAiReview`・`workout-camera.tsx`）は
   `lastSetIdRef.current`（今保存したセットのID）を渡すよう変更。
   **注**：これは2026-08-24の筋トレフロー刷新時点での意図的な設計
   （「1セットだけでなく、その種目でこれまでにやった全セットをまとめて評価する」）
   を覆す変更
2. **「movement」棄却理由（角度帯・ROM・形状の妥当性ゲート）もAIレビューに反映**。
   既存の`posture_mismatch`と対になる形で追加：
   - `review_judge.py`：`ReviewMeasurements.movement_mismatch_count`追加、
     `aggregate_cycles`が`invalid_reason=="movement"`の候補数を集計、
     `judge_aspects`は`movement_mismatch_count > 0`で観点`"movement_mismatch"`
     を追加
   - `review_prompt.py`：実測データに「種目と動きの形が大きく異なっていた
     可能性がある候補: N件」を追加
   - `seed_ai_review_prompt_parts.py`に種目共通パーツ`"general_movement_mismatch"`
     （`exercise_id=None`）を追加・DB投入済み
   - `generate_review`の400エラーガードを、`movement_mismatch_count>0`でも
     続行するよう拡張
   - **スコープ外とした点**：測定不能（`invalid_reason`が付かない、点数不足で
     形状ベクトル自体が計算できないケース）はレビューに反映していない。
     フォームの問題ではなく動画・トラッキングの技術的な問題のため、コーチ
     コメントの対象として毛色が違うと判断し対象外にした
- 実機再検証はこれから

### 映像の質・撮影環境の警告（2026-08-28、AIレビューを経由しない即時警告）

上記でスコープ外とした「測定不能（点数不足）」＝映像の質・撮影環境の問題に
ついて、ユーザーへ事前に設計案を提示（A案：即時警告／B案：AIレビュー経由）し、
**A案（AIレビューを経由しない、その場での即時警告）で承認を得て実装**。

- 判定材料は`pose_frames/total_frames`（姿勢検出率）。既に`count-reps`の
  レスポンスに含まれていた値をそのまま利用——DBスキーマ変更・マイグレーション
  一切不要
- `app/routers/exercises.py`に`MIN_POSE_DETECTION_RATE=0.5`（初期値、要調整）
  を追加。検出率がこれ未満なら`CountRepsResult.quality_warning`に警告文を
  設定（`app/schemas/exercise.py`にフィールド追加）
- AIレビュー（DeepSeek呼び出し）は経由しない。理由：posture/movement不一致
  （コーチ的な判断）と違い「撮影がうまくいっていない」という技術的な問題
  なので、後から遅れて伝えるより撮影直後にその場で伝えて撮り直しを促す
  方が実用的と判断
- フロントエンド（`services/exercises.ts`の`CountRepsResult`型・
  `workout-camera.tsx`）：結果画面の回数カウントカードの下に警告ボックス
  （`Colors.warningSubtle`/`Colors.warning`）を追加、`quality_warning`が
  あれば表示
- `tsc --noEmit`・Python構文チェックとも通過。実機再検証はこれから
  （`MIN_POSE_DETECTION_RATE=0.5`は初期値のため、要調整の可能性あり）

### 休憩画面に次のセットの予定回数を表示（2026-08-28）

`workout-camera.tsx`の休憩カード（休憩カウントダウン中／「次のセットへ」ボタン
の下）に、次に記録する予定セットの目標回数（登録時に設定した`reps`。
`ai_counted_reps`＝実測値とは別物）を表示するよう追加。

- `slotsRef`の要素に`reps: number | null`を追加（`fetchWorkout`で取得した
  `SessionSetOut.reps`をそのまま保持。新規作成セット＝計画外のおまけセットは
  `reps: null`）
- 次に埋める予定のセット（`slotsRef.current.find(s => !s.recorded)`）の`reps`
  を`nextSetReps`として算出し、`null`でなければ「次のセット予定: N回」を表示
- `tsc --noEmit`通過

## 筋トレフロー刷新（セット管理・休憩・全体レポート）（2026-08-24 設計・実装完了）

AI回数カウント機能がバッチ版で安定して動くようになったことを受けて、筋トレ実施中の
画面フロー全体を見直した。**2026-08-24に設計・実装・実機テスト前のAPI疎通確認まで
完了**（バックエンドはPythonスクリプトでエンドツーエンド検証済み。フロントエンドは
`tsc --noEmit`で型チェック済みだが、実機での操作確認はこれから）。スタイルは
`constants/theme.ts`のデザイントークン・既存画面と同じカードスタイルで統一済み。

### 解決した問題（今回の発端）

`workout-camera.tsx`で「もう一度撮る」を押して再録画すると、`count-reps`成功の
たびに毎回**新しいセット**を`POST .../sets`で作成してしまっていた（`add_set`は
`set_number = len(sets)+1`で常に追加する設計のため）。リトライするたびにセット数が
際限なく増える不具合があった。**修正済み**：`PUT /workouts/{session_id}/exercises/
{exercise_id}/sets/{set_id}`エンドポイント（`app/crud/workout.py`の`get_set`/
`update_set`、`app/schemas/workout.py`の`SessionSetUpdate`）を新設し、フロント
（`workout-camera.tsx`）は`lastSetIdRef`で「今のセットのDB ID」を保持して、
リトライ時はこのIDへPUT（上書き）、新しいセットに進む時だけリセットしてPOST
（新規作成）するようにした。テストスクリプトで「PUT後もセット数が1件のまま」を
確認済み。

### 新しいセットごとのフロー

```
録画 → count-reps → セット保存（新規 or 上書き、上記バグ修正込み）
  → 「レビュー生成中...」表示 → generate-review を呼ぶ
    （既存エンドポイントをそのまま流用。1セットだけでなく、その種目で
      これまでにやった全セットをまとめて評価する。新規テーブル不要）
  → カウント結果＋AIレビューを自動表示
  → 休憩画面へ
      - 今終えたセットにsession_sets.rest_after_secが設定されていれば
        カウントダウン表示 → 0で自動的にカメラ画面（ready状態）へ遷移
      - 未設定なら「準備ができたら再開」ボタンのみの画面
  → 「再開」ボタンで次セットの録画へ（target_setsに達したら完了を促す表示。
     複数種目への自動遷移は今回スコープ外・既存の制約のまま）
```

録画中（バッチ版）の警告表示（遠い/近い/全身が映っていない等）は**今回は見送り**。

### 休憩時間はセットごとにカスタム設定（2026-08-24、種目単位の一律設定から移行）

当初`session_exercises.rest_interval_sec`（種目単位で一律の休憩時間）で設計・実装
したが、「ボタンで追加：セットを追加の下に休憩を追加、セットの間にカスタムな休憩を
入れたい」というフィードバックを受けて**`session_sets.rest_after_sec`（このセットの
後に取る休憩時間・秒）へ移行**した。

- マイグレーション: `9f4c2b7e1a3d_add_rest_after_sec_to_session_sets.py`
  （`session_sets`に`rest_after_sec INTEGER NULL`を追加）
- `session_exercises.rest_interval_sec`列・スキーマは後方互換のため残すが、
  登録画面（新規）は書き込まなくなった。`workout-camera.tsx`は各セットの
  `rest_after_sec`が無い場合のみ`rest_interval_sec`にフォールバックする
- 登録UI（`workout-register.tsx`・`program_choice.tsx`編集モード）：セット行と
  休憩行を好きな順に積み重ねられるリスト形式。「セットを追加」ボタンの下に
  「休憩を追加」ボタンを並べ、押した順にセット・休憩が積み上がる（休憩の連続は
  UI側でブロック）。保存時にitems（セット・休憩混在の配列）を歩いて、各セットの
  直後に置かれた休憩の秒数をそのセットの`rest_after_sec`として`sets`配列へ変換する
- `workout-camera.tsx`：`slotsRef`の各スロットに`restAfterSec`を持たせ、
  セット保存直後（`uploadAndCount`内）に「今保存したセットの`restAfterSec`」を
  `currentRestSec`にセットする（種目全体で固定ではなく、セットごとに変わる）
- 休憩時間の入力UI（2026-08-24さらに変更）：当初「秒/分」をタグ（トグルボタン）で
  切り替える方式にしたが、「タグ選択ではなく入力欄が『○分○秒』みたいにしてほしい」
  というフィードバックを受けて、分の入力欄と秒の入力欄を常時2つ並べる方式に変更した
  （`RestItem`型は`{ minutes: string; seconds: string }`。保存時は
  `mins*60 + secs`で`rest_after_sec`に変換。編集モードで既存データを読み込む時は
  `rest_after_sec`を`Math.floor(sec/60)`分・`sec%60`秒に分解して表示する）

### 実機フィードバックでの追加修正（2026-08-24）

最初の実装後、実際に触ってみて見つかった問題を修正：

1. **「停止」後に「再開」ボタンが出ず「終了」になっていた** — `(tabs)/workout.tsx`
   は`in_progress`なら常に「筋トレを終了する」を表示していた。修正：全種目の
   AI計測対応セット（`target_sets`分の`ai_counted_reps`記録）が揃うまでは
   「筋トレを再開する」（`handleStart`を再利用）を表示し、揃って初めて
   「筋トレを終了する」を表示するよう`workoutAllDone`判定を追加した
   （AI計測非対応の種目は判定対象外＝常に完了扱い）
2. **セット数が筋トレ登録メニューから勝手に増える** — 二重の原因があった。
   (a) `workout-register.tsx`が`target_sets`を送っておらず常にnullだった、
   (b) `workout-camera.tsx`が録画のたびに常に**新しいセット**を作成しており、
   登録時に作った計画済みセット（重量・レップ数のみ入った空のセット）とは
   別に積み上がっていた。修正：登録画面はセット行数をそのまま`target_sets`として
   送るようにし、`workout-camera.tsx`は`slotsRef`で「未記録の計画済みセット」を
   検出して、まずそこへPUTで書き込む（無くなったら初めてPOSTで新規作成）ように
   変更。これにより編集画面（`program_choice.tsx`）で全セットを読み込んでも
   セット数が増えない
3. **休憩時間を登録する場所がなかった** — 上記「休憩時間はセットごとにカスタム
   設定」参照
4. **筋トレ終了後、同じ日にまた「筋トレを開始する」を押すと404/400エラー** —
   `(tabs)/workout.tsx`の`loadToday`が`cancelled`のみ除外し`completed`を
   除外していなかったため、終了済みセッションが「今日のメニュー」として残り、
   `POST /start`が「予定済みのセッションのみ開始できます」で失敗していた。
   修正：`completed`も除外するようにし、終了後は今日の画面が空状態に戻るようにした
5. **（付随して発見・修正）`GET /workouts/{id}`のセット順序が不定だった** —
   `session_to_out`が`se.sets`を`set_number`でソートしていなかったため、
   編集画面のセット表示順がリクエストのたびにズレる可能性があった。
   `crud/workout.py`・`routers/workouts.py`の両方で`set_number`ソートを追加

### 「停止」＝一時中断

- `workout_sessions.status`は変更しない（新しいステータスを追加しない。`in_progress`のまま）
- **「停止」ボタンは、セットの録画・アップロード・解析が完全に終わった後（休憩中
  or 次セット開始前の「ready」状態）でのみ表示する。録画中・アップロード中・
  解析中・レビュー生成中は「停止」できないようにする**（2026-08-24追加指示）
- 停止→確認モーダル→OKで`(tabs)/workout.tsx`へ戻る（終了APIは呼ばない、`in_progress`のまま）
- `(tabs)/workout.tsx`の`handleStart`を修正済み：セッションが既に`in_progress`なら
  `startWorkout`を呼ばずそのままカメラ画面へ再突入する（「次に録るべきセット」は
  `workout-camera.tsx`側で`fetchWorkout`して`session_exercise.sets.length`と
  `target_sets`から判断する）

実装：`showStopButton = canSaveResult && (state === 'ready' || (state === 'result'
&& !reviewLoading))`でボタン表示をガードしている（`recording`/`uploading`中、
および`result`状態でもAIレビュー生成中（`reviewLoading`）は表示されない。
2026-08-24、`'reviewing'`/`'resting'`という別画面状態は廃止し`'result'`に統合した
（下記「結果画面をスマホ1画面に統合」参照）。

### 登録画面でのキャンセル

- `(tabs)/workout.tsx`に「この筋トレをキャンセル」ボタン（未開始時のみ表示）を
  追加済み。確認モーダル→OKで既存の`cancelWorkout`（`DELETE /workouts/{id}`、
  `status=cancelled`）をそのまま呼ぶ。新規APIなし

### 筋トレ全体のレポート（新規テーブル。DATABASE.md 4.20参照）

「筋トレを終了する」ボタン押下→`POST /workouts/{id}/end`成功後に、自動で
`POST /workouts/{id}/generate-report`（新設）を呼び、レポート画面
（`workout-report-result.tsx`、AIレビュー結果画面と同系統のスタイル）を表示する。

- `planned_vs_actual_json`：種目ごとの`target_sets`対実績セット数・達成率（`app/core/session_report_judge.py`の`compute_measurements`で決定的に計算、AIに判定させない）
- 「前回の同じ筋トレとの比較」：同じユーザーで、同じ種目構成（exercise_idの集合が完全一致）を含む直近の完了済み`workout_sessions`を検索する`find_compared_session`（`app/core/session_report_judge.py`）。見つかった場合そのIDを`compared_session_id`に保存
- プロンプトパーツは既存`ai_review_prompt_parts`を流用（`exercise_id=NULL`＝種目共通、`code`は`session_`プレフィックス。`scripts/seed_ai_review_prompt_parts.py`に`session_achievement_good/low`・`session_improved`・`session_declined`の4件を追加済み）
- 判定しきい値：`ACHIEVEMENT_GOOD_THRESHOLD_PCT = 90.0`（達成率）、`IMPROVEMENT_TOLERANCE = 0.05`（前回比±5%未満は「変化なし」扱いで`improved`/`declined`どちらのパーツも付かない。2026-08-24時点では種目ごとの`weight_change_pct`の平均で判定。下記参照）
- **記録タブ（`records.tsx`）への反映・記録画面自体の改修は今回スコープ外**（後で実装）

#### レポート内容を総ボリュームから重量・レップ数・RPEの前回比較へ変更（2026-08-24）

当初`total_volume`（重量×レップの合計）の前回比較のみだったが、「総ボリューム数は
いらないかも。今回の実績と前回の同じ種目のデータを比較できるデータを入れてほしい
（RPE、重量改善率、重量・レップ数・RPEの比較）」というフィードバックを受けて変更：

- `app/core/session_report_judge.py`の`ExerciseAchievement`を`ExerciseComparison`に
  改名・拡張し、`total_volume`/`compared_total_volume`/`volume_change_pct`を
  `SessionReportMeasurements`から削除。代わりに種目ごとに
  `avg_weight_kg`/`avg_reps`/`avg_rpe`（今回、ウォームアップを除くセットの平均。
  `_avg_metrics()`ヘルパー）と`prev_avg_weight_kg`/`prev_avg_reps`/`prev_avg_rpe`
  （前回の同じ`exercise_id`のセットから同様に計算）、`weight_change_pct`
  （`(avg-prev_avg)/prev_avg*100`）を持たせた
- `judge_session_aspects`の`improved`/`declined`判定は、`volume_change_pct`ではなく
  種目ごとの`weight_change_pct`の平均値を使うよう変更（しきい値`IMPROVEMENT_TOLERANCE`
  は変更なし）
- `app/core/session_report_prompt.py`のプロンプトも、種目ごとに「重量 平均◯kg
  （前回◯kg・+◯%）／レップ数 平均◯（前回◯）／RPE 平均◯（前回◯）」の形式で
  埋め込むよう変更（前回データが無い種目は「前回データなし」と明記）
- `planned_vs_actual_json`のトップレベルに`has_comparison: bool`（前回の同じ種目
  構成セッションが見つかったか）を追加
- `workout-report-result.tsx`：種目ごとのカードに達成率＋重量/レップ数/RPEの
  今回・前回比較（変化率は色分け：上昇は緑、下降は赤）を表示。総ボリュームの
  カードは削除

#### 達成率・実績セット数のバグ修正（2026-08-25）

「5セットの予定で3セットしかやっていないのに、レポートで達成率100%・実績5セットに
なる」というバグ報告を受けて修正。原因：`actual_sets`が`len(se.sets)`（＝登録画面で
作られたセット**行数**）をそのまま使っていたため、AI計測未記録（`ai_counted_reps`が
null）の計画済みセットも「実施済み」に数えていた（登録時は`target_sets`分の行が
最初から全部作られる設計のため、行数は常に`target_sets`と一致してしまう）。

- `compute_measurements`にAI計測較正済み種目IDの集合`ai_tracked_exercise_ids`を
  渡すよう変更（routerで`exercise_crud.get_rep_count_model`を種目ごとに引いて
  作る）。AI計測対応種目は`ai_counted_reps is not None`のセットのみを実績として
  数え、非対応種目（現状マーク手段が無い）は従来通り行数のまま
- `_avg_metrics()`も同様に、AI計測対応種目は実際に記録されたセットのみを平均の
  対象にするよう修正（未記録の計画値が平均に混ざらないように）
- 影響範囲：`achievement_pct`・`overall_achievement_pct`・
  `avg_weight_kg`/`avg_reps`/`avg_rpe`（前回分も含む）

### AIレビュープロンプトの強化：RPE予測・停滞判定・プログラム連携（2026-08-25）

ユーザーフィードバック「重量扱いも大切に。最高重量登録でRPEが予測される。予測より
実測RPEが高ければプロンプトで考慮（重量下がったら対策を言う）。重い種目は重量更新に
時間がかかるので最後のrep数で確認し、一定なら加重を勧める。プログラムに参加していれば
その詳細データもAIに渡す」を受けて追加。3つの設計判断はユーザーに確認済み
（①%1RMベースのRPEチャートで予測、②停滞判定は直近3〜4セッションを見る、
③プログラム連携は詳細データまで本格的に渡す）。

**RPE予測（`app/core/rpe_predictor.py`、新規）:**
- `estimate_1rm(weight, reps)`：Epley式で推定1RM（`weight * (1 + reps/30)`）
- `get_prior_best_e1rm(db, user_id, exercise_id, exclude_session_id)`：今回より前の
  完了済みセッション全てから、その種目の生涯ベスト推定1RMを計算（今回は含めない
  ＝今回がPRでも%1RMが100%を超えられるように）
- `predict_rpe_from_pct_1rm(pct)`：%1RM→予測RPEの対応表（100%→RPE10、95%→9、
  90%→8、85%→7、80%→6、70%→5、60%→4）をアンカー点として線形補間。厳密な
  科学的根拠のある表ではなく簡略化した目安（ユーザー確認済み）
- `session_report_judge.py`の`ExerciseComparison`に`predicted_rpe`・
  `rpe_deviation`（`avg_rpe - predicted_rpe`）を追加。`RPE_HARDER_THRESHOLD = 1.0`
  以上なら「思ったよりきつかった」と判定し`session_rpe_harder_than_expected`
  パーツを使う。「重量が下がっている時は対策を言う」の部分は個別の判定コードに
  せず、`session_report_prompt.py`のベースプロンプトの注意書きでAIに指示する形にした
  （重量変化とRPE逸脱の組み合わせは種目ごとに文脈が違うため、Pythonで固定ルール化
  せずAIに判断を委ねた方が自然な文章になる）

**停滞判定（加重の提案）:**
- `_detect_plateau()`：直近`PLATEAU_LOOKBACK_SESSIONS=4`回（今回含む）分、この種目の
  「最後のセット」のレップ数・重量を集め、レップ数の差が`PLATEAU_REPS_TOLERANCE=1`
  以内かつ重量の差が`PLATEAU_WEIGHT_TOLERANCE_KG=2.5`kg以内なら停滞と判定
  （`PLATEAU_MIN_SESSIONS=3`件未満のデータしか無ければ判定しない）。「重い種目ほど
  重量更新に時間がかかるのは自然」という前提で、重量ではなくレップ数の余裕を
  主なシグナルにしている
- `ExerciseComparison.is_plateaued: bool`を追加。Trueなら`session_plateau_add_weight`
  パーツを使う

**プログラム連携:**
- `app/crud/program.py`に`get_active_user_program(db, user_id)`を追加
  （`status_id == STATUS_ACTIVE`、`join_program`側で1ユーザー1アクティブに制限済み）
- routerで参加中プログラムが見つかったら、`get_program_exercises`で現在の週/日の
  種目一覧も取得し、`session_report_prompt.build_program_context()`で
  「プログラム名・カテゴリ・難易度・進捗（◯週目◯日目）・本日の種目構成」を
  テキスト化してプロンプトに埋め込む
- **Big3なら補助種目を勧める、のような個別ロジックはPythonで書いていない**。
  プログラムの特性を踏まえた助言をしてよいとプロンプトで伝え、判断はAIの一般知識に
  委ねる方針（プログラムの種類ごとに対策をハードコードすると際限がないため。
  ユーザー確認済み：「本格的にプログラムの詳細データも渡す」）
- 動作確認：BIG3強化プログラム（`programs.id=3`、DBに実データ投入済み）に参加した
  状態でレポート生成→feedback_textにプログラム名・次回種目への言及が実際に
  含まれることを確認済み

**新規パーツ**（`scripts/seed_ai_review_prompt_parts.py`に追加。DB投入済み）：
`session_rpe_harder_than_expected`・`session_plateau_add_weight`。既存の
`session_improved`/`session_declined`の文言も「総ボリューム」→「重量」に修正
（2026-08-24の総ボリューム廃止時に文言更新が漏れていた）。

**フロントエンド**：`WorkoutSessionReportOut`の型に`predicted_rpe`/`rpe_deviation`/
`is_plateaued`を追加したが、専用UIはまだ無い（`feedback_text`の文章に自然に
反映される設計のため。数値を直接見せるカード等は今回スコープ外）。

### プログラム項目を独立したカードとして表示（2026-08-26）

ユーザーフィードバック「わかりやすくするために、全体的なAIレビューとプログラムと
いう項目をレビューに入れて：プログラムに関しての推奨、対策、コメントなど」を受けて
追加。DBスキーマ変更・追加API呼び出しなしのシンプル方式を採用（ユーザー確認済み）：

- `session_report_prompt.py`に`PROGRAM_SECTION_HEADING = "【プログラムについて】"`
  を追加。参加中プログラムがある場合のみ、`build_prompt()`が「まず全体レビューを
  3〜5文、そのあとこの見出しから始まる段落で推奨・対策・コメントを2〜4文」という
  出力形式をAIに指示する（`build_program_context()`側の「無理に毎回触れる必要は
  ない」という以前の緩い指示は、出力形式を固定した今回は撤廃）
- `feedback_text`自体は1本の文字列のまま（スキーマ変更なし）。
  `workout-report-result.tsx`の`splitProgramSection()`がこの見出し文字列で
  前後に分割し、全体レビューは既存の`aiCard`、プログラム部分は新設の
  `programAiCard`（「プログラムについて」ラベル付き）に表示する
- **見出し文字列はbackendとfrontendの両方にハードコードされている**ため、
  変更する場合は`session_report_prompt.py`の`PROGRAM_SECTION_HEADING`と
  `workout-report-result.tsx`の`PROGRAM_SECTION_HEADING`を両方直すこと
- 参加中プログラムが無い場合は`output_format_instruction`が空文字になり、
  従来通り単一の全体レビューのみが返る（プログラムカードは表示されない）

### 各セットのレビュー文は200文字以内（2026-08-24）

`app/core/review_prompt.py`の`BASE_PROMPT_TEMPLATE`に「必ず200文字以内」の指示を
追加し、加えて`PER_SET_REVIEW_MAX_CHARS = 200`定数を使ってrouter側
（`generate_review`エンドポイント）でも超過分を切り詰める安全策を入れた
（AI出力は文字数指示を厳密に守るとは限らないため）。**筋トレ全体のレポート
（`generate_session_report`）の`feedback_text`にはこの上限を適用しない**
（セット単位のレビューだけがスマホ画面に頻繁に表示されるため短くする、という
フィードバックの意図に合わせた）。

### 結果画面をスマホ1画面に統合（2026-08-24）

「回数カウント、AIレビューと休憩時間は同じ画面でいい」「休憩があってもスマホ
1画面に入るように」というフィードバックを受けて、`workout-camera.tsx`の結果画面
（`'result'`状態）を以下のように整理：

- 別画面だった「AIレビュー生成中...」（`'reviewing'`状態）と「休憩中」
  （`'resting'`状態）を廃止し、`'result'`1画面に統合。上から
  ①AIトレーナーのメッセージボックス（アバター32px＋タイトル、生成中はこの中に
  スピナー）②回数カウント結果③休憩セクション（自動カウントダウン、またはrest
  未設定なら「次のセットへ」ボタン）④もう一度撮る/完了ボタン、の順で縦に並べる
- AIレビュー生成は`await`で画面遷移をブロックせず、`generateAiReview(...).then(...)`
  の非同期チェーンにして即座に結果画面へ遷移するよう変更（`reviewLoading`state）
- 200文字上限（上記）により本文が短くなったことに加え、フォントサイズ・余白も
  詰めて1画面に収まりやすくした。それでも小さい端末では収まらない可能性があるため、
  `ScrollView`でも包んでいる（保険。基本は1画面に収まる設計）
- 直後のフィードバック「休憩時間はもっと大きくていい、白スペースが多いので画面を
  バランス良く埋めてほしい」を受けて再調整：回数カウント・休憩を`countCard`/
  `restCard`という独立したカード（`bgCard`/`primarySubtle`背景、角丸、影付き、
  横幅100%）にし、休憩の残り秒数も回数と同じ64pxの大きな数字で表示するように
  戻した。`resultScrollContent`は`justifyContent: 'center'`（中央寄せで余白が
  上下に偏る）から`justifyContent: 'space-evenly'`＋`gap: Space[4]`に変更し、
  各カードが画面の縦幅に均等に広がるようにした

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

| フェーズ | 期間   | 内容                                             |
| -------- | ------ | ------------------------------------------------ |
| Phase 1  | 〜6/27 | DB基盤・SQLAlchemyモデル・Alembic・シードデータ  |
| Phase 2  | 〜7/4  | 認証・ユーザー・種目マスター・ワークアウトAPI    |
| Phase 3  | 〜7/11 | 記録統計・プログラム・コミュニティーAPI + FE統合 |
| Phase 4  | 〜7/18 | AI機能（MediaPipe・Claude API）・E2Eテスト       |

### チーム総合確認（4回）

> 月曜・火曜・第2/第4土曜に実施。現状把握と計画再調整を目的とする。

| 回    | 日付                          | 目的                                                |
| ----- | ----------------------------- | --------------------------------------------------- |
| 第1回 | **2026-06-27（土・第4土曜）** | Phase 1 完了確認・DB基盤レビュー・Phase 2 着手調整  |
| 第2回 | **2026-07-07（火）**          | Phase 2 完了確認・API動作レビュー・Phase 3 着手調整 |
| 第3回 | **2026-07-11（土・第2土曜）** | Phase 3 中間確認・FE-BE統合状況・課題洗い出し       |
| 第4回 | **2026-07-14（月）**          | Phase 3〜4 最終確認・全体品質チェック・リリース判断 |

### フロントエンド修正・FE-BE 統合確認（Phase 3 内）

| #   | タスク                                             | タイミング             |
| --- | -------------------------------------------------- | ---------------------- |
| 73  | FE-BE 統合確認（認証・プロフィール・ワークアウト） | Phase 2 完了後・7/7前  |
| 74  | FE-BE 統合確認（記録・プログラム・コミュニティー） | Phase 3 完了後・7/11前 |
| 75  | フロントエンド修正（統合確認で発見した不具合対応） | Phase 3 内・随時       |
| 76  | E2E 動作確認（全画面フロー通し確認）               | Phase 4 内・7/14前     |

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

| メソッド | パス                    | 説明                         | 備考    |
| -------- | ----------------------- | ---------------------------- | ------- |
| POST     | `/auth/register`        | ユーザー登録                 |         |
| POST     | `/auth/login`           | ログイン・JWT返却            |         |
| GET      | `/auth/me`              | ログインユーザー取得         | JWT必須 |
| POST     | `/auth/forgot-password` | パスワードリセットメール送信 |         |
| POST     | `/auth/verify-code`     | コード検証（有効期限5分）    |         |
| POST     | `/auth/reset-password`  | 新パスワード設定             |         |

### ユーザー `/users`

| メソッド | パス                 | 説明                             | 備考 |
| -------- | -------------------- | -------------------------------- | ---- |
| GET      | `/users/me/profile`  | プロフィール取得                 |      |
| PUT      | `/users/me/profile`  | プロフィール更新（身長・体重等） |      |
| POST     | `/users/me/goals`    | 体重目標登録                     |      |
| GET      | `/users/me/goals`    | 目標一覧取得                     |      |
| GET      | `/users/search?q=`   | ユーザー検索                     |      |
| POST     | `/users/{id}/follow` | フォロー                         |      |
| DELETE   | `/users/{id}/follow` | フォロー解除                     |      |

### 種目マスター

| メソッド | パス                           | 説明                                  | 備考                   |
| -------- | ------------------------------ | ------------------------------------- | ---------------------- |
| GET      | `/exercises`                   | 種目一覧（部位・PPL・器具フィルター） |                        |
| GET      | `/exercises/{exercise_id}/rep-model` | AI回数カウント用の較正済み設定取得 | 未登録の種目は404      |
| POST     | `/exercises/{exercise_id}/count-reps` | 録画済み動画をアップロードして回数カウント（バッチ解析） | 認証必須。multipart（`video`ファイル）。未登録の種目は404 |
| GET      | `/masters/muscle-groups`       | 筋肉部位一覧                          | フロント色分けチップ用 |
| GET      | `/masters/movement-categories` | PPL分類一覧                           |                        |
| GET      | `/masters/equipment-types`     | 器具一覧                              |                        |

### ワークアウト `/workouts`

| メソッド | パス                                            | 説明                                             | 備考                  |
| -------- | ----------------------------------------------- | ------------------------------------------------ | --------------------- |
| POST     | `/workouts`                                     | セッション新規作成（カレンダー事前登録）         | `scheduled_date` 必須 |
| GET      | `/workouts?date=YYYY-MM-DD`                     | 日付別セッション取得                             | カレンダー表示用      |
| GET      | `/workouts/{id}`                                | セッション詳細取得                               |                       |
| PUT      | `/workouts/{id}`                                | セッション編集（種目・セット修正）               |                       |
| DELETE   | `/workouts/{id}`                                | セッション削除                                   |                       |
| POST     | `/workouts/{id}/start`                          | セッション開始（`started_at`設定）               |                       |
| POST     | `/workouts/{id}/end`                            | セッション終了（duration_sec・total_volume集計） |                       |
| POST     | `/workouts/{session_id}/exercises`              | 種目追加                                         |                       |
| POST     | `/workouts/{session_id}/exercises/{ex_id}/sets` | セット記録                                       |                       |
| PUT      | `/workouts/{session_id}/exercises/{ex_id}/sets/{set_id}` | セット上書き更新（録画リトライ用）      |                       |
| POST     | `/workouts/{session_id}/exercises/{ex_id}/generate-review` | 種目のAIレビュー生成（DeepSeek連携）  |                       |
| POST     | `/workouts/{session_id}/generate-report`        | 筋トレ全体のAIレビュー・実績レポート生成          | `status=completed`のみ |
| GET      | `/workouts/{session_id}/report`                 | 生成済みレポートの取得（再生成しない）            | 記録タブの履歴閲覧用    |

### 記録・統計 `/records`

| メソッド | パス                                        | 説明                               | 備考 |
| -------- | ------------------------------------------- | ---------------------------------- | ---- |
| GET      | `/records/summary?period=week\|month\|year` | ボリューム推移                     |      |
| GET      | `/records/max-weight?exercise_id=`          | 種目別最大重量                     |      |
| GET      | `/records/history`                          | 筋トレ履歴（部位・期間フィルター） |      |
| GET      | `/records/achievements`                     | プロフィール画面の実績（全期間累計） |      |
| GET      | `/records/big3`                             | BIG3の合計(1RM)（自動計算＋手入力の大きい方） |      |
| POST     | `/records/exercise-max`                     | 1RMの手入力登録             |      |

### プログラム `/programs`

| メソッド | パス                              | 説明                       | 備考                         |
| -------- | ---------------------------------- | -------------------------- | ---------------------------- |
| GET      | `/programs`                        | プログラム一覧             |                              |
| POST     | `/programs/{id}/join`               | プログラム参加             |                              |
| GET      | `/programs/{id}/exercises?week=&day=` | 週/日別の種目一覧        | 認証不要                     |
| GET      | `/user-programs/me`                | 自分の参加プログラム一覧   | 認証必須                     |
| PUT      | `/user-programs/{id}/status`       | 参加状態更新               |                              |
| POST     | `/user-programs/{id}/advance`      | current_week/dayを1進める  | 週の最終日を超えると次週へ   |
| POST     | `/user-programs/{id}/leave`        | プログラム離脱             |                              |

### My筋トレ `/workout-templates`（2026-08-25追加。Program系とは独立）

| メソッド | パス                              | 説明                                  | 備考 |
| -------- | ---------------------------------- | ------------------------------------- | ---- |
| POST     | `/workout-templates`               | テンプレート作成                       |      |
| GET      | `/workout-templates`               | 自分のテンプレート一覧                  |      |
| GET      | `/workout-templates/{id}`          | テンプレート詳細                        |      |
| PUT      | `/workout-templates/{id}`          | テンプレート更新（種目・セットは丸ごと作り直し） |      |
| DELETE   | `/workout-templates/{id}`          | テンプレート削除                        |      |
| POST     | `/workout-templates/{id}/apply`    | 指定日にテンプレート内容でセッション作成 | body: `{scheduled_date}` |

### コミュニティー `/posts`

| メソッド | パス                   | 説明                                 | 備考                  |
| -------- | ---------------------- | ------------------------------------ | --------------------- |
| POST     | `/posts`               | 投稿作成                             |                       |
| GET      | `/posts?type=feed`     | フィード一覧（全体・フォロー中切替） |                       |
| GET      | `/posts?type=qa`       | Q&A一覧                              |                       |
| PUT      | `/posts/{id}`          | 投稿編集                             |                       |
| DELETE   | `/posts/{id}`          | 投稿削除                             |                       |
| POST     | `/posts/{id}/likes`    | いいね                               | `likes_count` 更新    |
| DELETE   | `/posts/{id}/likes`    | いいね取り消し                       |                       |
| POST     | `/posts/{id}/comments` | コメント投稿                         | `comments_count` 更新 |
| GET      | `/posts/{id}/comments` | コメント一覧                         |                       |

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
- mediapipe>=0.10.30（AI回数カウント。Python 3.14対応のためmodel-studioより新しいバージョンを指定。`mp.solutions`旧APIは廃止済みなのでTasks API必須）
- opencv-python-headless（AI回数カウント：画像デコード）
- numpy（AI回数カウント：mediapipe/opencvの依存）

### フロントエンド（package.json）

- expo
- react-native
- typescript
- react-native-gifted-charts（折れ線グラフ・棒グラフ）
- react-native-linear-gradient（gifted-charts の依存）
- react-native-svg（gifted-charts が使用。以前AI回数カウントの骨格オーバーレイでも使っていたが、そのストリーミング版は廃止済み。直接依存としては残置）
- react-native-qrcode-svg（QRコード表示）
- expo-image-picker（投稿作成画面の画像添付：端末の写真ライブラリから選択）
- expo-secure-store（JWTトークンの保存。Web版は未対応のためservices/token-storage.tsでlocalStorageにフォールバック）
- expo-camera（AI回数カウント：`(screens)/workout-camera.tsx`で動画録画に使用。`mode="video"`・`recordAsync`/`stopRecording`、マイク権限も必要）

---

## 変更履歴

| 日付               | 変更内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-29         | 初期セットアップ：React Native (Expo) + FastAPI 環境構築                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-05-29         | ディレクトリ名変更：kinpoyo-app→frontend、backend→backend-core                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-29         | 初期セットアップ：React Native (Expo) + FastAPI 環境構築                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-05-29         | ディレクトリ名変更：kinpoyo-app→frontend、backend→backend-core                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-31         | AGENTS.md更新：プロジェクト概要・機能一覧・機能フロー・技術スタック・AIエージェント厳守事項を追記                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-01         | デザイントークン作成：styles/theme.css・styles/components.css・constants/theme.ts（白×明るいグリーン配色）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-06-01         | AGENTS.md更新：コミュニティー機能を機能一覧に追加                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-01         | Docker廃止：docker-compose.yml・backend-core/Dockerfile を削除。ローカル仮想環境（venv）で直接起動する構成に統一                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-19         | Docker再導入（DB限定）：PostgreSQL 16のみ docker-compose で起動する構成に変更。FastAPIはvenvのまま。docker-compose.ymlをkinpoyo/直下に配置                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-06-02         | ホーム画面実装：週間カレンダー・今日のトレーニング・体重・プログラムカード。5タブナビ（ホーム・コミュニティー・筋トレ開始・記録・プロフィール）。食事管理・ルーティン・ライブラリー・インターバルタイマーは除外                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-06-02         | explore.tsx削除。ホーム週カレンダーをスワイプ対応（8週先まで）・ボタン名を「ワークアウト登録」に変更・ヘッダーにカレンダーアイコン追加。calendar.tsx新規作成（月表示・色フィルター・前後月ナビ・筋トレ記録/修正ボタン）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-06-02         | 全画面mockup実装（サブエージェント2並列）。ホーム：ヒーローバナー・炎ストリーク・統計グリッド追加。コミュニティー：4タブ・投稿カード・FAB。記録：期間セレクター・AI週間レポート・曜日サークル・筋肉疲労度バー。プロフィール：ユーザーカード・実績4グリッド・BIG3・身体情報・設定。icon-symbol.tsx拡充                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-02         | ナビゲーション接続：ワークアウト登録→calendar、プログラムカード→program-ichiran、筋トレ登録→kintore-touroku。新規画面：kintore-touroku・program-ichiran・program-shousa1・program-shousa2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-02         | ホームのヒーローバナー削除。筋トレ登録：種目追加モーダル(PPL/部位別)・セット/種目×削除・空状態UI。カレンダー：ヘッダー2行構成・月タイトル小さく・筋トレ修正を中央ダイアログ化・削除をメイン一覧に反映。backend-core/DATABASE.md作成（16テーブルDB設計書）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-02         | フォルダー構成整理：app/直下の画面ファイルを `(screens)/` ルートグループに移動。URLパスは変更なし。\_layout.tsx のStack.Screen名を更新                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-06-02         | ファイル名を英語に統一・プログラム画面を `(screens)/program/` サブフォルダーにまとめる：kintore-touroku→workout-register、program-ichiran→program/index、program-shousa1→program/big3、program-shousa2→program/bodyweight。ナビゲーションルートも更新                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-07         | ホーム週カレンダーの曜日と日付のずれ修正（weekPage に paddingHorizontal: Space[4] 追加）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-06-07         | 画面ロール整理：登録はカレンダー・開始はnavタブ・ホームはダッシュボードに統一。ホームから「ワークアウト登録」ボタン削除                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-06-07         | 筋トレ開始タブ（workout.tsx）実装：今日の登録メニュー表示・サマリー・開始ボタン・未登録時の空状態UI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-06-07         | 記録タブ（records.tsx）全面実装：react-native-gifted-charts 導入（LineChart）・ボリューム推移・種目別最大重量・筋トレ履歴（絞り込み+モーダル）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-06-07         | 記録タブ 履歴モーダルを calendar.tsx の筋トレ修正モーダルと同一スタイルに統一（fade・中央ダイアログ・Radius.xl）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-07         | 記録タブ 筋肉部位チップを部位ごとの色分け対応（選択時：枠・背景・文字を部位色で表示）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-07         | コミュニティータブ全面実装：フォロー中(空状態・ユーザーID検索モーダル)・フィード(投稿一覧・ワークアウトサマリー表示)・Q&A(質問一覧)・お知らせ(admin投稿)・投稿詳細モーダル共通(サマリー4グリッド・種目セットテーブル・いいね・ブックマーク・コメント送信)・FABボタン                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-06-07         | コミュニティー投稿カードのインタラクション改善：いいねアイコンはその場で色変更のみ(グリーン)・コメントアイコンで詳細モーダルへ遷移。投稿詳細モーダルをフルスクリーン化＋useSafeAreaInsetsでノッチ・ホームインジケーター対応（Modal内SafeAreaView非対応の回避）。ユーザー検索モーダルから友達招待1+1カードを削除                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-06-07         | コミュニティーフィードカード：画像＋筋トレ実績を130×130正方形・水平スクロール対応(ScrollView horizontal)に変更。カード全体のTouchableOpacityをViewに変更し、タイトル・本文エリアのみタップで詳細遷移・画像エリアは独立スクロール可能に分離。FeedItemにimageCountフィールド追加                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-06-08         | 認証フロー（(auth)グループ）新規作成：login（ログイン/新規作成タブ切替）・forgot-password・verify-code・reset-complete・new-password・success（チェックマークアニメーション）。screenshots/user-auth/ のFigmaデザインに準拠、共通スタイル(theme.ts)を使用。機能は未実装（画面遷移のみのモック）。アプリ起動時のアンカーを (tabs) → (auth) に変更し、ログイン画面から起動するように。icon-symbol.tsx に eye/eye.slash/envelope/checkmark を追加                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-06-08         | カレンダー：絞り込みボタンを年月表示の上に移動し、年月（期間）を絞り込みボタンの下で中央ぞろえに変更（今日ボタンは右端に絶対配置）。筋トレ登録：種目選択モーダルのSafeAreaViewをuseSafeAreaInsetsによる手動paddingに置き換え（Modal内SafeAreaView非対応のため、ノッチ・ホームインジケーター部分が種目リストの上下と重なる不具合を修正。community.tsxのPostDetailScreenと同じ回避パターンを適用）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-08         | login.tsx のタブ切替UI（ログイン⇄新規作成）を廃止し、ログイン画面と新規登録画面を別ルートに分割（signup.tsx を新規作成、(auth)/\_layout.tsx に登録）。最初の画面は常にログインのみとし、画面下部の既存リンク「アカウントをお持ちでない方は 新規登録」（→ /signup）・「すでにアカウントをお持ちの方は ログイン」（→ /login）で行き来する構成に変更。ログインのパスワード欄に常時表示されていた赤色エラー枠（inputFocused）を削除。プレースホルダーを例示文言（きんぽよ太郎・contact@dscodetech.com）から項目名（ニックネーム・メールアドレス）に変更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-06-08         | オンボーディングフロー（(onboarding)グループ）新規作成：gender→height→weight→weight-goal→year→train-goalの6画面。screenshots/starter/ のFigmaデザイン（ポルトガル語）を日本語に翻訳して実装。共通コンポーネント OnboardingHeader（戻るボタン・進捗バー・タイトル・説明カード）と TrainerAvatar（assets/gif/personal-trainer.gif を expo-image の startAnimating/stopAnimating で1ループのみ再生）を新規作成。身長・体重・目標体重・生まれ年は ScrollView+snapToInterval の自作スクロールピッカーで実装。ログイン/新規登録ボタン押下で gender 画面へ遷移し、train-goal の「はじめる」で signIn を実行して (tabs) へ。ルートレイアウトの Stack.Protected に (onboarding) を追加                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-09         | weight.tsx 定規ピッカーの数字・目盛り描画を weight-goal.tsx に統一：全数字表示→10の倍数のみ表示・tickLabel に height:16 追加                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-06-09         | height.tsx・weight.tsx の単位切替を実装：cm↔ft（大数字・定規ラベルともに変換表示、cmToFtIn関数追加）・kg↔lbs（大数字・定規ラベルともに変換表示、kgToLbs関数追加）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-09         | weight-goal.tsx 差分バンド修正：zoneBand の位置計算をビューポート中央基準に修正（旧実装はスクロール内容の絶対座標のため画面外に描画されていた）・色を primarySubtle→primaryLight (opacity:0.7) の緑色に変更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-06-09         | weight.tsx→weight-goal.tsx へ体重・単位をルーターパラメータで渡す実装：router.push に params: { currentWeight, unit } 追加・weight-goal.tsx で useLocalSearchParams で受け取り、currentWeightKg・初期 unit に反映。大数字・現在体重ラベル・定規ラベルの kg/lbs 変換も対応                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-09         | オンボーディング完了フロー修正：train-goal.tsx の「はじめる」で signIn を直接呼ぶ代わりに /success へ遷移（params: { from: 'onboarding' }）。success.tsx で from=onboarding 時は signIn() を呼んで tabs へ、それ以外は /login へ。success.tsx のコンテンツを画面中央に修正（paddingTop → justifyContent: center）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-09         | login.tsx：ログインボタンを /gender（オンボーディング）→ signIn() 直接呼び出しに変更。オンボーディングは signup.tsx からのみ開始するよう修正                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-06-09         | ホーム画面（index.tsx）：体重カード・体重入力モーダル・関連ステート・未使用インポート（KeyboardAvoidingView/Modal/TextInput/Platform）・未使用スタイルを削除                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-06-11         | ホーム画面に「💡トレーニング知識」セクション追加（プログラムカードの下）：「筋肥大とは」「プログラム組み方」「RPEとは」の3カードから各詳細画面へ遷移。新規画面 `(screens)/program/hypertrophy.tsx`・`program-design.tsx`・`rpe.tsx` を追加（解説コンテンツのみ・ナビゲーションのみ）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-06-12         | カスタムプログラム画面（custom_program.tsx）の画面表示不具合および型エラーを修正。Expo Routerのネイティブヘッダーを非表示（headerShown: false）にし、theme.tsに準拠した独自ヘッダーへ統合。合わせて、解説画面3ファイル（hypertrophy.tsx、rpe.tsx、program-design.tsx）からも黒いヘッダー帯を排除し、統一感のある戻るボタン付きヘッダーへ修正。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-06-12         | 記録タブ（records.tsx）にAIトレーナーカードを仮実装：期間セレクター(週/月/年)の下に追加。TrainerAvatar + 期間別レビューコメント（aiComment関数、ボリューム推移の増減で簡易判定）。Claude API連携による本実装は今後対応                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-06-12         | 「AIアドバイザー」表記をすべて「AIトレーナー」に統一（records.tsx・AGENTS.md）。weight.tsx・weight-goal.tsx のBMI/目標カード内TrainerAvatarを28→56pxに拡大し、gender.tsx等の説明カードのアバターサイズと統一                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-06-12         | 筋トレ登録（workout-register.tsx）：種目選択モーダルの種目リストScrollViewに `flex: 1` を追加。フィルターチップ（全て・部位別すべて等）で表示件数が多い場合にリスト下部が画面外で切れてスクロールできなかった不具合を修正                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-12         | 通知モーダルを新規実装：`components/notifications-modal.tsx`（`NotificationsModal`、calendar.tsx筋トレ修正モーダルと同じfade・中央・Radius.xlスタイル、モック通知5件）。ホーム・コミュニティーの通知ベルボタン押下で表示。コミュニティーの通知ボタンをホームの円形`iconBtn`スタイル（36×36・bgCard・Shadow.sm）に統一（`s.notifBtn`）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-12         | オンボーディング（gender/height/weight/weight-goal/year/train-goal）の説明カードをrecords.tsxのAIトレーナーカードと同じ見出し構成に統一：TrainerAvatarの横に「AIトレーナー」タイトルを表示し、その下に説明文/コメントを表示するレイアウトに変更（OnboardingHeaderのdescCard）。weight.tsx・weight-goal.tsxは「AIトレーナー」タイトル＋サブタイトル（weight.tsxは"現在のBMI"、weight-goal.tsxはgoalMessageのheading）を表示（bmiCard、goalCard）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-06-12         | コミュニティー（community.tsx）：投稿から「筋トレサマリー」「種目リスト」を削除し、画像＋本文（タイトル/テキスト）のみのシンプルな構成に変更（投稿登録画面を作りやすくするため）。FeedItem型からworkoutSummary/exercises/ExerciseRowを削除、フィードカードは画像枚数(imageCount)があれば画像のみ横スクロール表示、投稿詳細モーダルからサマリーカード・種目テーブルを削除。いいね・コメント機能はそのまま維持                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-06-12         | コミュニティー：投稿詳細モーダルの画像表示を複数枚対応（main画像＋2枚目以降をサムネイル横スクロール、タップでmain切替）に変更。フィードに画像なし投稿(f3)を1件追加。投稿詳細ヘッダー右上の不要なinfoアイコンを削除                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-06-12         | コミュニティー：FABボタン（鉛筆アイコン）から投稿作成モーダル（`PostCreateScreen`、pageSheet）を開けるように実装。フィード/Q&Aを選択してタイトル・本文を入力、画像添付（モックプレースホルダー、最大5枚・追加/削除可）。投稿するとfeedData/qaDataの先頭に追加され該当タブに切り替わる。画像表示条件をpost.type==='feed'限定から!!post.imageCountに一般化（Q&A投稿でも画像表示可）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-12         | コミュニティー：投稿作成画面（PostCreateScreen）のレイアウトを調整し余白を解消。本文入力欄をflex:1で残りスペースいっぱいに拡大、画像添付プレースホルダーを80x80→110x110に拡大（追加ボタンのアイコンも28→36に拡大、削除ボタンも20x20→24x24に拡大）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-12         | コミュニティー：投稿作成画面の不具合修正。①画像添付プレースホルダーの削除（×）ボタンが横スクロール領域でクリップされて見切れる問題を、ボタン位置を画像の外側(top:-8,right:-8)から内側(top:6,right:6)に変更して解消。②入力欄フォーカス時にキーボードが出ると本文欄(flex:1)が圧縮され画像添付が不自然な位置に来る問題を、コンテンツ全体をScrollView化（contentContainerStyleでflexGrow:1、本文欄はflex:1+minHeight:100）し、キーボード表示時はフォーム全体がスクロールしてフォーカス中の入力欄が自動的に見える位置に収まるよう変更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-12         | 筋トレ登録（workout-register.tsx）：種目選択モーダルをコミュニティーのモーダルと統一し、全画面表示からpageSheet表示（`presentationStyle="pageSheet"`）に変更。Modal内の手動`useSafeAreaInsets`によるpaddingTop/paddingBottom指定を`SafeAreaView edges={['top','bottom']}`に置き換え                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-06-12         | 筋トレ登録：種目選択モーダルのヘッダーの「種目を選ぶ」タイトルが画面端に寄って詰まって見えるため、`marginLeft: Space[2]`を追加し少し右にずらして余白を確保                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-06-12         | カレンダー→筋トレ登録の日付連携：calendar.tsxの「筋トレ登録」ボタンでrouter.pushする際に選択中の日付（year/month/date）をパラメータとして渡すように変更。workout-register.tsxは`useLocalSearchParams`でこれを受け取り、指定があればその日付を、なければ本日の日付をdateLabelに表示                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-06-12         | 筋トレ登録：日付カードの「変更」ボタン（未実装のスタブ）を削除。日付はカレンダーから渡された値を表示するのみとし、changeBtn/changeBtnTextスタイルも削除                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-06-12         | 筋トレ登録：①日付カードの「変更」ボタンを復活させ、押すとカレンダー画面に戻る（router.back()）。②ヘッダーの「完了」ボタンを押すと筋トレ開始画面（/workout）に遷移するよう変更。③「筋トレを保存する」ボタンを押すと中央ダイアログ（centeredOverlay/centeredDialog）で「筋トレを保存しました」のお知らせモーダルを表示し、OKでカレンダーに戻る                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-06-12         | コミュニティー：ユーザー検索モーダルのMy ID Cardに「マイQRコード」表示ボタン（MaterialIcons qr-code-2）を追加。押すと中央ダイアログ（centeredOverlay/centeredDialog、workout-register.tsxの保存完了モーダルと同様のfade表示）でreact-native-qrcode-svgによるQRコード（user_kinpoyo、200px）・ユーザーID・閉じるボタンを表示。依存パッケージにreact-native-qrcode-svgを追加                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-06-12         | コミュニティー：①ヘッダー右上のアバターをTouchableOpacity化し、押すと`/profile`へ遷移するように修正。②マイQRコード表示で別の`<Modal>`を二重表示すると画面全体のボタンが反応しなくなる不具合を修正：QRコード用の独立Modal（centeredOverlay/centeredDialog）を廃止し、ユーザー検索モーダル内でヘッダータイトル・本文を「ユーザー検索」⇄「マイQRコード」に切り替える方式に変更（戻るボタンでQR画面→検索画面→モーダルを閉じる、の順に戻る）。centeredOverlay/centeredDialog/qrTitle/qrCloseBtn系スタイルを削除しqrContainerを追加                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-12         | icon-symbol.tsx（共通コンポーネント）の型エラー修正：`MAPPING`に対する誤った`as IconMapping`キャスト（`Record<SFSymbol, MaterialIconName>`で全SF Symbol名を要求してしまい不整合だった）を削除し`as const`に変更、`IconSymbolName`をMAPPINGの実際のキーから導出するように修正。存在しないSF Symbol名だった`'search'`キーを正しい`'magnifyingglass'`に変更し、community.tsx側の`<IconSymbol name="search">`も`name="magnifyingglass"`に更新。`npx tsc --noEmit`のエラーが0件になった                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-06-12         | コミュニティー：投稿作成画面（PostCreateScreen）①ヘッダー右上の「投稿」ボタンに`marginRight`を追加し、画面端から少し左にずらして表示。②画像添付をモックプレースホルダーから`expo-image-picker`による実機の写真ライブラリ選択に変更（最大5枚・複数選択・権限リクエスト・選択画像をプレビュー表示・×ボタンで削除）。依存パッケージに`expo-image-picker`を追加し、app.jsonのpluginsに写真権限の説明文（日本語）を設定                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-06-12         | コミュニティー：投稿した画像が一覧・詳細に表示されない不具合を修正。FeedItem型に`images?: string[]`を追加し、PostCreateScreenの`onSubmit`を画像枚数(number)ではなく選択した画像URI配列(string[])を渡すように変更。FeedTabのフィード画像・PostDetailScreenのmain画像/サムネイルで、`images`があれば`expo-image`で実画像を表示、なければ既存のモック用グレープレースホルダーを表示するように分岐（既存モック投稿の表示は変更なし）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-12         | コミュニティー：自分の投稿（`user === 'あなた'`）を編集・削除できるように対応。投稿詳細モーダルのヘッダー右上に編集（鉛筆）・削除（ゴミ箱）アイコンを追加。編集はPostCreateScreenを再利用し、タイトル・本文・画像を初期値として開き「投稿を編集」「更新」表記に切替（投稿先タイプ選択は編集時非表示・変更不可）。削除はネストしたModalを避けるため、PostDetailScreen内に画面内オーバーレイ（dialogOverlay/dialogBox、Radius.xl）で「投稿を削除しますか？」確認ダイアログを表示し、削除確定でfeedData/qaDataから該当投稿を除去して詳細モーダルを閉じる。CommunityScreenに`editingPost`・`postModalKey`状態を追加し、投稿作成・編集モーダルを1つに統合（`key`で都度マウントし直し、編集→新規作成時に前回入力が残らないようにする）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-12         | コミュニティー：編集・削除ボタンをアイコンから文字表記「編集」「削除」に変更し、投稿一覧（FeedTab）でも自分の投稿に表示されるように対応。投稿カードのアクション行を左（編集・削除テキストボタン、自分の投稿のみ）と右（いいね・コメント）に分割（postActionsLeft/postActionsRight、postActionsをjustifyContent: 'space-between'に変更）。削除確認ダイアログを`DeleteConfirmDialog`コンポーネントとして共通化し、投稿詳細モーダルでは画面内オーバーレイ、投稿一覧では新規追加した`deletingPost`状態によるtransparent Modal（ネストしたModal問題を避けるため、一覧画面では他のModalが開いていない時のみ表示される）として再利用                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-12         | コミュニティー：投稿検索機能を実装。ヘッダーの検索アイコン（虫眼鏡）押下で検索バー（テキスト入力＋クリアボタン）の表示/非表示を切替（押下中はアイコンが×に変化）。フィード・Q&A・お知らせの各タブで、入力文字列をタイトル・本文・投稿者名に対して大文字小文字を区別しない部分一致でフィルタリング（`filterByQuery`、リアルタイム反映）。該当なしの場合はFeedTabに検索結果なしの空状態（search-offアイコン＋メッセージ）を表示                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-13         | プロフィール・コミュニティーから「IDを登録してください」系のプロンプトを削除。profile.tsx：ユーザーカードの「IDを登録してアカウントを保護しましょう」リンク（idPrompt/idPromptTextスタイル含む）を削除。community.tsx：検索バー下の「コミュニティ機能を利用するにはIDを登録してください」インフォバナー（infoBanner系スタイル含む）を削除                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-13         | プロフィール画面：下部の「トレーニング記録」（カレンダー・マイメモ・エクササイズについて）・「設定」（通知設定・プライバシー設定・ヘルプ・お問い合わせ）リストを削除し、ユーザーカード・実績・BIG3・身体情報のみの構成に変更。未使用となったRECORD_ROWS/SETTING_ROWS/SectionRow/RowItem型・rowGroup系スタイル・未使用のReactインポートを削除                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| プログラム均等振分 | `(screens)/program/even_program.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ✅ 実装済み | 各分割法（PPL、上半身/下半身、その他分割）に対応した部位別（胸・肩・背中・腕・脚など）のカスタム種目選択・設定画面。チェックボックスUIでの複数選択に対応。 |
| 2026-06-27         | 新規画面 `even_program.tsx`（プログラム均等振分画面）の実装。`custom_program.tsx` から選択された分割法（PPL、上半身/下半身、4・5分割など）をパラメータとして安全に引き継ぎ、ヘッダーおよび対象部位タブを動的に切り替える仕組みを構築。<br>Figmaデザインに準拠し、ブックマークアイコンを排除してチェックボックス型UIおよび右側インフォアイコン（`info.circle`）を配置。画像ベースの主要種目に加えて「デッドリフト」「ハックスクワット」を追加。各分割法ごとの種目マージ連動（例：「上半身」に胸・肩・背中・腕をすべてマージ）を完全に実装。`constants/theme`（`Space`）の小数の型エラーおよび `useEffect` のeslint依存関係警告をすべて解消。                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 種目詳細設定       | `(screens)/program/program_choice.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | ✅ 実装済み | `even_program.tsx` から遷移。選択された各種目ごとに、セット数の追加・削除、および重量（kg）・目標レップ数を細かくカスタム設定する最終確認画面。            |
| 2026-06-19         | AGENTS.md・README.md・DATABASE.md 更新：バックエンドのディレクトリ構成を `app/` サブディレクトリ構成（models/旧モノリシックmodels.py→機能別ファイル分割）に修正。API一覧にPhase2〜3の全エンドポイントを追記。依存パッケージにsqlalchemy/alembic/python-jose/passlib等を追加。DATABASE.mdセクション6.1のファイル構成をモデル分割ファイル対応に更新                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-19         | AGENTS.md 更新：開発スケジュール・チーム総合確認（4回：6/27・7/7・7/11・7/14）・FE-BE統合確認タスク（#73〜76）を追加                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-06-27         | DATABASE.md 正規化評価・修正（Phase 1 完了確認）：`workout_session_statuses` マスターテーブル（3.11）を追加。`workout_sessions.status_id` FK追加。マスター計11テーブルに更新。ER図・リレーション一覧・マイグレーション手順・AGENTS.md を同期更新                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-07-10         | ユーザーAPI実装：`app/core/security.py`（bcryptハッシュ化・JWT発行/検証）・`app/core/deps.py`（get_current_user）新規作成。`app/schemas/user.py`・`app/crud/user.py`・`app/routers/auth.py`（register/login/me）・`app/routers/users.py`（profile取得/更新）実装、main.pyに登録。`.env`にSECRET_KEY等追加。動作確認中にpasslib 1.7.4がbcrypt 5.0.0のAPI変更(`__about__`属性削除)に対応できず例外になる不具合を発見、`bcrypt==4.0.1`に固定して解決                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-07-10         | 筋トレ・プログラム・コミュニティAPI実装：`app/schemas`・`app/crud`・`app/routers`に`workout.py`/`record.py`/`program.py`/`community.py`を追加、`users.py`にフォロー・検索を追加。main.pyに全ルーター登録。設計上の判断点（要レビュー）：①`POST /workouts`は種目・セットをネストして一括作成可能に拡張（workout-register.tsxが一括保存する作りのため。個別追加用の`POST .../exercises`・`.../exercises/{id}/sets`はAGENTS.md記載どおり別途維持）②`DELETE /workouts/{id}`はDATABASE.md 4.6の状態遷移表に従い物理削除ではなく`status_id=4(cancelled)`への更新として実装③`GET /posts`に`scope=all\|following`パラメータを追加（AGENTS.mdに厳密なパラメータ名の記載がなかったため設計で補完）④レスポンスに`status_code`/`exercise_name`等マスターの参照先を人間可読な形で埋め込み、フロント側でのID→ラベル変換を不要にした。`programs`テーブルはシードデータが無く空配列を返す状態（シード投入は今回のスコープ外）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-07-10         | ログイン・新規登録のフロントエンド結合：`frontend/services/api.ts`（共通APIクライアント、ベースURLは`EXPO_PUBLIC_API_URL`→`Constants.expoConfig.hostUri`→`localhost`の順で自動解決）・`services/auth.ts`（register/login/me呼び出し）・`services/token-storage.ts`（トークン保存、ネイティブは`expo-secure-store`／Webは`localStorage`）を新規作成。`hooks/use-auth.tsx`を`isLoggedIn`単独から`login`/`register`/`completeOnboarding`/`signOut`＋トークン復元(`isRestoring`)を持つ形に拡張し、`login.tsx`・`signup.tsx`をAPI呼び出し＋ローディング/エラー表示に対応、`success.tsx`は`signIn()`→`completeOnboarding()`に追従、`_layout.tsx`はトークン復元中`null`を返すよう修正。依存パッケージに`expo-secure-store`を追加。**設計判断**：新規登録時はトークンを保存するが`isLoggedIn`はオンボーディング完了までfalseのまま（Stack.Protectedがオンボーディングを飛ばさないようにするため）。**既知の制限**：オンボーディング未完了のままアプリを再起動するとトークンが復元され`(tabs)`に直行してしまう（オンボーディング完了フラグが別途無いため、スコープ外として許容）。**動作確認で発見した不具合**：`expo-secure-store`はWeb版で`getValueWithKeyAsync`が未実装で起動時に例外→アプリが真っ白になる問題を発見し、`token-storage.ts`でWeb時のみ`localStorage`にフォールバックする形で解決（Playwrightで signup→onboarding遷移・誤パスワードのエラー表示・正しいログイン→(tabs)到達までを実写確認済み） |
| 2026-07-10         | 筋トレ登録（1日単位の実績登録）のフロントエンド結合：バックエンドに`GET /exercises`（公開・認証不要、`GET /programs`と同パターン）を新規追加、`app/schemas/exercise.py`・`app/crud/exercise.py`・`app/routers/exercises.py`作成、main.pyに登録。フロントは`frontend/services/api.ts`（共通fetchラッパー）・`services/exercises.ts`・`services/workout.ts`を新規作成。`workout-register.tsx`を新規作成（種目データはハードコードではなく`GET /exercises`から取得、`POST /workouts`で保存）。`calendar.tsx`の「筋トレ登録」ボタンの遷移先を`/program`→`/workout-register`に変更し、`DUMMY_WORKOUT_DOTS`/`DUMMY_EDIT_DATA`を表示月分の`GET /workouts?date=`並列取得＋`GET /exercises`との結合による実データに置き換え。**設計判断**：`/program`（複数週間プログラムテンプレート）フローは別機能のため今回は触れていない。過去に削除・簡略化されたカレンダーの編集・削除・色フィルターモーダルは復活させていない（現行UIに存在しない機能の追加は今回のスコープ外と判断）。`hooks/use-auth.tsx`に`token`フィールドを追加（常に`null`。ログイン結合は別ブランチ`feat/login-signup-integration`で実施中のため、このブランチでは土台の型のみ用意）                                                                                                                                                                                                                                                             |
| 2026-07-10         | `feat/login-signup-integration`を`test2`にマージ（fast-forward）。筋トレ登録の作業を退避（stash）していたため復元時に`hooks/use-auth.tsx`と本ファイルで競合が発生し手動解決：`token`は常に`null`のスタブから、`login`/`register`/起動時復元で正しくセットされる本物の値に統合。実際に「ログイン→筋トレ登録」を試したところ`Not authenticated`エラーが発生し、原因は上記スタブが解消される前の状態だったことを確認。あわせて`components/ui/trainer-avatar.tsx`の不具合をPlaywright実写テストで発見・修正：`expo-image`の`stopAnimating()`はWeb版で内部のネイティブ参照が無く例外になる（呼び出し側の`?.`では防げない、ライブラリ内部の問題）ため、`Platform.OS === 'web'`時は呼び出さないようガード |
| 2026-07-10         | 筋トレ開始タブ（`(tabs)/workout.tsx`）の結合：`DUMMY_WORKOUTS`を廃止し、`GET /workouts?date=今日`＋`GET /exercises`（部位色join）で実データ表示に変更。**設計判断**：今日の登録が無い場合、従来の「カレンダーで登録する」ボタン（`/calendar`へ遷移）を廃止し、空状態メッセージ「今日のメニューは登録されていません」の下にその場で登録できるフォームを追加。フォームの見た目は`(screens)/program/program_choice.tsx`（セット/重量(kg)/レップ数/RPEのテーブル、赤丸削除バッジ）を踏襲し、RPE列を追加（`SessionSetCreate.rpe`は元から対応済み）。種目選択は`workout-register.tsx`と同じ`GET /exercises`ピッカー（Push/Pull/Legs・部位フィルター）。保存成功時は画面遷移せず`createWorkout`のレスポンスをそのまま表示に反映。`workout-register.tsx`・`calendar.tsx`・`program_choice.tsx`自体は変更していない（スタイルを参考にしたのみ、コード共通化はせず）。「筋トレを開始する」ボタンの実装（start/endライフサイクル）は引き続き未着手・別タスク |
| 2026-07-11         | トークン期限切れ時の自動サインアウトを実装。**不具合の背景**：`.env`の`ACCESS_TOKEN_EXPIRE_MINUTES=60`でJWTは60分失効するが、`hooks/use-auth.tsx`の起動時トークン検証はアプリ起動時に1回しか走らず、起動中に期限切れになっても`isLoggedIn`はtrueのままで401エラーが個別画面に表示されるだけだった。`services/api.ts`にモジュールレベルの`setUnauthorizedHandler`を追加し、token付きリクエストが401を受けた時に通知する仕組みを新設（token無しの`/auth/login`自体の401とは区別）。`use-auth.tsx`側でこのハンドラーに`signOut()`を登録し、401発生時に自動でトークン削除＋ログアウト。あわせて、`Stack.Protected`のガード切替だけでは（Web版で）画面によって`(auth)`グループ内の意図しないルート（`forgot-password`等）に着地することをPlaywright実写テスト（ネットワークインターセプトで401を強制発生）で発見したため、`signOut()`内で`router.replace('/login')`を明示的に呼ぶよう修正 |
| 2026-07-11         | ホーム画面へのカレンダー統合＋プログラム連携（軽量版）＋筋トレ開始/終了ボタンを実装。`(screens)/calendar.tsx`を削除し、月表示カレンダー・実データ取得・「筋トレ登録」ボタンを`(tabs)/index.tsx`に統合（週間ストリップとモック`registeredProgram`カードは廃止）。バックエンドに`GET /programs/{id}/exercises?week=&day=`・`GET /user-programs/me`・`POST /user-programs/{id}/advance`を追加（`schemas/crud/routers/program.py`）、`scripts/seed_demo_program.py`でBIG3プログラム（program_id=3、week1のprogram_exercises）を投入。ホーム画面で選択日に登録が無く参加中プログラムがある場合、「次のメニュー」を提案し登録すると`current_day`が進む（`services/program.ts`新規作成）。`(screens)/program/index.tsx`のBIG3/ボディウェイトカードタップ時に実際に`POST /programs/{id}/join`を呼ぶよう配線（名前一致するプログラムが無い場合は参加処理をスキップして遷移のみ）。`services/workout.ts`に`startWorkout`/`endWorkout`を追加し、`(tabs)/workout.tsx`の「筋トレを開始する」/「筋トレを終了する」ボタンを実装（完了後はduration/total_volumeを表示）。Playwrightで登録〜プログラム参加〜提案登録〜開始〜終了までの一連の流れを実写確認済み |
| 2026-07-11         | ホーム画面の選択日表示を修正：ユーザー確認の結果、選択日の実績（プレーンな`workoutItem`一覧）と提案（`suggestionCard`）を別々のカードで出す実装は意図と異なり、元の「本日のトレーニングメニュー」カードの見た目（タグバッジ＋タイトル＋種目行、`programCard`スタイル）に統一して1つのカードで表示するよう変更。また「筋トレ登録」ボタンをホーム画面から削除（登録は`(tabs)/workout.tsx`のインラインフォームのみに一本化）。この結果`workout-register.tsx`へ遷移する導線がアプリ内に無くなった（ファイル自体は削除していない、要判断） |
| 2026-07-11         | ホーム画面のトレーニングメニューカードにタップ導線を復元（会話履歴を確認し、削除前の`handleEditProgram`の実装を踏襲）：①登録済みメニューカードをタップ→`/(screens)/program/program_choice`へ遷移（`title`に選択日ラベル、`exercises`に実データの種目名配列をJSON化して渡す。ただし`program_choice.tsx`自体は未結合のため保存は引き続きモックのまま）。②空状態カード（トレーニングなし）自体をタップ可能にし、`/workout-register`へ遷移（独立した「登録」ボタンは置かず、カード全体をタップ対象にすることで前回の「ホームに登録ボタンは不要」という方針と両立）。バックエンドを`--host 0.0.0.0`で起動し直し、スマホ実機からのアクセス（従来`127.0.0.1`バインドで到達不能だった）に対応 |
| 2026-07-11         | ホーム画面（`(tabs)/index.tsx`）：ヘッダー右上の火（ストリーク）アイコンと数値バッジ、および「合計時間」「今週の筋トレ」の統計行を削除（`STREAK_COUNT`定数・`streakBadge`/`streakCount`・`statsRow`系スタイルを削除）。ヘッダーを3等分のflexレイアウト（左スペーサー・中央タイトル・右アイコン）に変更し、`appName`（kinpoyo）が右寄りに見えていたずれを修正して真の中央揃えに |
| 2026-07-11         | プログラム参加/中断の確認モーダル実装＋ホーム画面カードの完全統一。バックエンド：`crud/program.py`の`join_program`に、ユーザーが**別の**プログラムで`status_id=active`のレコードを持つ場合に`AlreadyHasActiveProgramError`（400「既に参加中のプログラムがあるため、新しいプログラムには参加できません」）を送出する制約を追加（同時に参加できるプログラムは1つまで）。`leave_program`関数＋`POST /user-programs/{id}/leave`（`status_id=4`＝`dropped`「中断」に更新）を新規追加。フロントエンド：新規共有コンポーネント`components/program-action-bar.tsx`を作成し、`(screens)/program/big3.tsx`・`bodyweight.tsx`の静的な「このプログラムを開始する」ボタン（`router.back()`のみのモック）をこれに置き換え。`fetchPrograms`+`fetchMyPrograms`から自分の参加状況を判定し、①未参加→「このプログラムに参加する」（確認モーダル：拒否/参加する）②別プログラムに参加中→「参加できません」（タップで通知モーダル、実際には参加処理を呼ばず自動的に却下。バックエンドの制約はその保険）③参加中（active）→「プログラムを中断する」（確認モーダル：拒否/中断する）④中断済み・完了済み→非活性表示、の4状態を出し分け。確認/通知モーダルは`community.tsx`の`DeleteConfirmDialog`と同じ画面内オーバーレイ（`dialogOverlay`/`dialogBox`、fade）パターンを踏襲。`(screens)/program/index.tsx`は参加処理をやめ、カードタップで詳細画面へ遷移するだけに戻した（参加/中断は詳細画面のボタンに一本化）。ホーム画面（`(tabs)/index.tsx`）：選択日の表示を「登録済みカード／未登録カード」の2択に単純化し、未登録カードは参加中プログラムの有無によらず常に表示。参加中プログラムがある場合はその下に別セクション「プログラムの筋トレメニュー登録」を追加し、タグバッジ・メタ行など提案専用の装飾を廃止して登録済みカードと同じ`programCard`スタイル（タイトル＋種目行＋登録ボタン）に統一（`cardHeader`/`tagBadge`/`tagBadgeText`/`suggestionMeta`スタイルは削除）。**既知の制約**：`bodyweight`（ボディウェイトワークアウト）は`programs`テーブルに未シードのため、詳細画面を開くと`ProgramActionBar`が該当プログラムを見つけられず「読み込みに失敗しました」の非活性ボタンになる（BIG3のみ実際に参加/中断が可能。シード投入は今回のスコープ外として未対応）。中断済み・完了済みプログラムへの同一プログラム再参加は`AlreadyJoinedError`によりサポート外（非活性表示のみ、スコープ外）。curlとPlaywrightでBIG3の参加→中断→別プログラムとの排他制御→ホーム画面の2セクション同時表示→提案登録までの一連の流れを実写確認済み |
| 2026-07-11         | 筋トレ開始タブ（`(tabs)/workout.tsx`）の表示をホーム画面と統一。ユーザー確認の結果、独自の`summaryCard`（種目数/セット数）＋`workoutCard`一覧＋その場登録フォーム（種目選択モーダル・セットテーブル）という現状の作りが「おかしい」との指摘を受け、ホーム画面（`(tabs)/index.tsx`）と同じ`programCard`スタイル（タイトル＋`exerciseRow`一覧）に統一。未登録時は独自フォームをやめ、`emptyCard`＋「筋トレメニュー登録」ボタンで`workout-register.tsx`へ遷移する形に変更（登録後は`router.back()`でこの画面に戻るため`useFocusEffect`で再取得するよう修正）。これにより`ExerciseOut`/`fetchExercises`・種目選択モーダル・セット入力テーブル関連のstate/styleを全て削除し、`fetchWorkoutsByDate`のみのシンプルな構成に。**「筋トレを開始する」/「筋トレを終了する」ボタンとその開始/終了ライフサイクル処理（`handleStart`/`handleEnd`/`startWorkout`/`endWorkout`）は今回未着手・変更なし**（ユーザーの指示により据え置き）。Playwrightで未登録→登録画面遷移→保存→ホーム同様のカード表示までを実写確認済み |
| 2026-07-11         | 筋トレ開始タブ：完了時の「お疲れさまでした！」`completedCard`（分・総ボリューム表示）を削除。あわせて、開始/終了ボタンの表示条件を`status_code === 'scheduled'`限定から`status_code !== 'in_progress'`に変更し、セッションが`completed`になった後もボタン（開始する）が表示され続けるよう修正（従来は`completed`時にどちらの条件にも合致せずボタンが消えていた）。`start_session`（`crud/workout.py`）は現在の状態に関わらず`status_id`を`in_progress`に更新するだけの実装のため、完了後に再度「開始する」を押しても安全に動作することをバックエンドコードで確認。Playwrightで登録→開始→終了→完了後もボタンが表示されることを実写確認済み |
| 2026-07-11         | カスタムプログラム作成を実データ化。ユーザー確認の結果、作成したカスタムプログラムは**作成した本人だけに表示**（`is_public=false`）とする方針で実装。バックエンド：`schemas/program.py`に`ProgramExerciseCreate`/`ProgramCreate`追加。`crud/program.py`に`create_program`（`Program(is_public=False, created_by=user_id)`＋`ProgramExercise`を`week_number=1, day_number=1`固定で一括作成、`Program.name`の`unique`制約違反は`ProgramNameTakenError`に変換）・`list_my_created_programs`（`created_by`一致で取得、公開/非公開を問わない）を追加。`routers/programs.py`に`POST /programs`（重複時400）・`GET /programs/mine`を追加。フロントエンド：`services/program.ts`に`createProgram`/`fetchMyCreatedPrograms`を追加。`components/program-action-bar.tsx`に任意の`programId`propを追加し、指定時は公開一覧(`fetchPrograms`)の名前検索をスキップして`fetchMyPrograms`の結果から解決するよう分岐（非公開プログラムに対応するため。既存の`big3.tsx`/`bodyweight.tsx`の呼び出しは無変更で動作）。`(screens)/program/even_program.tsx`のハードコードされた種目名配列（`CHEST_EXERCISES`等）を全廃し、`fetchExercises()`の実データから`muscle`/`movement`でタブ分け（部位別7部位・PPLは`movement`・上半身下半身はmuscleグルーピング）する実装に書き換え、選択状態も種目名からexercise `id`ベースに変更。`(screens)/program/program_choice.tsx`に`mode==='custom'`分岐を追加（既存のホーム画面「登録済みメニュー編集」導線からの呼び出しは無変更）：プログラム名入力欄・`createProgram`→`joinProgram`（自動参加）による保存・重複エラーのインライン表示を実装。`(screens)/program/index.tsx`：「カスタムプログラムを作成」タップ時に参加中プログラムの有無を確認し、あれば中断確認ダイアログ（`community.tsx`の`DeleteConfirmDialog`と同じ画面内オーバーレイパターン）を表示してから遷移するゲートを追加。新規セクション「あなたが作成したプログラム」（`fetchMyCreatedPrograms`）を追加。新規画面`(screens)/program/custom-detail.tsx`を作成し、作成済みプログラムの詳細（説明・種目一覧）と`<ProgramActionBar programName programId>`（中断ボタン）を表示。Playwrightで、参加中プログラムがある状態でのゲート表示→中断→PPL選択→実データの種目選択→プログラム名入力→保存→自動参加→一覧の「あなたが作成したプログラム」に表示→詳細画面での種目一覧・中断ボタン表示までを一通り実写確認済み |
| 2026-07-11         | ホーム画面のカレンダー：登録済み日の色ドットを、種目の`muscle_color`を最大3つ並べる方式から、登録有無のみを示す単色（緑）の丸1つに変更（`getDotsForCell`→`hasWorkoutForCell`のbool判定に簡略化、`dot`スタイルに`Colors.primary`を固定指定） |
| 2026-07-11         | 筋トレ開始タブ（`(tabs)/workout.tsx`）：今日のトレーニングメニューカードをタップ可能にし、ホーム画面の「登録済みメニューをタップして編集」と同じ導線（`/(screens)/program/program_choice`へ`title`/`exercises`を渡して遷移）で編集できるよう対応（`handleEditMenu`追加） |
| 2026-07-11         | プロフィール画面にログアウトボタンを追加。実績セクションの下に赤枠のボタンを配置し、タップで確認モーダル（`program-action-bar.tsx`等と同じ画面内オーバーレイ・fadeパターン）を表示、承認すると既存の`useAuth().signOut()`（トークン削除＋`/login`へ`router.replace`）を呼ぶ。`icon-symbol.tsx`のMAPPINGに`'rectangle.portrait.and.arrow.right': 'logout'`を追加。Playwrightでログアウト→ログイン画面への遷移を実写確認済み |
| 2026-07-11         | 不具合修正：「筋トレメニューを編集したのに更新されない」。原因は`(screens)/program/program_choice.tsx`の登録済みメニュー編集時の保存処理が`console.log`+`alert`のモックのまま一度もAPIを呼んでいなかったこと。バックエンドに種目一括置換用のエンドポイントが無いため、`DELETE /workouts/{id}`（キャンセル）→`POST /workouts`（編集後データで新規作成、同じ`scheduled_date`）という既存エンドポイントの組み合わせで実装（バックエンド変更なし）。`services/workout.ts`に`fetchWorkout`/`cancelWorkout`を追加。`program_choice.tsx`に`mode==='edit'`を追加し、`sessionId`パラメータから`fetchWorkout`で実データ（種目ID・重量・レップ数・RPE含む）を取得してフォームを初期化するよう変更（従来はダミー値60kg/10回/RPE8で初期化していた）。すべて削除して更新すると、その日のメニューを空にする（作成をスキップし、キャンセルのみ実行）。呼び出し元の`(tabs)/index.tsx`の`handleEditRegisteredMenu`・`(tabs)/workout.tsx`の`handleEditMenu`を、種目名配列を渡す方式から`sessionId`を渡す方式に変更。Playwrightで、種目を編集（重量変更）→保存→画面遷移後に再取得して変更が反映されていることを実写確認済み |
| 2026-07-11         | 不具合修正：筋トレメニューの重量表示に不要な小数点（例：`80.00kg`）が出る問題。原因はバックエンドのDecimalフィールド（`weight_kg`・`rpe`・`total_volume`）がJSON上で`"80.00"`のような文字列として返るため、フロントエンドで`String()`するとそのまま表示されていたこと。新規`frontend/utils/format.ts`に`formatDecimal()`（数値変換して末尾の0を除去：`80.00`→`80`、`62.50`→`62.5`）を追加し、`(tabs)/index.tsx`（ホーム画面の種目行）・`(tabs)/workout.tsx`（筋トレ開始タブの種目行）・`(screens)/program/program_choice.tsx`（編集画面の初期値）の3箇所に適用。`services/workout.ts`の`SessionSetOut.weight_kg`/`rpe`・`WorkoutSessionOut.total_volume`の型を実際のレスポンス形式に合わせて`string | number | null`に修正。Playwrightで各画面の重量表示・編集画面の入力初期値が小数点なしになることを実写確認済み |
| 2026-08-13         | `model-studio/AGENTS.md`新規作成（完成済み・変更禁止の明記、本アプリとの関係を整理）。AI回数カウント機能について、Azureクラウドを使わずbackend-coreでローカル処理する設計をユーザーと協議のうえ確定し、本ファイルに新セクション「AI回数カウント機能 — 設計確定・実装前」を追加（backend-core=MediaPipeで関節角度算出のみ、frontend=repCount.ts移植版でカウント判定、WebSocketで接続、`rep_count_models`テーブル新設予定）。コード・マイグレーションは未着手 |
| 2026-08-13         | AI回数カウント機能：backend-core側を実装（frontendは未着手）。`app/core/pose.py`・`app/core/pose_analysis.py`新規作成、`rep_count_models`テーブル追加（SQLAlchemyモデル・schema・crud・Alembicマイグレーション`f3a1c9b2e7d4`）、`GET /exercises/{exercise_id}/rep-model`・WebSocket`/ws/pose`を追加。requirements.txtに`mediapipe>=0.10.30`・`opencv-python-headless`・`numpy`追加。**実装中に判明した重要な制約2点をAGENTS.mdの当該セクションに記録**：①mediapipe 1.0系では旧API(`mp.solutions.pose`)が廃止されており新Tasks API(`PoseLandmarker`)必須、②プロジェクトパスの日本語（`HAL名古屋`）によりMediaPipeの内部C++層がファイルパスを開けず`FileNotFoundError`になるため、モデルは`model_asset_buffer`（読み込み済みバイト列）で渡す実装にした。mediapipe/opencv/numpyをvenvにインストールし、ダミー画像・ダミーランドマークでポーズ検出器の初期化〜角度計算・FastAPIアプリ起動・ルーター登録・Alembicマイグレーションチェーンの整合性まで動作確認済み。**未確認**：実DBへの`alembic upgrade head`適用（ローカルにDocker/Postgres未起動のため）、実機カメラ画像での検出精度、実際のWebSocket通信（認証込み） |
| 2026-08-13         | AI回数カウント機能：frontend側を実装（動作確認用の暫定版）。`expo-camera`を追加（`npx expo install`）。`lib/repCount.ts`（新規、model-studioの`analyzer/lib/repCount.ts`移植・シンプル版のヒステリシス状態機械のみ）・`services/pose-ws.ts`（新規、`/ws/pose`への接続管理。`services/api.ts`のホスト解決ロジックをws(s)へ変換して流用）・`(screens)/pose-test.tsx`（新規、動作確認専用の暫定テスト画面。フロントカメラを200ms間隔でキャプチャして送信、受信した関節角度とカウント結果を画面表示に加え`console.log`にも出力し`expo start`のターミナルで確認できるようにした）を追加。既存画面からの導線は意図的に追加していない（本番導線は別途スコープ）。`npx tsc --noEmit`・`npx expo lint`ともにこの3ファイルでは0件（既存の`records.tsx`の警告1件は本タスクと無関係のため触れず）。**未確認**：実機での通し動作（カメラ起動→WebSocket接続→角度受信→カウント表示、認証込み） |
| 2026-08-13         | 開発環境の不具合調査・修正（AI回数カウント機能とは別件）：①Expo Goで「request timeout」になる不具合を調査した結果、Docker Desktop起動時に作成される仮想アダプター（`vEthernet (WSL...)`）とは別に、**別プロジェクト`ai-company`のDockerコンテナがポート8000（backend-core）・5432（Postgres）を専有していた**ことが根本原因と判明（ユーザー側で該当コンテナを停止し解消）。②ポート解放後、`kinpoyo_db`（5週間停止していた）を`docker start`で再起動し、保留していた`alembic upgrade head`を実DBに適用（`rep_count_models`テーブルの存在をDB上で確認済み）。③ログイン時の「Not Found」はai-companyとのポート衝突で無関係のAPIに接続していたことが原因、「リクエストに失敗しました（422）」は`api.ts`に一時的な`console.log`を追加して原因調査中に解消（デバッグログは調査後に削除・復元済み）。 |
| 2026-08-13         | AI回数カウント機能：実機テストで発覚した不具合を修正。①カウントが2→1のように減る不具合の原因は、ライブ計測で新しい角度が届くたびに`countReps()`（バッチ処理前提のアルゴリズム）を蓄積済みの全履歴に対して呼び直しており、ROMを基準にした閾値が後から遡って変わり既にカウント済みの区間が再評価されて消えていたこと。1フレームずつ状態を進め過去のカウントを取り消さない`StreamingRepCounter`（`lib/repCount.ts`に新規追加）に差し替え、`(screens)/workout-camera.tsx`・`(screens)/pose-test.tsx`両方を更新。②骨格線のオーバーレイ表示に対応：`react-native-svg`を直接依存に追加し`components/pose-skeleton-overlay.tsx`（新規）を作成、backend-coreの`/ws/pose`応答に33点のランドマーク座標（`landmarks`）を追加してカメラプレビュー上に線で重畳表示。③`(screens)/workout-camera.tsx`にフロント/背面カメラの切替ボタンを追加。④`Camera unmounted during taking photo process`エラーの原因（画面遷移後もawait中の非同期処理が撮影タイマーを立て続けるレースコンディション）を`mountedRef`ガードで修正。`npx tsc --noEmit`・`npx expo lint`ともにエラー0件。 |
| 2026-08-13         | AI回数カウント機能：スクワットに限定して本番導線へ統合。`backend-core/scripts/import_rep_model.py`（新規）でmodel-studioの本番API（`https://kinpoyo-api.azurewebsites.net`、読み取り専用）から較正済みのスクワットモデル（model_id=15、mae=0.0、exact_match_rate=1.0、mainJoint=左股関節）を取得し`rep_count_models`（exercise_id=17）へ投入。`frontend/services/exercises.ts`に`fetchRepModel`（404はnullとして扱う）を追加。`(screens)/workout-camera.tsx`（新規・本番用）を作成：`GET /exercises/{id}/rep-model`の設定を`lib/repCount.ts`のRepConfigへ変換し、`mainJoint`のみを`/ws/pose`で監視してリアルタイムカウント（カウント結果は表示のみ、`ai_counted_reps`へのDB保存は未実装・ユーザー確認の上でスコープ外とした）。`(tabs)/workout.tsx`の`handleStart`を拡張し、開始時に今日の種目から較正済みのものを探索→あれば`workout-camera`へ自動遷移、無ければ「AI回数カウントに対応した種目はまだ登録されていません」を表示。`npx tsc --noEmit`・`npx expo lint`ともにエラー0件。**未確認**：実機での通し動作（Playwright等での実写確認は未実施） |
| 2026-08-13         | AI回数カウント機能：実機での2回目のテストで判明した「カウントの精度がやや不安定」「遅延がある」「骨格線に顔・手指まで映る」というフィードバックを受けて対応（ユーザーと相談の上で方針決定）。①`services/pose-ws.ts`の`PoseSocket`に`sendFrameAndWait()`を追加し、`sendFrame()`（fire-and-forget）を廃止。`workout-camera.tsx`・`pose-test.tsx`とも固定間隔`setInterval`をやめ「前フレームの応答を待ってから次を撮る」ループに変更（遅延蓄積の根本対策）。②`workout-camera.tsx`から骨格線オーバーレイを撤去（`pose-test.tsx`のみ残す）。③`workout-camera.tsx`に較正データ（`cycleStats`）との比較ログを追加：毎フレームの角度と、1レップ完了ごとにそのレップの実測底値/頂点値をmodel-studio較正時の範囲と並べてターミナルに出力（`services/exercises.ts`の`RepCountModelConfig`型に`cycleStats`を追加）。④カウント数字を画面下寄り・小さめに変更。⑤**複数種目対応（今日のメニューに較正済み種目が複数あっても最初の1つしかカメラが起動しない制約）は、ユーザーと相談の上、今回は対応を保留**（スクワット以外のモデルが増えてから再検討）。`npx tsc --noEmit`・`npx expo lint`ともにエラー0件。 |
| 2026-08-22         | AI回数カウント機能：`workout-camera.tsx`のWebSocket購読関節を`mainJoint`のみから`candidates`全部（右膝・左膝・右股関節・左股関節）に拡張し、確認用にターミナルへ全部ログ出力するようにした（カウント判定自体は引き続き`mainJoint`のみ使用）。実機テストのログを分析した結果、①左股関節の角度が1フレームごとに50〜80°跳ねる、②同じ瞬間の左右の膝の角度が30〜40°食い違う、という姿勢推定自体の不安定さを確認（信頼度フィルタが無いこと・カメラ角度・`lite`モデルの精度限界などが要因候補、対応は次回以降）。さらにログの詳細分析で**姿勢ロスト判定の不具合を発見・修正**：`StreamingRepCounter`の姿勢ロストリセットが`cfg.maxGapFrames`（フレーム番号の差、model-studioの動画フレーム番号〜24-30fps前提の値）を使っていたが、ライブ計測の`frame`はWebSocket往復1回につき1増えるカウンター（1往復の実時間は数百ms〜数秒と変動）のため、実際には数秒間検出が途切れていても閾値内と誤判定され、検出なしを何度も挟んだ長い区間（実例：frame=13〜33、複数の検出なし区間を含む）が1回のレップとして誤ってカウントされていた。`StreamingRepCounter`に`maxGapMs`（実時間ミリ秒、デフォルト2000ms）を追加し、`push(frame, angle, atMs=Date.now())`で実時間ベースの判定に変更（呼び出し側は変更不要）。`npx tsc --noEmit`・`npx expo lint`ともにエラー0件。**未対応のまま残っている論点**：姿勢推定自体の精度（信頼度フィルタ・モデルグレード変更・撮影角度）は次回以降に持ち越し。 |
| 2026-08-22         | AI回数カウント機能：ユーザーの指示により、応答待ち方式（`sendFrameAndWait`）から固定間隔方式（`setInterval`、200ms、`sendFrame`のfire-and-forget）へ`workout-camera.tsx`・`pose-test.tsx`とも差し戻した。`services/pose-ws.ts`の`PoseSocket`に`sendFrame()`（応答を待たない送信）を復活させ、`sendFrameAndWait()`（応答待ち版）と両方使えるようにしてある（現在の呼び出し側は`sendFrame`を使用）。遅延蓄積の対策としては応答待ち方式の方が理論上優れるが、今回はユーザー判断で固定間隔に戻した。`npx tsc --noEmit`・`npx expo lint`ともにエラー0件。 |
| 2026-08-22         | **AI回数カウント機能：設計を大幅変更（リアルタイムストリーミング→バッチ処理）。** 精度・遅延の問題（カウントのズレ、姿勢推定自体の不安定さ、遅延蓄積）が解決しきれず、「アルゴリズムの問題か通信の問題か」を切り分けられないままデバッグが続いていたことを受け、ユーザーと相談の上、model-studio自身と同じ「録画→アップロード→まとめて解析」方式に戻すことにした。**削除**：`app/routers/pose.py`（`/ws/pose`）・`main.py`からの登録・`frontend/services/pose-ws.ts`・`frontend/lib/repCount.ts`（`StreamingRepCounter`含む）・`frontend/app/(screens)/pose-test.tsx`・`components/pose-skeleton-overlay.tsx`。**新規**：`backend-core/app/core/rep_model.py`（model-studio`rep_model.py`から推論に必要な部分のみ移植。`count_with_template`＝1レップ形状テンプレート照合＋統計ゲート＋ヒステリシスのフル版アルゴリズム、model-studioでmae=0.0の実績あり。較正専用ロジックは含まない）、`app/core/pose.py`に`extract_landmarks_from_frame`（動画フレームの生配列を直接処理、JPEG再エンコード不要）を追加、`POST /exercises/{exercise_id}/count-reps`（動画アップロード→バッチ解析、`def`非asyncでスレッドプール実行、実装確認用に毎フレームの関節角度と各サイクルの採用/棄却理由をターミナルへ出力）、`frontend/services/exercises.ts`に`countRepsFromVideo`（FormDataでのmultipartアップロード）、`(screens)/workout-camera.tsx`を録画UI（`expo-camera`の`mode="video"`・`recordAsync`/`stopRecording`、iOSはHEVC回避のため`codec:'avc1'`指定）に作り直し。**再利用**：`app/core/pose.py`・`pose_analysis.py`・`rep_count_models`テーブル・`GET /exercises/{id}/rep-model`・`scripts/import_rep_model.py`はそのまま。backend側は合成データ（正常なスクワット波形→採用、浅すぎる波形→統計ゲートで正しく棄却）で動作確認済み。`npx tsc --noEmit`・`npx expo lint`・`py_compile`ともにエラー0件、backend-core再起動して新エンドポイント登録も確認済み。**未確認**：実機での録画〜アップロード〜結果表示の通しテスト。 |
