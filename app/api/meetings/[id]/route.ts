import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { deleteMeeting, findMeeting, updateMeeting } from '@/lib/repo';
import type { Meeting } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const body = (await request.json()) as Partial<Omit<Meeting, 'id' | 'createdAt'>>;
    const updated = await updateMeeting(id, body);
    if (!updated) return NextResponse.json({ error: '商談が見つかりません。' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    return handleError(err);
  }
}

/** 商談記録の削除は、その商談を行った本人と管理者だけ。 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const meeting = await findMeeting(id);
    if (!meeting) return NextResponse.json({ error: '商談が見つかりません。' }, { status: 404 });
    if (meeting.repId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: '他のメンバーの商談記録は削除できません。' }, { status: 403 });
    }
    await deleteMeeting(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
