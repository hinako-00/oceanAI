import { NextResponse } from 'next/server';

import { deleteNextAction, setNextActionDone } from '@/lib/repo';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as { done?: boolean };
  const updated = await setNextActionDone(id, Boolean(body.done));
  if (!updated) return NextResponse.json({ error: '行動が見つかりません。' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await deleteNextAction(id);
  return NextResponse.json({ ok: true });
}
