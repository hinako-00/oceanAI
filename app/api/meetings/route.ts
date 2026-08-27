import { NextResponse } from 'next/server';

import { addMeeting, getDefaultRep, listMeetings } from '@/lib/repo';
import type { MeetingInputType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const customerId = new URL(request.url).searchParams.get('customerId') ?? undefined;
  return NextResponse.json(await listMeetings(customerId));
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    customerId?: string;
    date?: string;
    title?: string;
    stage?: string;
    inputType?: MeetingInputType;
    rawInput?: string;
    outcome?: string;
  };
  if (!body.customerId) {
    return NextResponse.json({ error: '顧客を選択してください。' }, { status: 400 });
  }
  if (!body.rawInput?.trim()) {
    return NextResponse.json({ error: '商談メモまたは文字起こしを入力してください。' }, { status: 400 });
  }
  const rep = await getDefaultRep();
  const meeting = await addMeeting({
    customerId: body.customerId,
    repId: rep.id,
    date: body.date || new Date().toISOString().slice(0, 10),
    title: body.title?.trim() || '商談',
    stage: body.stage?.trim() || '',
    inputType: body.inputType ?? 'memo',
    rawInput: body.rawInput,
    outcome: body.outcome?.trim() || '',
  });
  return NextResponse.json(meeting, { status: 201 });
}
