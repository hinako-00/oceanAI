import { NextResponse } from 'next/server';

import { deleteCustomer, getCustomer, listMeetings, updateCustomer } from '@/lib/repo';
import type { CustomerField, CustomerFieldKey } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) return NextResponse.json({ error: '顧客が見つかりません。' }, { status: 404 });
  const meetings = await listMeetings(id);
  return NextResponse.json({ customer, meetings });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as {
    displayName?: string;
    fields?: Partial<Record<CustomerFieldKey, CustomerField>>;
    openQuestions?: string[];
  };
  const updated = await updateCustomer(id, body);
  if (!updated) return NextResponse.json({ error: '顧客が見つかりません。' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  await deleteCustomer(id);
  return NextResponse.json({ ok: true });
}
