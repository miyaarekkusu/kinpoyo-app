# リアルタイムAI回数カウント セットアップ手順（2026-08-27）

判定ロジックの設計は `realtime-count-design-memo.txt` を参照。ここでは動かし方を書く。

## 構成（Expo Go で iOS 実機を動かす制約から決まった）

**Expo Go は Expo SDK の固定セットを内蔵した既製アプリなので、
`react-native-vision-camera` や `react-native-mediapipe` のようなカスタムネイティブ
モジュールを読み込めない。端末上でMediaPipeを回すことは原理的にできない。**

そこで姿勢推定はサーバー側で行う。

```
[端末] expo-camera で連写（shutterSound:false / skipProcessing）
   ↓ base64 JPEG を WebSocket（約8fps）
[backend] legacy MediaPipe → world landmarks → 主役関節の絶対角度
   ↓
[backend] realtime_rep_counter.py（因果的カウンタ・STREAMING_CONFIG）
   ↓ sample / rep / done メッセージ
[端末] リアルタイム表示 → session_sets 保存 → AIレビュー生成
```

**この構成の副次的な利点**: backend は model-studio と同じ legacy MediaPipe
（`mp.solutions.pose`, `model_complexity=1`）を使うため、`rep_count_models` の較正済み
絶対角度と完全に噛み合う。オンデバイス方式（MediaPipe Tasks）で懸念していた
「骨格モデルが別物で角度がズレる」問題がそもそも発生しない。

### ファイル

| 役割 | 場所 |
| --- | --- |
| 画面（Expo Go 対応） | `frontend/app/(screens)/workout-camera-live.tsx` |
| WebSocket エンドポイント | `backend-core/app/routers/exercises_ws.py` |
| カウンタ本体 | `backend-core/app/core/realtime_rep_counter.py` |
| 検証ハーネス | `backend-core/scripts/replay_realtime_count.py` |
| オンデバイス版（**退避中**） | `frontend/experimental/workout-camera-live.ondevice.tsx` |
| カウンタのTS移植（同上） | `frontend/lib/realtimeRepCounter.ts`, `frontend/lib/poseAngles.ts` |

導線: 筋トレ開始タブ →「筋トレを開始する」→ 較正済み種目があればこの画面へ。
バッチ版（`workout-camera.tsx`）はライブラリから動画を選んで再テストする導線として残す。

## 動かし方

### 1. backend を LAN から見える形で起動

端末（実機）から届く必要があるので `0.0.0.0` で待ち受ける。

```bash
cd kinpoyo/backend-core
venv\Scripts\activate            # または C:\venvs\kinpoyo-backend-core\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

WebSocket を使うので `uvicorn` が `websockets` を持っていること。無ければ:

```bash
pip install "uvicorn[standard]"
```

### 2. frontend を Expo Go で

```bash
cd kinpoyo/frontend
npx expo start
```

iPhone の Expo Go でQRを読む。**ネイティブビルドも dev client も不要。**

`ios/` `android/` を作ってしまうと `expo start` が dev client モードを選ぶことがある。
Expo Go で動かす間はこれらを置かないこと（.gitignore 済み・prebuild で作られる）。

### 3. API のホスト設定

`frontend/services/api.ts` の `API_BASE_URL` が実機から到達できるアドレスであること。
画面は `http` → `ws` に置き換えて WebSocket を張るので、ここが `localhost` だと実機から
繋がらない。

## 検証済みのこと（このPC・Windows）

- カウンタの合成信号テストが **8fps以上で12/12通過**
  ```bash
  python scripts/replay_realtime_count.py --synthetic --streaming --config <config.json> --fps 8
  ```
- 実データ（model-studio の較正セッション86・87）で **正解2 / リアルタイム2 / バッチ2** の一致
  ```bash
  python scripts/replay_realtime_count.py --analysis 27 --config <config.json>
  ```
- `tsc --noEmit` で新規ファイルにエラーなし

## 未検証のこと（実機が要る）

- 実機で実際に何fps出るか。画面のHUDに実測fpsを出してあるので、そこを見て
  `SEND_INTERVAL_MS`（既定125ms＝8fps相当）と `PICTURE_QUALITY`（既定0.3）を調整する
- `shutterSound: false` が iOS 実機でシャッター音を実際に消せるか
  （地域によってはOSが強制することがある）
- WebSocket 経由の往復遅延

## フレームレートの実測（合成信号）

| fps | 結果 |
| --- | --- |
| 30 | 12/12 |
| 12 | 12/12 |
| 8 | 12/12 |
| 5 | 11/12（浅いレップを停滞と誤判定） |

**カウント自体（連続レップの取りこぼし）は5fpsでも起きない。** 低fpsで劣化するのは
(1) 停滞検知の鈍り (2) 粗いサンプリングでボトムを取り逃してROMが小さく出る、の2点。
`STREAMING_CONFIG` はこの2点に対して `ema_alpha` を上げ `rom_min_deg` を下げてある
（根拠は同定数のコメント参照）。

**5fpsを下回るようなら画質を下げるか送信間隔を詰めること。**

## 落とし穴

### 1. expo-image-picker の cameraPermission

`cameraPermission: false` にしていると AndroidManifest に `tools:node="remove"` が入り、
**CAMERA 権限そのものが削除される**（prebuild 出力で実際に踏んだ）。app.json で文言を
設定して有効にしてある。false に戻さないこと。Expo Go では関係ないが、将来
dev client を作るときに効いてくる。

### 2. 計測区間

現状は画面の「計測開始／計測終了」ボタンでカウンタを start()/stop() している。
セット管理フロー（休憩中は止める）と結合する際は呼び出し側を差し替えること。
休憩中にカウンタが動いていると、椅子に座る動作を拾う恐れがある。

### 3. フレームを溜めない

端末側・backend側の両方で「前のフレームの処理が終わっていなければ捨てる」ようにして
ある。溜めると計測時刻と実時間がずれてテンポ判定が壊れるため。捨てるのは正常動作。

## オンデバイス版に戻すとき

`frontend/experimental/workout-camera-live.ondevice.tsx` を `app/(screens)/` へ戻す。
必要なもの:

- dev client（`npx expo prebuild` → `pod install` → `npx expo run:ios`）。Expo Go では動かない
- `react-native-vision-camera` / `react-native-mediapipe` / `react-native-worklets-core`
  （package.json に入れたまま。**app/ 配下からは一切importしていない**ので Expo Go の
  邪魔はしない）
- `babel.config.js` に `react-native-worklets-core/plugin`（Expo Go 用に削除済み。
  戻すときに再作成すること）
- モデルファイル `assets/models/pose_landmarker_lite.task` と
  `plugins/withPoseModel.js`（prebuild のたびにネイティブアセットへ配置する。
  Android での動作は確認済み）
- ⚠️ **Tasks API は legacy API と別モデル**なので、較正済みの絶対角度と噛み合わない
  可能性がある。HUDの角度を較正ボトム帯（85.7〜86.6°）と見比べて判断すること
