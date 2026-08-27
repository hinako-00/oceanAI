import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { deleteTendency } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** 傾向の削除。閲覧は全員できるが、削除できるのは本人と管理者だけ。 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; tendencyId: string }> },
) {
  try {
    const actor = await requireUser();
    const { id, tendencyId } = await params;
    if (actor.id !== id && actor.role !== 'admin') {
      return NextResponse.json({ error: '他のメンバーの記録は削除できません。' }, { status: 403 });
    }
    return NextResponse.json({ ok: await deleteTendency(id, tendencyId) });
  } catch (err) {
    return handleError(err);
  }
}
