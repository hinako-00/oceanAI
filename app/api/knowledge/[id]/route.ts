import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { pickKnowledgePatch } from '@/lib/editable';
import { requireUser } from '@/lib/auth';
import { deleteKnowledge, findKnowledge, updateKnowledge } from '@/lib/repo';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

/** 社内知識の編集は登録者と管理者だけ（削除と同じ基準）。 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const item = await findKnowledge(id);
    if (!item) return NextResponse.json({ error: '知識が見つかりません。' }, { status: 404 });
    if (item.createdBy && item.createdBy !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: '登録者と管理者だけが編集できます。' }, { status: 403 });
    }
    const updated = await updateKnowledge(id, pickKnowledgePatch(await request.json()));
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
