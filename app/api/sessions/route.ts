import { NextResponse } from 'next/server';

import { createSession, getDefaultRep, listSessions } from '@/lib/repo';
import type { Mode } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rep = await getDefaultRep();
  const sessions = await listSessions(rep.id);
  return NextResponse.json(
    sessions.map(({ messages, ...rest }) => ({ ...rest, messageCount: messages.length })),
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string; customerId?: string; mode?: Mode };
  const rep = await getDefaultRep();
  const session = await createSession({
    repId: rep.id,
    title: body.title?.trim() || '新しい相談',
    customerId: body.customerId,
    mode: body.mode ?? null,
  });
  return NextResponse.json(session, { status: 201 });
}
