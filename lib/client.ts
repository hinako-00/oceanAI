import { isPublicPath, loginPath } from './auth-constants';

/** セッション切れを表すエラー。画面側で通常の通信エラーと区別したいときに使う。 */
export class SessionExpiredError extends Error {
  constructor() {
    super('セッションの有効期限が切れました。ログイン画面へ移動します。');
    this.name = 'SessionExpiredError';
  }
}

/**
 * セッション切れを検知したらログイン画面へ送る。
 *
 * middleware はCookieの有無しか見られないため、Cookieが残ったまま中身が失効している場合
 * （30日経過、管理者による無効化、パスワード変更による失効）はAPIの401で初めて分かる。
 * 各画面がそれぞれエラー表示するだけだと、利用者は画面に留まったまま操作できなくなる。
 */
export function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  // ログイン画面自身での401（初期設定の確認など）で堂々巡りにしない。
  if (isPublicPath(pathname)) return;
  window.location.replace(loginPath(`${pathname}${search}`, true));
}

/** クライアント側の共通fetchヘルパ。 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin();
      throw new SessionExpiredError();
    }
    let message = `通信に失敗しました（${response.status}）`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // JSON以外のエラー応答はそのまま既定メッセージを使う。
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export const jsonBody = (data: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(data),
});

export const patchBody = (data: unknown): RequestInit => ({
  method: 'PATCH',
  body: JSON.stringify(data),
});

export function formatDate(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
