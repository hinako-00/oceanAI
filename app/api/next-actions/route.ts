import { NextResponse } from 'next/server';

import { addNextAction, getDefaultRep, listNextActions } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rep = await getDefaultRep();
  return NextResponse.json(await listNextActions(rep.id));
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    purpose?: string;
    action?: string;
    due?: string;
    customerId?: string;
  };
  if (!body.action?.trim()) {
    return NextResponse.json({ error: '行動内容を入力してください。' }, { status: 400 });
  }
  const rep = await getDefaultRep();
  const action = await addNextAction({
    repId: rep.id,
    purpose: body.purpose?.trim() ?? '',
    action: body.action.trim(),
    due: body.due ?? '',
    customerId: body.customerId,
    done: false,
  });
  return NextResponse.json(action, { status: 201 });
}
