# デプロイ手順

社内の営業チームで使うことを前提にした運用手順です。
**方法A（Docker Compose + Caddy）が最短で、HTTPSの証明書まで自動**になります。
Dockerが使えない環境向けに方法Bも用意しています。

```
インターネット / 社内LAN
        │  HTTPS (443)
        ▼
  ┌───────────────┐   証明書の取得・更新を自動で行う
  │ Caddy / Nginx │
  └───────┬───────┘
          │  HTTP (3000)  ※外部には公開しない
          ▼
  ┌───────────────┐
  │  Next.js app  │──▶ Claude API
  └───────┬───────┘
          │
          ▼
   /data （顧客情報・商談履歴・アカウント）※バックアップ対象
```

## 0. 準備するもの

| 項目 | 内容 |
| --- | --- |
| サーバー | Linux（Ubuntu 22.04以降など）。メモリ1GB・ディスク10GBもあれば足ります |
| ドメイン | 例 `ocean.example.com`。**サーバーのグローバルIPへAレコードを向けておく**（証明書の取得に必要） |
| ポート | 80と443を開放（80は証明書の取得・更新に使われます） |
| APIキー | [Anthropic Console](https://console.anthropic.com/) で発行 |

社内ネットワークからのみ使う場合でも、社内DNSで名前解決できるドメインを用意してください。
理由は「[なぜHTTPSが必要か](#なぜhttpsが必要か)」に書いています。

---

## 方法A：Docker Compose ＋ Caddy（推奨）

証明書の取得・更新をCaddyが自動で行うため、証明書の期限切れを気にする必要がありません。

### A-1. 配置

```bash
sudo mkdir -p /opt/ocean-ai && cd /opt/ocean-ai
sudo git clone https://github.com/hinako-00/oceanAI.git .
sudo git checkout claude/ai-sales-coach-app-hs8npk
```

### A-2. 設定ファイルを作る

`/opt/ocean-ai/.env` を作ります（`docker compose` が自動で読み込みます）。

```bash
sudo tee /opt/ocean-ai/.env > /dev/null <<'EOF'
OCEAN_DOMAIN=ocean.example.com
OCEAN_TLS_EMAIL=admin@example.com
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-5
EOF
sudo chmod 600 /opt/ocean-ai/.env
```

`OCEAN_TLS_EMAIL` は証明書の期限が近いときに Let's Encrypt から通知が届く宛先です。

### A-3. 起動

```bash
cd /opt/ocean-ai
sudo docker compose up -d --build
sudo docker compose logs -f caddy   # 証明書の取得ログを確認（Ctrl+Cで抜ける）
```

`certificate obtained successfully` のような行が出れば成功です。
ブラウザで `https://ocean.example.com` を開くと初期設定画面に移ります。

### A-4. 確認

```bash
curl -I https://ocean.example.com/api/health   # 200 が返る
sudo docker compose ps                          # app が healthy になっている
```

---

## 方法B：Dockerなし（systemd ＋ Nginx ＋ certbot）

### B-1. Node.js とアプリの配置

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx

# 専用ユーザーとディレクトリ
sudo useradd --system --home /opt/ocean-ai --shell /usr/sbin/nologin ocean
sudo mkdir -p /opt/ocean-ai /var/lib/ocean-ai
sudo chown ocean:ocean /var/lib/ocean-ai
sudo chmod 700 /var/lib/ocean-ai

cd /opt/ocean-ai
sudo git clone https://github.com/hinako-00/oceanAI.git .
sudo git checkout claude/ai-sales-coach-app-hs8npk
sudo npm ci
sudo npm run build

# standalone 実行に必要な静的ファイルを配置する
sudo cp -r .next/static .next/standalone/.next/static
sudo chown -R ocean:ocean /opt/ocean-ai
```

### B-2. 環境変数と常駐設定

```bash
sudo cp deploy/ocean-ai.env.example /etc/ocean-ai.env
sudo nano /etc/ocean-ai.env        # ANTHROPIC_API_KEY を設定
sudo chmod 600 /etc/ocean-ai.env

sudo cp deploy/ocean-ai.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ocean-ai
sudo systemctl status ocean-ai
```

`HOSTNAME=127.0.0.1` にしてあるため、アプリは外部から直接アクセスできません。

### B-3. Nginx と証明書

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/ocean-ai
sudo nano /etc/nginx/sites-available/ocean-ai     # ocean.example.com を自分のドメインに置換
sudo ln -s /etc/nginx/sites-available/ocean-ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 証明書の取得（以後の更新は certbot が自動で行う）
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ocean.example.com
sudo systemctl list-timers | grep certbot   # 自動更新タイマーの確認
```

---

## 初回セットアップ

1. `https://ocean.example.com` を開く（自動で `/setup` に移動します）
2. 最初の**管理者**（氏名・メール・パスワード10文字以上）を作成
3. 「メンバー管理」から営業担当者を追加
   - 管理者が初回パスワードを設定し、本人に伝えます
   - 本人が初回ログイン後に「自分の設定」で変更します
4. 「自社営業知識」に商品資料・営業ルール・成功事例を登録（AIが一般論より優先して参照します）

---

## なぜHTTPSが必要か

このアプリはパスワードでログインし、ログイン状態をCookieで保持します。
HTTPのままだと、同じネットワーク上の第三者に**パスワードとCookieがそのまま読まれ**、
なりすましてログインされます。顧客情報と商談内容が入っているため、社内利用でも必須です。

そのため本番（`NODE_ENV=production`）ではCookieに `Secure` 属性を付けており、
**HTTPSでないとブラウザがCookieを保存せず、ログインできません**（これは仕様どおりの挙動です）。

### どうしてもHTTPしか使えない場合

閉じた社内LANでの一時的な検証など、やむを得ない場合に限り明示的に外せます。

```bash
COOKIE_SECURE=false
```

盗聴に対して無防備になるため、恒久運用では使わないでください。
社内向けでも、社内CA発行の証明書や `mkcert` を使えばHTTPSにできます。

---

## バックアップ

`/data`（Docker）または `/var/lib/ocean-ai`（systemd）に顧客情報・商談履歴・アカウントが入ります。
**ここだけバックアップすれば復旧できます。**

```bash
# Docker構成
sudo docker compose exec -T app tar cz -C /data . > ocean-$(date +%F).tar.gz

# systemd構成
sudo tar czf ocean-$(date +%F).tar.gz -C /var/lib/ocean-ai .
```

毎日自動で取るなら同梱のスクリプトを使います。

```bash
sudo crontab -e
# 毎日3時にバックアップ、30日分を保持
0 3 * * * /opt/ocean-ai/deploy/backup.sh >> /var/log/ocean-backup.log 2>&1
```

### 復元

```bash
# Docker構成
sudo docker compose stop app
sudo docker run --rm -v ocean-ai_ocean-data:/data -v "$PWD":/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/ocean-2026-08-27.tar.gz -C /data'
sudo docker compose start app

# systemd構成
sudo systemctl stop ocean-ai
sudo tar xzf ocean-2026-08-27.tar.gz -C /var/lib/ocean-ai
sudo systemctl start ocean-ai
```

バックアップファイルには顧客情報が含まれます。保存先の権限（`chmod 600`）と保管場所に注意してください。

---

## アップデート

```bash
# Docker構成
cd /opt/ocean-ai
sudo docker compose exec -T app tar cz -C /data . > /var/backups/before-update.tar.gz  # 先にバックアップ
sudo git pull
sudo docker compose up -d --build
```

```bash
# systemd構成
cd /opt/ocean-ai
sudo tar czf /var/backups/before-update.tar.gz -C /var/lib/ocean-ai .
sudo git pull
sudo npm ci && sudo npm run build
sudo cp -r .next/static .next/standalone/.next/static
sudo chown -R ocean:ocean /opt/ocean-ai
sudo systemctl restart ocean-ai
```

---

## ログと監視

```bash
sudo docker compose logs -f app        # Docker構成
sudo journalctl -u ocean-ai -f         # systemd構成
curl -s https://ocean.example.com/api/health   # {"ok":true}
```

`/api/health` はログイン不要で応答します。監視ツールからはこのURLを見てください。

---

## よくあるトラブル

| 症状 | 原因と対処 |
| --- | --- |
| ログインしても弾かれる／ログイン画面に戻る | HTTPでアクセスしている。HTTPSにするか、検証用途に限り `COOKIE_SECURE=false` |
| 証明書が取得できない | ドメインのAレコードがサーバーを指していない／80番が閉じている。`dig ocean.example.com` と `sudo ss -lntp` で確認 |
| AIの回答が最後にまとめて出る、途中で切れる | リバースプロキシのバッファリング。Nginxは `proxy_buffering off`、Caddyは `flush_interval -1`（同梱の設定には反映済み） |
| 「ANTHROPIC_API_KEY が設定されていません」 | `.env` / `/etc/ocean-ai.env` に設定後、再起動が必要 |
| 長い文字起こしを貼ると失敗する | Nginxの `client_max_body_size` を増やす（同梱の例は8m） |
| パスワードを忘れた | 管理者が「メンバー管理」→「パスワード再設定」。管理者本人が忘れた場合は下記 |

### 管理者のパスワードを忘れた場合

メールによる自動リセットは実装していません。サーバー上で直接リセットします。

```bash
# Docker構成の例（users.json の passwordHash を作り直す）
sudo docker compose exec app node -e "
const {scryptSync,randomBytes}=require('crypto'),fs=require('fs');
const salt=randomBytes(16).toString('hex');
const hash=scryptSync('新しいパスワード10文字以上',salt,64).toString('hex');
const f='/data/users.json';const u=JSON.parse(fs.readFileSync(f,'utf8'));
u[0].passwordHash='scrypt\$'+salt+'\$'+hash;
fs.writeFileSync(f,JSON.stringify(u,null,2));
console.log('reset:',u[0].email);"
sudo docker compose restart app
```

---

## 人数が増えたとき：DBへの移行

現在の保存先はJSONファイルで、**1プロセスで動かすことが前提**です。
`lib/store.ts` が同一コレクションへの書き込みをプロセス内で直列化しているため、
同じデータディレクトリを複数のインスタンスから同時に書くと壊れます。

目安として、**同時に使う人が10〜20名を超える**、または**冗長化のために複数台で動かしたくなった**
段階でPostgreSQLへ移行してください。それ以前は1台構成のままで問題ありません
（縦に増やす＝サーバーのCPU/メモリを上げる対応で十分です）。

### 移行手順

`lib/store.ts` は `readAll` / `mutate` / `findById` の3つしか公開していません。
この3つを差し替えれば、`repo.ts` から上のコードは変更不要です。

1. PostgreSQLを用意する（マネージドサービスでも可）
2. 依存を追加する

   ```bash
   npm install pg && npm install -D @types/pg
   ```

3. テーブルを作る

   ```sql
   CREATE TABLE IF NOT EXISTS collections (
     name       text PRIMARY KEY,
     rows       jsonb NOT NULL DEFAULT '[]'::jsonb,
     updated_at timestamptz NOT NULL DEFAULT now()
   );
   ```

4. 同梱のテンプレートを使う

   ```bash
   cp lib/store.ts lib/store-json.ts.bak          # 元の実装を残す
   cp lib/store-postgres.ts.example lib/store.ts
   ```

   テンプレートは1コレクション＝1行のJSONBとして持ち、`mutate()` のたびに
   トランザクション内で行ロックを取ります。複数インスタンスから同時に更新しても壊れません。

5. `DATABASE_URL` を設定し、既存データを移行する
   （移行用スクリプトは `lib/store-postgres.ts.example` の末尾にコメントで載せています）

### 複数インスタンスにする際の追加の注意

- **ログイン試行の制限**（`lib/password.ts`）はプロセス内のMapで数えています。
  複数インスタンスにすると「1インスタンスあたり5回」になります。
  厳密に制限したい場合は、失敗回数もDBかRedisに持たせてください。
- **セッションはDB側にあるため共有されます**（Cookieの中身はランダムなトークンのみ）。
  ロードバランサでのスティッキーセッションは不要です。
- データが数万件規模になったら、`collections` テーブルを正規化して部分更新に切り替えてください。
  テンプレートは毎回コレクション全体を読み書きします。

---

## Vercel / Netlify などのサーバーレスについて

**そのままでは動きません。** 実行環境のファイルシステムが揮発するため、
顧客情報もアカウントも次のリクエストで消えます。
サーバーレスで動かす場合は、先に上記のDB移行を済ませてください。
永続ボリュームを持てるコンテナ環境（Fly.io、Render、社内のDockerホストなど）であれば
そのまま動きます。
