import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { createCustomer, listCustomers } from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** 顧客カルテはチーム全員で共有する。 */
export async function GET() {
  try {
    await requireUser();
    return NextResponse.json(await listCustomers());
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { displayName?: string; ownerRepId?: string };
    const customer = await createCustomer((body.displayName ?? '').trim(), body.ownerRepId || user.id);
    return NextResponse.json(customer, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
