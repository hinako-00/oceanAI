import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import {
  AuthError,
  createLoginSession,
  hashPassword,
  requireUser,
  revokeSessionsFor,
  validatePassword,
  verifyPassword,
} from '@/lib/auth';
import { updateUser } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** 自分のパスワードを変更する。現在のパスワードの確認を必須にする。 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { current?: string; next?: string };
    if (!(await verifyPassword(body.current ?? '', user.passwordHash))) {
      throw new AuthError('現在のパスワードが違います。', 401);
    }
    validatePassword(body.next ?? '');
    await updateUser(user.id, { passwordHash: await hashPassword(body.next ?? '') });
    // 変更前のセッションはすべて無効化し、この端末だけログインし直す。
    await revokeSessionsFor(user.id);
    await createLoginSession(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
