import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { updateUser } from '@/lib/repo';
import { toPublicUser } from '@/lib/types';
import type { User } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(toPublicUser(await requireUser()));
  } catch (err) {
    return handleError(err);
  }
}

/** 自分のプロフィールを更新する。役割や有効・無効はここでは変更できない。 */
export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as Partial<User>;
    const updated = await updateUser(user.id, {
      name: body.name?.trim() || undefined,
      experienceYears: Number.isFinite(Number(body.experienceYears))
        ? Number(body.experienceYears)
        : undefined,
      product: body.product,
      territory: body.territory,
      note: body.note,
    });
    return NextResponse.json(updated ? toPublicUser(updated) : null);
  } catch (err) {
    return handleError(err);
  }
}
