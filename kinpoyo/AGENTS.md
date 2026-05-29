# AGENTS.md — kinpoyo プロジェクト

> このファイルはAIエージェント（Claude Code など）向けのプロジェクトガイドです。
> **変更を加えるたびに必ずこのファイルを更新・確認してください。**

---

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| プロジェクト名 | kinpoyo |
| フロントエンド | React Native (Expo) |
| バックエンド | FastAPI (Python 3.14) |
| ルートディレクトリ | `C:\HAL名古屋\kinpoyo\` |

---

## ディレクトリ構成

```
kinpoyo/
├── AGENTS.md              # このファイル（必ず更新すること）
├── docker-compose.yml     # frontend・backend まとめて起動
├── frontend/              # React Native (Expo) フロントエンド
│   ├── Dockerfile
│   ├── App.tsx
│   ├── components/        # 共通コンポーネント
│   ├── package.json
│   └── ...
└── backend-core/          # FastAPI バックエンド
    ├── Dockerfile
    ├── main.py            # エントリーポイント
    ├── routers/           # APIルーター
    ├── models/            # データモデル
    └── requirements.txt
```

---

## 環境情報

### フロントエンド（React Native / Expo）
- Node.js: v22.20.0
- npm: 10.9.3
- Expo SDK: 最新版
- 起動コマンド: `cd frontend && npx expo start`

### バックエンド（FastAPI）
- Python: 3.14.0 (`C:\Python314\python.exe`)
- 仮想環境: `backend\venv\`
- 起動コマンド: `cd backend-core && venv\Scripts\activate && uvicorn main:app --reload`
- APIドキュメント: http://localhost:8000/docs

---

## 開発ルール

### AIエージェントへの指示
1. **変更前に必ずこのファイル（AGENTS.md）を読むこと**
2. **変更後に必ずこのファイルを更新すること**（新しいルーター・モデル・コンポーネントの追加など）
3. 新しいAPIエンドポイントを追加したら「API一覧」セクションを更新する
4. 新しい依存パッケージを追加したら「依存パッケージ」セクションを更新する
5. コミット前に型チェック・リントを実行する

### コーディング規約
- バックエンド: PEP8準拠、型ヒント必須
- フロントエンド: TypeScript使用、コンポーネントはPascalCase

---

## API一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/` | ヘルスチェック |

---

## 依存パッケージ

### バックエンド（requirements.txt）
- fastapi
- uvicorn[standard]

### フロントエンド（package.json）
- expo
- react-native
- typescript

---

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-05-29 | 初期セットアップ：React Native (Expo) + FastAPI 環境構築 |
| 2026-05-29 | ディレクトリ名変更：kinpoyo-app→frontend、backend→backend-core |
| 2026-05-29 | Docker環境構築：Dockerfile（frontend・backend-core）・docker-compose.yml作成 |
