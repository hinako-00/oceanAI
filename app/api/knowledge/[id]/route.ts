import { NextResponse } from 'next/server';

import { deleteKnowledge, updateKnowledge } from '@/lib/repo';
import type { Knowledge } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as Partial<Omit<Knowledge, 'id' | 'createdAt'>>;
  const updated = await updateKnowledge(id, body);
  if (!updated) return NextResponse.json({ error: '知識が見つかりません。' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await deleteKnowledge(id);
  return NextResponse.json({ ok: true });
}
