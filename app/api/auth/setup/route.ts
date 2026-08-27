import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { createLoginSession, hashPassword, needsSetup, normalizeEmail, validatePassword } from '@/lib/auth';
import { createUser, listUsers } from '@/lib/repo';
import { toPublicUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** セットアップが必要かどうか（利用者が0人か）を返す。 */
export async function GET() {
  return NextResponse.json({ needsSetup: await needsSetup() });
}

/**
 * 最初の管理者を作成する。利用者が1人でもいる場合は拒否する。
 * 単一利用者モードで作られた既存データがあれば、その担当者IDを引き継ぐ。
 */
export async function POST(request: Request) {
  try {
    if (!(await needsSetup())) {
      throw new Error('既に初期設定が完了しています。ログインしてください。');
    }
    const body = (await request.json()) as { email?: string; name?: string; password?: string };
    const email = normalizeEmail(body.email ?? '');
    const name = (body.name ?? '').trim();
    const password = body.password ?? '';
    if (!email.includes('@')) throw new Error('メールアドレスを正しく入力してください。');
    if (!name) throw new Error('氏名を入力してください。');
    validatePassword(password);

    const user = await createUser(
      { email, name, passwordHash: await hashPassword(password), role: 'admin' },
      // 単一利用者モードで作成された既存データを引き継ぐ。
      'rep-default',
    );
    await createLoginSession(user.id);
    return NextResponse.json({ user: toPublicUser(user), userCount: (await listUsers()).length }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
