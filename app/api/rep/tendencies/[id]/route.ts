import { NextResponse } from 'next/server';

import { deleteTendency, getDefaultRep } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rep = await getDefaultRep();
  const removed = await deleteTendency(rep.id, id);
  return NextResponse.json({ ok: removed });
}
