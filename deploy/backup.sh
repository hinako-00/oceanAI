#!/bin/sh
# 顧客情報・商談履歴・アカウント情報のバックアップ。
# cron 例（毎日3時）: 0 3 * * * /opt/ocean-ai/deploy/backup.sh >> /var/log/ocean-backup.log 2>&1
set -eu

# Docker構成なら: DATA_DIR="" とし、docker cp でボリュームから取り出す（下部参照）
DATA_DIR="${DATA_DIR:-/var/lib/ocean-ai}"
DEST="${BACKUP_DIR:-/var/backups/ocean-ai}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)

if [ -n "$DATA_DIR" ] && [ -d "$DATA_DIR" ]; then
  tar czf "$DEST/ocean-$STAMP.tar.gz" -C "$DATA_DIR" .
else
  # Docker構成: 実行中のコンテナからデータを取り出す
  docker compose exec -T app tar cz -C /data . > "$DEST/ocean-$STAMP.tar.gz"
fi

chmod 600 "$DEST/ocean-$STAMP.tar.gz"

# 古いバックアップを削除
find "$DEST" -name 'ocean-*.tar.gz' -mtime "+$KEEP_DAYS" -delete

echo "backup done: $DEST/ocean-$STAMP.tar.gz"
