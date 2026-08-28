/**
 * 認証まわりの、実行環境を選ばない定数とヘルパー。
 *
 * middleware（Edge）・サーバーコンポーネント・ブラウザの3箇所から参照するため、
 * server-only なものやNode専用APIを持ち込まないこと。
 */

/** ログインセッションのCookie名。 */
export const SESSION_COOKIE = 'ocean_session';

/** ログインなしでアクセスできるパス。 */
export const PUBLIC_PATHS = [
  '/login',
  '/setup',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/setup',
  // 死活監視はロードバランサやコンテナのヘルスチェックから叩かれるため公開する。
  '/api/health',
];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * 遷移先として安全なパスか。
 *
 * `//example.com` は「/」で始まるがブラウザはプロトコル相対URLとして外部サイトへ飛ばすため、
 * 自サイト内への遷移だけを許す判定では必ず弾く。
 */
export function isSafeNextPath(next: string | null | undefined): next is string {
  return Boolean(next) && next!.startsWith('/') && !next!.startsWith('//');
}

/**
 * ログイン画面のURLを組み立てる。
 *
 * @param next    ログイン後に戻す画面。公開パスや外部URLは無視する。
 * @param expired セッション切れによる遷移か。ログイン画面で理由を伝えるために使う。
 */
export function loginPath(next?: string | null, expired = false): string {
  const params = new URLSearchParams();
  // 戻り先がログイン画面自身だと堂々巡りになるので、公開パスは戻り先にしない。
  if (isSafeNextPath(next) && !isPublicPath(next.split('?')[0])) params.set('next', next);
  if (expired) params.set('expired', '1');
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}
