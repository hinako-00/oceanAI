import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { deleteSession, getSession, updateSession } from '@/lib/repo';
import type { Session, User } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

/** 相談は本人のものだけを扱う。他人のIDを指定しても見えないようにする。 */
async function ownSession(user: User, id: string): Promise<Session | null> {
  const session = await getSession(id);
  if (!session || session.repId !== user.id) return null;
  return session;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const session = await ownSession(user, id);
    if (!session) return NextResponse.json({ error: '会話が見つかりません。' }, { status: 404 });
    return NextResponse.json(session);
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!(await ownSession(user, id))) {
      return NextResponse.json({ error: '会話が見つかりません。' }, { status: 404 });
    }
    const body = (await request.json()) as Partial<
      Pick<Session, 'title' | 'mode' | 'customerId' | 'roleplay'>
    >;
    return NextResponse.json(await updateSession(id, body));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!(await ownSession(user, id))) {
      return NextResponse.json({ error: '会話が見つかりません。' }, { status: 404 });
    }
    await deleteSession(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
