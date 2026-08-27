# ============================================================
# Ocean AI 本番用イメージ
# 依存関係のインストール → ビルド → 実行 の3段構成で、
# 最終イメージには実行に必要なファイルだけを残す。
# ============================================================

# --- 1. 依存関係 -------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- 2. ビルド ---------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- 3. 実行 -----------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# 顧客情報の保存先。docker compose 側で名前付きボリュームを割り当てる。
ENV DATA_DIR=/data

# rootで動かさない。
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /data && chown -R nextjs:nodejs /data

# standalone 出力には実行に必要な node_modules だけが含まれる。
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
VOLUME ["/data"]

# ヘルスチェックはログイン不要の /api/health を使う。
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
