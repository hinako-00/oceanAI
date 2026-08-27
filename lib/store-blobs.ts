import 'server-only';
import { getDeployStore, getStore } from '@netlify/blobs';
import type { Store } from '@netlify/blobs';

import type { Collection, Schema, StoreBackend } from './store-schema';

/**
 * Netlify Blobs による永続化バックエンド。
 * Netlify Functions はリクエストごとに実行環境が使い捨てられるため、
 * ローカルファイルには書き込めない（lib/store-file.ts はここでは使えない）。
 * 振り分けは lib/store.ts の環境判定で行う。
 *
 * 制約（利用者に必ず伝えること）:
 * ・書き込みは最後に書いたものが勝つ（楽観ロック・トランザクションなし）。
 *   同じレコードを複数人がほぼ同時に更新すると、片方の変更が消える場合がある。
 *   少人数チームでの確認・デモ用途では実用上問題にならないが、
 *   本格運用で書き込みが競合しやすくなってきたらDB移行を検討すること
 *   （DEPLOY.md の「人数が増えたとき：DBへの移行」を参照）。
 */

const STORE_NAME = 'ocean-ai-data';

/**
 * 本番デプロイでは全ブランチ共通のグローバルストアを使い、
 * プレビューデプロイ（PRごとの検証URLなど）では本番データを汚さないよう
 * デプロイ専用ストアを使う。
 */
function getBlobStore(): Store {
  const context = process.env.CONTEXT; // Netlifyが設定する: production / deploy-preview / branch-deploy
  if (context === 'production') {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
  }
  return getDeployStore({ name: STORE_NAME, consistency: 'strong' });
}

/** 同一実行インスタンス内での書き込み直列化。インスタンスをまたぐ競合までは防げない。 */
const queues = new Map<Collection, Promise<unknown>>();

async function readAll<K extends Collection>(collection: K): Promise<Schema[K]> {
  const store = getBlobStore();
  const data = await store.get(collection, { type: 'json' });
  return (Array.isArray(data) ? data : []) as Schema[K];
}

async function writeAll<K extends Collection>(collection: K, rows: Schema[K]): Promise<void> {
  const store = getBlobStore();
  await store.setJSON(collection, rows);
}

async function mutate<K extends Collection, R>(
  collection: K,
  fn: (rows: Schema[K]) => R | Promise<R>,
): Promise<R> {
  const previous = queues.get(collection) ?? Promise.resolve();
  const task = previous.then(async () => {
    const rows = await readAll(collection);
    const result = await fn(rows);
    await writeAll(collection, rows);
    return result;
  });
  queues.set(
    collection,
    task.catch(() => undefined),
  );
  return task;
}

export const backend: StoreBackend = { readAll, mutate };
