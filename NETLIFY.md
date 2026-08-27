# Netlifyへのデプロイ

チームメンバーとすり合わせるための確認環境（本番相当のURL）を、最短で用意する手順です。

## 現在の状況

- Netlifyサイトは作成済みです: **`ocean-ai-sales-coach`**（チーム `Oceanチーム` 配下）
  - ダッシュボード: `https://app.netlify.com/projects/ocean-ai-sales-coach`
  - 公開URL（デプロイ後）: `https://ocean-ai-sales-coach.netlify.app`
- 環境変数を設定済みです: `ANTHROPIC_MODEL=claude-opus-5`、`ANTHROPIC_MAX_TOKENS=8000`
- アプリ側もNetlifyで動くように対応済みです（後述）。
- **まだデプロイ（ビルド）は実行されていません。** このセッションのネットワークポリシーが、
  直接デプロイに使う中継先（`netlify-mcp.netlify.app`）への接続をブロックしているためです
  （組織のアクセス制御によるもので、こちら側の設定ミスではありません）。
  そのため、以下のどちらかの方法で実行してください。

## 方法A：GitHub連携（推奨）

コードはブランチ `claude/ai-sales-coach-app-hs8npk` にプッシュ済みです。
Netlifyダッシュボードからリポジトリを連携するだけで、以後は `git push` のたびに自動デプロイされます。
このセッションのネットワーク制限を経由しないため、確実に動きます。

1. `https://app.netlify.com/projects/ocean-ai-sales-coach` を開く
2. **Project configuration → Build & deploy → Link repository**（またはトップの「Link repository」ボタン）
3. GitHub を選び、`hinako-00/oceanAI` を選択
   （Netlifyのログインと連携先のGitHubアカウントは別で構いません。認可画面ではリポジトリの
   オーナー〈`hinako-00`〉でログインしてください）
4. デプロイ元ブランチに `claude/ai-sales-coach-app-hs8npk` を指定
   （ビルドコマンドと使用するプラグインは `netlify.toml` に書いてあるので、追加設定は不要です）
5. **（任意）** `ANTHROPIC_API_KEY` を設定する場合は **Site configuration → Environment variables** で追加
   （[Anthropic Console](https://console.anthropic.com/) で発行したキー。他の変数は設定済みです）。
   **設定しなくてもデプロイして画面を確認できます。** 課金が発生するのはAPIキーを設定した
   うえで実際にAIコーチへメッセージを送ったときだけです。未設定のままだと、AIコーチとの
   チャット・ロールプレイだけが「未設定です」という案内になり、それ以外（ログイン、顧客カルテ、
   商談記録、メンバー管理、次回行動、自社営業知識）は普通に確認できます。
   後から試したくなったら、環境変数を追加して次のステップの「Trigger deploy」をやり直すだけで
   反映されます（コードの変更は不要）。
6. **Deploys → Trigger deploy** でビルドを開始する

数分後に `https://ocean-ai-sales-coach.netlify.app` が使えるようになります。
以降はチームメンバーへこのURLを共有すれば、実際の画面で確認・すり合わせができます。

## 方法B：自分のPCから直接デプロイ

Netlify CLIが使えるなら、このセッションを介さず直接アップロードできます。

```bash
git clone https://github.com/hinako-00/oceanAI.git
cd oceanAI
git checkout claude/ai-sales-coach-app-hs8npk
npm install
npx netlify login
npx netlify link --id <サイトID>   # ダッシュボードの Site configuration → General に表示されています
npx netlify env:set ANTHROPIC_API_KEY sk-ant-...
npx netlify deploy --build --prod
```

## アプリ側で対応した内容

Netlifyのサーバーレス関数はリクエストごとに実行環境が使い捨てられ、ローカルファイルへの書き込みが
残りません。そのため、これまでのJSONファイル保存（`lib/store-file.ts`、Docker/自前サーバー向け）に加えて、
**Netlify Blobs**（Netlifyが提供するキーバリューストア）で永続化する実装を追加しました。

- `lib/store-blobs.ts`：Netlify Blobsを使う永続化バックエンド
- `lib/store.ts`：環境変数 `NETLIFY`（Netlifyが自動設定）を見て、ファイル保存とBlobsを自動的に切り替える
- `lib/storage-driver.ts`：その判定ロジックだけを取り出した純粋関数（`tests/storage-driver.test.ts` でテスト済み）
- `next.config.mjs`：Netlifyビルド時は `output: 'standalone'` を無効化（Docker向けの設定のため）
- `netlify.toml`：ビルドコマンドと `@netlify/plugin-nextjs` の指定

**ローカル開発・Docker/systemd運用（DEPLOY.md）は今までどおりJSONファイル保存のままで、
今回の変更による影響はありません。** 実際に `npm test` / `npm run build`（NETLIFY環境変数なし）が
変更前と同じ結果になることを確認済みです。

### Netlify Blobsの制約（確認用途では問題ないが、知っておくこと）

- 書き込みは「最後に書いたものが勝つ」方式です（トランザクションや行ロックはありません）。
  同じ顧客カルテをほぼ同時に複数人が更新すると、片方の変更が消えることがあります。
  少人数での確認・デモには支障ありませんが、本格運用で書き込みの競合が増えてきたら
  DEPLOY.mdの「人数が増えたとき：DBへの移行」に従ってPostgreSQL等へ移行してください。
- サイトを削除するとBlobsのデータも消えます。確認が終わったサイトを消す前に、
  必要なら以下でバックアップしてください（`STORAGE_DRIVER=file` にすると
  ローカルではファイル保存を強制できるので、移行や検証にも使えます）。

## 確認の流れ

デプロイ後、初回アクセス時は自動で `/setup` に移動します。README.md / DEPLOY.md と同じ手順です。

1. 最初の管理者アカウントを作成
2. 「メンバー管理」でチームメンバーを追加（すり合わせに参加する人数分）
3. 「自社営業知識」にサンプルの商品情報を1つ登録
4. 「商談を記録」でサンプルの商談メモを1件登録する
5. **（`ANTHROPIC_API_KEY` を設定した場合のみ）** 登録した商談をAIに振り返らせてみる。
   未設定の場合はここまでの画面・操作感の確認で一区切りにしてください。

## 確認が終わったら

このURLは一時的な確認用です。本番として使い続ける場合は、DEPLOY.mdの「なぜHTTPSが必要か」
「バックアップ」を確認したうえで、正式なドメインでの公開を検討してください
（Netlifyの `*.netlify.app` のままでもHTTPSは有効なので、社内での確認だけならこのままで問題ありません）。

サイトを削除する場合は、ダッシュボードの **Site configuration → General → Delete this site** から行えます。
