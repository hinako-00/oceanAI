import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * パスワードのハッシュ化とログイン試行制限。
 * next/headers に依存しない純粋な処理だけをここに置き、単体でテストできるようにしている。
 */

const scrypt = promisify(scryptCallback);

const SCRYPT_KEYLEN = 64;
export const MIN_PASSWORD_LENGTH = 10;

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function validatePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください。`, 400);
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const derived = (await scrypt(password, salt, SCRYPT_KEYLEN)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== derived.length) return false;
  // 比較時間からパスワードを推測されないようにする。
  return timingSafeEqual(derived, expected);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// --- ログイン試行の制限 -----------------------------------------------------

/** メールアドレスごとの連続失敗回数。プロセス内のみで保持する。 */
const attempts = new Map<string, { count: number; until: number }>();
export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 15 * 60 * 1000;

export function assertNotLocked(email: string): void {
  const entry = attempts.get(email);
  if (entry && entry.count >= MAX_ATTEMPTS && Date.now() < entry.until) {
    const minutes = Math.ceil((entry.until - Date.now()) / 60000);
    throw new AuthError(`ログインの試行回数が上限に達しました。約${minutes}分後にお試しください。`, 429);
  }
}

export function recordFailure(email: string): void {
  const entry = attempts.get(email);
  const count = entry && Date.now() < entry.until ? entry.count + 1 : 1;
  attempts.set(email, { count, until: Date.now() + LOCK_MS });
}

export function clearFailures(email: string): void {
  attempts.delete(email);
}
