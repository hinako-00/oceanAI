import { NextResponse } from 'next/server';

import { deleteSession, getSession, updateSession } from '@/lib/repo';
import type { Session } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) return NextResponse.json({ error: '会話が見つかりません。' }, { status: 404 });
  return NextResponse.json(session);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as Partial<Pick<Session, 'title' | 'mode' | 'customerId' | 'roleplay'>>;
  const updated = await updateSession(id, body);
  if (!updated) return NextResponse.json({ error: '会話が見つかりません。' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await deleteSession(id);
  return NextResponse.json({ ok: true });
}
