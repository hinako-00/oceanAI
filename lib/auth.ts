import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

import { SESSION_COOKIE } from './auth-constants';
import { mutate, newId, now, readAll } from './store';
import type { User, UserRole } from './types';

export { SESSION_COOKIE };
import { AuthError } from './password';

export {
  AuthError,
  assertNotLocked,
  clearFailures,
  hashPassword,
  normalizeEmail,
  recordFailure,
  validatePassword,
  verifyPassword,
} from './password';

/**
 * 認証。社内利用を前提に、外部サービスなしで完結させている。
 *
 * ・パスワードは scrypt でハッシュ化して保存する（平文は保持しない）
 * ・ログイントークンはランダム値。サーバーにはハッシュだけを保存する
 * ・Cookie は httpOnly / SameSite=Lax。JavaScriptから読めず、クロスサイトのPOSTでも送られない
 */

const SESSION_DAYS = 30;

// --- ログインセッション -----------------------------------------------------

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** ログインセッションを作成し、Cookieに載せるトークンを返す。 */
export async function createLoginSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await mutate('authSessions', (rows) => {
    // 期限切れのセッションはこの機会に捨てる。
    const alive = rows.filter((row) => row.expiresAt > now());
    rows.length = 0;
    rows.push(...alive, {
      id: newId(),
      tokenHash: hashToken(token),
      userId,
      createdAt: now(),
      expiresAt,
      lastSeenAt: now(),
    });
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return token;
}

export async function destroyLoginSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await mutate('authSessions', (rows) => {
      const index = rows.findIndex((row) => row.tokenHash === tokenHash);
      if (index >= 0) rows.splice(index, 1);
    });
  }
  store.delete(SESSION_COOKIE);
}

/** ログイン中の利用者を返す。未ログインなら null。 */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const sessions = await readAll('authSessions');
  const session = sessions.find((row) => row.tokenHash === tokenHash);
  if (!session || session.expiresAt <= now()) return null;

  const users = await readAll('users');
  const user = users.find((row) => row.id === session.userId);
  // 無効化された利用者のセッションは通さない。
  if (!user || !user.active) return null;
  return user;
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('ログインが必要です。', 401);
  return user;
}

export async function requireRole(role: UserRole): Promise<User> {
  const user = await requireUser();
  if (role === 'admin' && user.role !== 'admin') {
    throw new AuthError('この操作は管理者のみ実行できます。', 403);
  }
  return user;
}

/** 利用者が1人もいない状態か（初期セットアップが必要か）。 */
export async function needsSetup(): Promise<boolean> {
  const users = await readAll('users');
  return users.length === 0;
}

/** 対象利用者のセッションをすべて無効化する（無効化・パスワード変更時に使う）。 */
export async function revokeSessionsFor(userId: string): Promise<void> {
  await mutate('authSessions', (rows) => {
    for (let i = rows.length - 1; i >= 0; i -= 1) {
      if (rows[i].userId === userId) rows.splice(i, 1);
    }
  });
}
