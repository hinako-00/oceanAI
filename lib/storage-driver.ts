/**
 * 永続化バックエンドの選択ロジック。
 * 環境変数だけを見る純粋関数にして、単体テストで固定できるようにしている
 * （サーバーレス環境でファイルバックエンドのまま動き、読み取り専用のファイルシステムへの
 * 書き込みに失敗する、という事故が起きやすい箇所のため。実際に一度これで失敗している）。
 *
 * 判定の優先順位:
 * 1. STORAGE_DRIVER を明示していればそれに従う（最も確実。Netlifyデプロイでは
 *    Site configuration → Environment variables で STORAGE_DRIVER=blobs を設定すること。
 *    NETLIFY.md 参照）。
 * 2. 明示がなければ、AWS Lambda ランタイム自身が注入する環境変数
 *    （AWS_LAMBDA_FUNCTION_NAME / LAMBDA_TASK_ROOT）でサーバーレス実行を検知する。
 *    Netlify Functions はAWS Lambda上で動くため、これはNetlify自身の設定漏れに
 *    影響されない。実行時の process.env に NETLIFY が乗ってくる保証はない
 *    （Netlifyのコーディング指針でも「実行時は process.env ではなく Netlify.env.* を
 *    使うこと」とされている）ため、NETLIFY 変数だけには頼らない。
 * 3. どちらもなければファイル保存（自前サーバー・Docker運用）。
 */
export type StorageDriver = 'file' | 'blobs';

/** 判定に使う環境変数だけを取り出した最小の型（テストで部分オブジェクトを渡せるようにする）。 */
export type StorageDriverEnv = Record<string, string | undefined>;

export function resolveStorageDriver(env: StorageDriverEnv): StorageDriver {
  if (env.STORAGE_DRIVER === 'file') return 'file';
  if (env.STORAGE_DRIVER === 'blobs') return 'blobs';
  const looksServerless = Boolean(env.NETLIFY || env.AWS_LAMBDA_FUNCTION_NAME || env.LAMBDA_TASK_ROOT);
  return looksServerless ? 'blobs' : 'file';
}
