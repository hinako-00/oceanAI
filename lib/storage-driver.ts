/**
 * 永続化バックエンドの選択ロジック。
 * 環境変数だけを見る純粋関数にして、単体テストで固定できるようにしている
 * （Netlify上でファイルバックエンドのまま動くとデータが毎回消える、という
 * 事故が起きやすい箇所のため）。
 */
export type StorageDriver = 'file' | 'blobs';

/** 判定に使う環境変数だけを取り出した最小の型（テストで部分オブジェクトを渡せるようにする）。 */
export type StorageDriverEnv = Record<string, string | undefined>;

export function resolveStorageDriver(env: StorageDriverEnv): StorageDriver {
  if (env.STORAGE_DRIVER === 'file') return 'file';
  if (env.STORAGE_DRIVER === 'blobs') return 'blobs';
  // NETLIFY はビルド時・実行時ともにNetlifyが自動で設定する。
  return env.NETLIFY ? 'blobs' : 'file';
}
