# Netlifyへのデプロイ

チームメンバーとすり合わせるための確認環境（本番相当のURL）です。

## 現在の状況

- サイト: **`ocean-ai-sales-coach`**（チーム `Oceanチーム` 配下）
  - ダッシュボード: `https://app.netlify.com/projects/ocean-ai-sales-coach`
  - 公開URL: `https://ocean-ai-sales-coach.netlify.app`
- GitHub連携済み・デプロイ済みです（ブランチ `claude/ai-sales-coach-app-hs8npk`）。
  以降は `git push` のたびに自動でビルド・デプロイされます。
- 設定されている環境変数は **`ANTHROPIC_API_KEY` だけ**です（2026-08 時点で確認）。
  他は未設定で、いずれもコード側の既定値・自動判定で正しく動いています。

| 変数 | 現在 | 未設定のときの挙動 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | 設定済み | 未設定だとAIコーチだけが「未設定です」の案内になる（他の機能は動く） |
| `ANTHROPIC_MODEL` | 未設定 | `claude-opus-5` |
| `ANTHROPIC_MAX_TOKENS` | 未設定 | `64000`。**未設定のままでよい**（下記） |
| `STORAGE_DRIVER` | 未設定 | Lambdaランタイム変数から検知して `blobs`（下記） |

### `ANTHROPIC_MAX_TOKENS` は設定しないこと

未設定ならコードの既定値 `64000` が使われます。これが正しい状態です。

小さい値（かつての既定値 `8000` など）を設定すると**環境変数のほうが勝つ**ため、
アポの分析が途中で切れ、保存候補（`save_proposal` ツールの呼び出し）が最後まで到達せずに消えます。
応答はストリーミングなので大きくてもタイムアウトせず、課金は実際に生成されたトークン数に
対して発生するため、上限が高くても短い回答が高くなることはありません。絞る理由がありません。

### `STORAGE_DRIVER` は未設定でも動く（明示すればより確実）

かつては未設定だと、Netlify Functionsの読み取り専用のファイルシステムにJSONファイルを
書き込もうとして `EROFS: read-only file system` で失敗していました（実際に一度、初期設定画面が
これで落ちています）。

その後 `lib/storage-driver.ts` に、AWS Lambdaのランタイム自身が注入する環境変数
（`AWS_LAMBDA_FUNCTION_NAME` / `LAMBDA_TASK_ROOT`）でサーバーレス実行を検知する経路を入れました。
Netlify Functions の実体はAWS Lambdaなので、**`STORAGE_DRIVER` が未設定でも `blobs` に倒れます**。
現在のサイトが未設定のまま動いているのはこのためです（`tests/storage-driver.test.ts` で担保）。

`NETLIFY` 変数だけに頼らないのは、Netlify Functionsの実行時に `process.env.NETLIFY` が
乗ってこないことがあるためです。

判定の優先順位は「`STORAGE_DRIVER` の明示 → Lambdaランタイム変数の検知 → ファイル保存」です。
明示したほうが判定が1段浅くなって確実なので、サイトを作り直す・複製する場合は
`STORAGE_DRIVER` = `blobs`（スコープはAll scopes）を設定しておくことを勧めますが、必須ではありません。

## サイトを新しく作る場合の手順

すでに上記のサイトはセットアップ済みですが、複製したり作り直す場合の手順です。

1. Netlifyダッシュボードで新規サイトを作成し、**Link repository** → GitHub → `hinako-00/oceanAI`
   を選択
   （Netlifyのログインと連携先のGitHubアカウントは別で構いません。認可画面ではリポジトリの
   オーナー〈`hinako-00`〉でログインしてください）
2. デプロイ元ブランチを指定
   （ビルドコマンドと使用するプラグインは `netlify.toml` に書いてあるので、追加設定は不要です）
3. **Site configuration → Environment variables** で以下を設定
   - `STORAGE_DRIVER` = `blobs` **（推奨。未設定でもLambdaランタイム検知で `blobs` になるが、
     明示したほうが確実。上記参照）**
   - `ANTHROPIC_API_KEY` = Anthropic Consoleで発行したキー（**任意**。未設定でもデプロイでき、
     AIコーチのチャット・ロールプレイだけが「未設定です」という案内になる。それ以外の機能
     ──ログイン、クライアント情報、アポ記録、メンバー管理、次回行動、自社営業知識──は問題なく
     確認できる。課金はキー設定後に実際にメッセージを送ったときのみ発生する）
   - `ANTHROPIC_MODEL`（任意。既定値は `claude-opus-5`）
   - `ANTHROPIC_MAX_TOKENS` は**設定しないこと**（既定値 `64000` が正しい。上記参照）
4. **Deploys → Trigger deploy** でビルドを開始

### Netlify CLIから直接デプロイする場合

```bash
git clone https://github.com/hinako-00/oceanAI.git
cd oceanAI
git checkout claude/ai-sales-coach-app-hs8npk
npm install
npx netlify login
npx netlify link --id <サイトID>   # ダッシュボードの Site configuration → General に表示されている
npx netlify env:set ANTHROPIC_API_KEY sk-ant-...   # 任意
npx netlify env:set STORAGE_DRIVER blobs           # 任意（未設定でも blobs に倒れる）
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
  同じクライアント情報をほぼ同時に複数人が更新すると、片方の変更が消えることがあります。
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
4. 「アポを記録」でサンプルのアポメモを1件登録する
5. **（`ANTHROPIC_API_KEY` を設定した場合のみ）** 登録したアポをAIに振り返らせてみる

## 確認が終わったら

このURLは一時的な確認用です。本番として使い続ける場合は、DEPLOY.mdの「なぜHTTPSが必要か」
「バックアップ」を確認したうえで、正式なドメインでの公開を検討してください
（Netlifyの `*.netlify.app` のままでもHTTPSは有効なので、社内での確認だけならこのままで問題ありません）。

サイトを削除する場合は、ダッシュボードの **Site configuration → General → Delete this site** から行えます。
