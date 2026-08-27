import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import {
  assertNotLocked,
  AuthError,
  clearFailures,
  createLoginSession,
  normalizeEmail,
  recordFailure,
  verifyPassword,
} from '@/lib/auth';
import { findUserByEmail, updateUser } from '@/lib/repo';
import { toPublicUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = normalizeEmail(body.email ?? '');
    const password = body.password ?? '';
    assertNotLocked(email);

    const user = await findUserByEmail(email);
    // 「メールが存在しない」と「パスワードが違う」を区別させない。
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok || !user.active) {
      recordFailure(email);
      throw new AuthError('メールアドレスまたはパスワードが違います。', 401);
    }

    clearFailures(email);
    await updateUser(user.id, { lastLoginAt: new Date().toISOString() });
    await createLoginSession(user.id);
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (err) {
    return handleError(err);
  }
}
