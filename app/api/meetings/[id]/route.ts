import { NextResponse } from 'next/server';

import { deleteMeeting, updateMeeting } from '@/lib/repo';
import type { Meeting } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as Partial<Omit<Meeting, 'id' | 'createdAt'>>;
  const updated = await updateMeeting(id, body);
  if (!updated) return NextResponse.json({ error: '商談が見つかりません。' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await deleteMeeting(id);
  return NextResponse.json({ ok: true });
}
