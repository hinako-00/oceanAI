import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { addMeeting, listMeetings } from '@/lib/repo';
import type { MeetingInputType } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** アポ履歴もチーム共有。誰のアポかは repId で残る。 */
export async function GET(request: Request) {
  try {
    await requireUser();
    const customerId = new URL(request.url).searchParams.get('customerId') ?? undefined;
    return NextResponse.json(await listMeetings(customerId));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      customerId?: string;
      date?: string;
      title?: string;
      stage?: string;
      inputType?: MeetingInputType;
      rawInput?: string;
      outcome?: string;
    };
    if (!body.customerId) throw new Error('クライアントを選択してください。');
    if (!body.rawInput?.trim()) throw new Error('アポメモまたは文字起こしを入力してください。');

    const meeting = await addMeeting({
      customerId: body.customerId,
      repId: user.id,
      date: body.date || new Date().toISOString().slice(0, 10),
      title: body.title?.trim() || 'アポ',
      stage: body.stage?.trim() || '',
      inputType: body.inputType ?? 'memo',
      rawInput: body.rawInput,
      outcome: body.outcome?.trim() || '',
    });
    return NextResponse.json(meeting, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
