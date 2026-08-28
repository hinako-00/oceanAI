import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { deleteCustomer, getCustomer, listMeetings, listNextActions, updateCustomer } from '@/lib/repo';
import type { CustomerField, CustomerFieldKey } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const customer = await getCustomer(id);
    if (!customer) return NextResponse.json({ error: 'クライアントが見つかりません。' }, { status: 404 });
    const [meetings, actions] = await Promise.all([listMeetings(id), listNextActions()]);
    return NextResponse.json({
      customer,
      meetings,
      // このクライアントに紐づく次回行動は、担当者に関係なくチーム全員に見せる。
      nextActions: actions.filter((a) => a.customerId === id),
    });
  } catch (err) {
    return handleError(err);
  }
}

/** 共有前提のため、更新はチーム全員が行える。担当者の付け替え（引き継ぎ）もここで行う。 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireUser();
    const { id } = await params;
    const body = (await request.json()) as {
      displayName?: string;
      fields?: Partial<Record<CustomerFieldKey, CustomerField>>;
      openQuestions?: string[];
      ownerRepId?: string;
    };
    const updated = await updateCustomer(id, body);
    if (!updated) return NextResponse.json({ error: 'クライアントが見つかりません。' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    return handleError(err);
  }
}

/** 削除はアポ履歴も消えるため、担当者本人と管理者に限定する。 */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const customer = await getCustomer(id);
    if (!customer) return NextResponse.json({ error: 'クライアントが見つかりません。' }, { status: 404 });
    if (customer.ownerRepId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: '削除できるのは担当者本人と管理者だけです。担当を引き継ぐ場合は担当者を変更してください。' },
        { status: 403 },
      );
    }
    await deleteCustomer(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
