import 'server-only';
import { randomUUID } from 'node:crypto';

import type { Collection, Schema, StoreBackend } from './store-schema';
import { resolveStorageDriver } from './storage-driver';

export type { Collection, Schema } from './store-schema';

/**
 * 永続化層の入口。
 *
 * 実体は環境に応じて次のどちらかに振り分ける。
 * ・lib/store-file.ts  … JSONファイル（自前サーバー・Docker運用）
 * ・lib/store-blobs.ts … Netlify Blobs（Netlifyへのデプロイ）
 *
 * repo.ts / auth.ts など上位のコードはこのファイルの3関数だけを使うため、
 * バックエンドを増やす場合もこのファイルを直すだけでよい。
 */

export function newId(): string {
  return randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

let backendPromise: Promise<StoreBackend> | null = null;

function getBackend(): Promise<StoreBackend> {
  if (!backendPromise) {
    backendPromise =
      resolveStorageDriver(process.env) === 'blobs'
        ? import('./store-blobs').then((m) => m.backend)
        : import('./store-file').then((m) => m.backend);
  }
  return backendPromise;
}

export async function readAll<K extends Collection>(collection: K): Promise<Schema[K]> {
  const backend = await getBackend();
  return backend.readAll(collection);
}

export async function mutate<K extends Collection, R>(
  collection: K,
  fn: (rows: Schema[K]) => R | Promise<R>,
): Promise<R> {
  const backend = await getBackend();
  return backend.mutate(collection, fn);
}

export async function findById<K extends Collection>(
  collection: K,
  id: string,
): Promise<Schema[K][number] | undefined> {
  const rows = await readAll(collection);
  return (rows as Array<{ id: string }>).find((row) => row.id === id) as
    | Schema[K][number]
    | undefined;
}
