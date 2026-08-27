# Netlifyへのデプロイ

チームメンバーとすり合わせるための確認環境（本番相当のURL）です。

## 現在の状況

- サイト: **`ocean-ai-sales-coach`**（チーム `Oceanチーム` 配下）
  - ダッシュボード: `https://app.netlify.com/projects/ocean-ai-sales-coach`
  - 公開URL: `https://ocean-ai-sales-coach.netlify.app`
- GitHub連携済み・デプロイ済みです（ブランチ `claude/ai-sales-coach-app-hs8npk`）。
  以降は `git push` のたびに自動でビルド・デプロイされます。
- 環境変数を設定済みです: `ANTHROPIC_MODEL`、`ANTHROPIC_MAX_TOKENS`、`ANTHROPIC_API_KEY`、
  **`STORAGE_DRIVER=blobs`**。

### `STORAGE_DRIVER=blobs` は必須

省略すると、Netlify Functionsの読み取り専用のファイルシステムにJSONファイルを書き込もうとして
`EROFS: read-only file system` でエラーになります（実際に一度これで初期設定画面が失敗しました）。

当初は環境変数 `NETLIFY`（Netlifyがビルド時に自動設定する）の有無で自動判定するつもりでしたが、
**Netlify Functionsの実行時には `process.env.NETLIFY` が乗ってこない**ことがあるとわかったため、
確実な `STORAGE_DRIVER` を明示する方式に変更しています（`lib/storage-driver.ts`）。
AWS Lambdaのランタイム変数（Netlify Functionsの実体）からの自動検知も保険として追加していますが、
Netlifyでは `STORAGE_DRIVER=blobs` の明示設定が確実です。

**このサイトを作り直す・複製する場合は、この変数を忘れずに設定してください。**
（Site configuration → Environment variables → `STORAGE_DRIVER` = `blobs`、スコープはAll scopes）

## サイトを新しく作る場合の手順

すでに上記のサイトはセットアップ済みですが、複製したり作り直す場合の手順です。

1. Netlifyダッシュボードで新規サイトを作成し、**Link repository** → GitHub → `hinako-00/oceanAI`
   を選択
   （Netlifyのログインと連携先のGitHubアカウントは別で構いません。認可画面ではリポジトリの
   オーナー〈`hinako-00`〉でログインしてください）
2. デプロイ元ブランチを指定
   （ビルドコマンドと使用するプラグインは `netlify.toml` に書いてあるので、追加設定は不要です）
3. **Site configuration → Environment variables** で以下を設定
   - `STORAGE_DRIVER` = `blobs` **（必須。上記の理由により省略不可）**
   - `ANTHROPIC_API_KEY` = Anthropic Consoleで発行したキー（**任意**。未設定でもデプロイでき、
     AIコーチのチャット・ロールプレイだけが「未設定です」という案内になる。それ以外の機能
     ──ログイン、顧客カルテ、商談記録、メンバー管理、次回行動、自社営業知識──は問題なく
     確認できる。課金はキー設定後に実際にメッセージを送ったときのみ発生する）
   - `ANTHROPIC_MODEL` / `ANTHROPIC_MAX_TOKENS`（任意。既定値は `claude-opus-5` / `8000`）
4. **Deploys → Trigger deploy** でビルドを開始

### Netlify CLIから直接デプロイする場合

```bash
git clone https://github.com/hinako-00/oceanAI.git
cd oceanAI
git checkout claude/ai-sales-coach-app-hs8npk
npm install
npx netlify login
npx netlify link --id <サイトID>   # ダッシュボードの Site configuration → General に表示されている
npx netlify env:set STORAGE_DRIVER blobs
npx netlify env:set ANTHROPIC_API_KEY sk-ant-...   # 任意
npx netlify deploy --build --prod
```

## アプリ側で対応した内容

Netlifyのサーバーレス関数はリクエストごとに実行環境が使い捨てられ、ローカルファイルへの書き込みが
残りません。そのため、これまでのJSONファイル保存（`lib/store-file.ts`、Docker/自前サーバー向け）に加えて、
**Netlify Blobs**（Netlifyが提供するキーバリューストア）で永続化する実装を追加しました。

- `lib/store-blobs.ts`：Netlify Blobsを使う永続化バックエンド
- `lib/store.ts`：`lib/storage-driver.ts` の判定結果を見て、ファイル保存とBlobsを切り替える
- `lib/storage-driver.ts`：判定ロジック。`STORAGE_DRIVER` の明示設定を最優先し、次点でAWS Lambda
  ランタイム変数からサーバーレス実行を検知する（`tests/storage-driver.test.ts` でテスト済み）
- `next.config.mjs`：Netlifyビルド時は `output: 'standalone'` を無効化（Docker向けの設定のため）
- `netlify.toml`：ビルドコマンドと `@netlify/plugin-nextjs` の指定

**ローカル開発・Docker/systemd運用（DEPLOY.md）は今までどおりJSONファイル保存のままで、
今回の変更による影響はありません。**

### Netlify Blobsの制約（確認用途では問題ないが、知っておくこと）

- 書き込みは「最後に書いたものが勝つ」方式です（トランザクションや行ロックはありません）。
  同じ顧客カルテをほぼ同時に複数人が更新すると、片方の変更が消えることがあります。
  少人数での確認・デモには支障ありませんが、本格運用で書き込みの競合が増えてきたら
  DEPLOY.mdの「人数が増えたとき：DBへの移行」に従ってPostgreSQL等へ移行してください。
- サイトを削除するとBlobsのデータも消えます。確認が終わったサイトを消す前に、
  必要ならバックアップしてください（`STORAGE_DRIVER=file` にするとローカルではファイル保存を
  強制できるので、移行や検証にも使えます）。

## 確認の流れ

初回アクセス時は自動で `/setup` に移動します。README.md / DEPLOY.md と同じ手順です。

1. 最初の管理者アカウントを作成
2. 「メンバー管理」でチームメンバーを追加（すり合わせに参加する人数分）
3. 「自社営業知識」にサンプルの商品情報を1つ登録
4. 「商談を記録」でサンプルの商談メモを1件登録する
5. **（`ANTHROPIC_API_KEY` を設定した場合のみ）** 登録した商談をAIに振り返らせてみる

## 確認が終わったら

このURLは一時的な確認用です。本番として使い続ける場合は、DEPLOY.mdの「なぜHTTPSが必要か」
「バックアップ」を確認したうえで、正式なドメインでの公開を検討してください
（Netlifyの `*.netlify.app` のままでもHTTPSは有効なので、社内での確認だけならこのままで問題ありません）。

サイトを削除する場合は、ダッシュボードの **Site configuration → General → Delete this site** から行えます。
