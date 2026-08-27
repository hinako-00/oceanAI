import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { deleteKnowledge, findKnowledge, updateKnowledge } from '@/lib/repo';
import type { Knowledge } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const body = (await request.json()) as Partial<Omit<Knowledge, 'id' | 'createdAt'>>;
    const updated = await updateKnowledge(id, body);
    if (!updated) return NextResponse.json({ error: '知識が見つかりません。' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    return handleError(err);
  }
}

/** 社内知識の削除は登録者と管理者だけ。 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const item = await findKnowledge(id);
    if (!item) return NextResponse.json({ error: '知識が見つかりません。' }, { status: 404 });
    if (item.createdBy && item.createdBy !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: '登録者と管理者だけが削除できます。' }, { status: 403 });
    }
    await deleteKnowledge(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
