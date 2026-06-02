# 文字起こしくん

電話録音をアップロードすると OpenAI で文字起こしし、Cloudflare D1 にテキスト、R2 に圧縮音声を保存する PWA です。

## 機能

- スクール / 学年 / クラス / 生徒氏名を入力して音声をアップロード
- ブラウザ内で mono 16kHz mp3 に圧縮してから送信
- 文字起こし結果を `スクール_学年_クラス_氏名.txt` 形式で保存
- ダウンロードページでスクール単位の一覧表示、個別 txt / zip 一括ダウンロード、削除

## 技術スタック

- フロント: Vite + React + TypeScript + vite-plugin-pwa
- バックエンド: Cloudflare Pages Functions
- DB: Cloudflare D1
- 音声保存: Cloudflare R2
- 文字起こし: OpenAI `gpt-4o-mini-transcribe`

## セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. 環境変数

`.dev.vars.example` を参考に `.dev.vars` を作成します。

```env
OPENAI_API_KEY=sk-...
DOWNLOAD_PASSCODE=taich
TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

### 3. Cloudflare リソース

```bash
# D1 作成
npx wrangler d1 create transcribe-db

# 出力された database_id を wrangler.toml の database_id に設定

# スキーマ適用
npx wrangler d1 execute transcribe-db --local --file=./schema.sql
npx wrangler d1 execute transcribe-db --remote --file=./schema.sql

# R2 作成
npx wrangler r2 bucket create transcribe-audio
```

### 4. ローカル開発

```bash
npm run build
npm run pages:dev
```

別ターミナルでフロント開発する場合:

```bash
npm run dev
```

`vite.config.ts` の proxy により `/api` は `http://127.0.0.1:8788` に転送されます。

### 5. 本番デプロイ

```bash
npm run deploy
```

本番シークレット:

```bash
npx wrangler pages secret put OPENAI_API_KEY
npx wrangler pages secret put DOWNLOAD_PASSCODE
```

## ページ

- `/` : アップロード
- `/download` : ダウンロード / 管理 (パスコード: `taich`)

## 注意

- `.amr` / `.3gp` 形式は非対応です
- OpenAI の文字起こし API は課金設定が必要です
- API キーは `.dev.vars` または Cloudflare Secrets にのみ保存し、リポジトリへコミットしないでください
