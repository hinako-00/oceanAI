import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { createSession, listSessions } from '@/lib/repo';
import type { Mode } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** 相談履歴は本人のみ。個人的な相談内容が他のメンバーに見えないようにする。 */
export async function GET() {
  try {
    const user = await requireUser();
    const sessions = await listSessions(user.id);
    return NextResponse.json(
      sessions.map(({ messages, ...rest }) => ({ ...rest, messageCount: messages.length })),
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { title?: string; customerId?: string; mode?: Mode };
    const session = await createSession({
      repId: user.id,
      title: body.title?.trim() || '新しい相談',
      customerId: body.customerId,
      mode: body.mode ?? null,
    });
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
