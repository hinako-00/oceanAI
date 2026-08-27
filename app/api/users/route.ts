import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { hashPassword, normalizeEmail, requireRole, requireUser, validatePassword } from '@/lib/auth';
import { createUser, listUsers } from '@/lib/repo';
import { toPublicUser } from '@/lib/types';
import type { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** チームの一覧。担当者名の表示や引き継ぎ先の選択に使うため、全員が参照できる。 */
export async function GET() {
  try {
    await requireUser();
    const users = await listUsers();
    return NextResponse.json(users.map(toPublicUser));
  } catch (err) {
    return handleError(err);
  }
}

/** メンバーの追加（管理者のみ）。初回パスワードは管理者が設定して本人に伝える。 */
export async function POST(request: Request) {
  try {
    await requireRole('admin');
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      password?: string;
      role?: UserRole;
    };
    const email = normalizeEmail(body.email ?? '');
    const name = (body.name ?? '').trim();
    if (!email.includes('@')) throw new Error('メールアドレスを正しく入力してください。');
    if (!name) throw new Error('氏名を入力してください。');
    validatePassword(body.password ?? '');

    const user = await createUser({
      email,
      name,
      passwordHash: await hashPassword(body.password ?? ''),
      role: body.role === 'admin' ? 'admin' : 'member',
    });
    return NextResponse.json(toPublicUser(user), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
