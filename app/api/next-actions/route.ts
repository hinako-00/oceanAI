import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { addNextAction, listNextActions } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** scope=team でチーム全員の次回行動を返す（顧客が共有のため引き継ぎに使う）。 */
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const scope = new URL(request.url).searchParams.get('scope');
    return NextResponse.json(await listNextActions(scope === 'team' ? undefined : user.id));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      purpose?: string;
      action?: string;
      due?: string;
      customerId?: string;
    };
    if (!body.action?.trim()) throw new Error('行動内容を入力してください。');
    const action = await addNextAction({
      repId: user.id,
      purpose: body.purpose?.trim() ?? '',
      action: body.action.trim(),
      due: body.due ?? '',
      customerId: body.customerId,
      done: false,
    });
    return NextResponse.json(action, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
