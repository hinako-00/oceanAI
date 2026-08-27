import 'server-only';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import type {
  Customer,
  Knowledge,
  Meeting,
  NextAction,
  RepProfile,
  Session,
  UpdateProposal,
} from './types';

/**
 * JSONファイルによる単純な永続化層。
 * 社内利用（少人数・単一プロセス）を前提にしている。
 * DBへ差し替える場合はこのファイルのエクスポートだけを置き換えればよい。
 */

const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR ?? './data');

interface Schema {
  customers: Customer[];
  meetings: Meeting[];
  reps: RepProfile[];
  knowledge: Knowledge[];
  sessions: Session[];
  proposals: UpdateProposal[];
  nextActions: NextAction[];
}

type Collection = keyof Schema;

const FILES: Record<Collection, string> = {
  customers: 'customers.json',
  meetings: 'meetings.json',
  reps: 'reps.json',
  knowledge: 'knowledge.json',
  sessions: 'sessions.json',
  proposals: 'proposals.json',
  nextActions: 'next-actions.json',
};

/** ファイルごとの書き込みを直列化するためのキュー。読み書きの競合を防ぐ。 */
const queues = new Map<Collection, Promise<unknown>>();

export function newId(): string {
  return randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readAll<K extends Collection>(collection: K): Promise<Schema[K]> {
  await ensureDir();
  const file = path.join(DATA_DIR, FILES[collection]);
  try {
    const raw = await fs.readFile(file, 'utf8');
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed) ? parsed : []) as Schema[K];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [] as Schema[K];
    throw err;
  }
}

async function writeAll<K extends Collection>(collection: K, rows: Schema[K]): Promise<void> {
  await ensureDir();
  const file = path.join(DATA_DIR, FILES[collection]);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, file);
}

/**
 * コレクションを読み込み、更新関数を適用して書き戻す。
 * 同一コレクションへの更新は到着順に直列化される。
 */
export async function mutate<K extends Collection, R>(
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
  // 失敗しても後続の更新が止まらないようにする。
  queues.set(
    collection,
    task.catch(() => undefined),
  );
  return task;
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
