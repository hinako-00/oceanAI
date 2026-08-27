import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { hashPassword, requireUser, revokeSessionsFor, validatePassword } from '@/lib/auth';
import { getUser, listUsers, updateUser } from '@/lib/repo';
import { toPublicUser } from '@/lib/types';
import type { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

/** メンバーの詳細。営業傾向はチーム内で共有する方針のため全員が参照できる。 */
export async function GET(_request: Request, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const user = await getUser(id);
    if (!user) return NextResponse.json({ error: 'メンバーが見つかりません。' }, { status: 404 });
    return NextResponse.json(toPublicUser(user));
  } catch (err) {
    return handleError(err);
  }
}

/** 役割・有効無効・パスワード再設定（管理者のみ）。 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const actor = await requireUser();
    const { id } = await params;
    if (actor.role !== 'admin') {
      return NextResponse.json({ error: 'この操作は管理者のみ実行できます。' }, { status: 403 });
    }
    const target = await getUser(id);
    if (!target) return NextResponse.json({ error: 'メンバーが見つかりません。' }, { status: 404 });

    const body = (await request.json()) as {
      role?: UserRole;
      active?: boolean;
      password?: string;
      name?: string;
    };

    // 最後の管理者を失うと誰も管理できなくなるため、降格・無効化を止める。
    const admins = (await listUsers()).filter((u) => u.role === 'admin' && u.active);
    const losingLastAdmin =
      target.role === 'admin' &&
      target.active &&
      admins.length === 1 &&
      (body.role === 'member' || body.active === false);
    if (losingLastAdmin) {
      throw new Error('管理者が0人になるため、この変更はできません。先に別の管理者を追加してください。');
    }

    const passwordHash = body.password ? (validatePassword(body.password), await hashPassword(body.password)) : undefined;
    const updated = await updateUser(id, {
      role: body.role,
      active: body.active,
      name: body.name?.trim() || undefined,
      passwordHash,
    });

    // 無効化・パスワード再設定の場合は、そのメンバーのログインを打ち切る。
    if (body.active === false || passwordHash) await revokeSessionsFor(id);

    return NextResponse.json(updated ? toPublicUser(updated) : null);
  } catch (err) {
    return handleError(err);
  }
}
