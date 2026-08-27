import type {
  AuthSession,
  Customer,
  Knowledge,
  Meeting,
  NextAction,
  Session,
  UpdateProposal,
  User,
} from './types';

/**
 * 永続化するコレクションの一覧。
 * ファイル版（lib/store-file.ts）とNetlify Blobs版（lib/store-blobs.ts）の両方が
 * このSchemaを実装する。増やす場合はここに1行足すだけでよい。
 */
export interface Schema {
  customers: Customer[];
  meetings: Meeting[];
  users: User[];
  knowledge: Knowledge[];
  sessions: Session[];
  proposals: UpdateProposal[];
  nextActions: NextAction[];
  authSessions: AuthSession[];
}

export type Collection = keyof Schema;

export const COLLECTIONS: Collection[] = [
  'customers',
  'meetings',
  'users',
  'knowledge',
  'sessions',
  'proposals',
  'nextActions',
  'authSessions',
];

/** 永続化バックエンドが満たすべき最小のインターフェース。 */
export interface StoreBackend {
  readAll<K extends Collection>(collection: K): Promise<Schema[K]>;
  mutate<K extends Collection, R>(
    collection: K,
    fn: (rows: Schema[K]) => R | Promise<R>,
  ): Promise<R>;
}
