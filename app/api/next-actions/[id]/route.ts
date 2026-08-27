import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { deleteNextAction, findNextAction, setNextActionDone } from '@/lib/repo';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

/** 完了状態の変更・削除は担当者本人と管理者だけ。 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const action = await findNextAction(id);
    if (!action) return NextResponse.json({ error: '行動が見つかりません。' }, { status: 404 });
    if (action.repId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: '他のメンバーの行動は変更できません。' }, { status: 403 });
    }
    const body = (await request.json()) as { done?: boolean };
    return NextResponse.json(await setNextActionDone(id, Boolean(body.done)));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const action = await findNextAction(id);
    if (!action) return NextResponse.json({ error: '行動が見つかりません。' }, { status: 404 });
    if (action.repId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: '他のメンバーの行動は削除できません。' }, { status: 403 });
    }
    await deleteNextAction(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
