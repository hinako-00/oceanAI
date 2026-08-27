import { NextResponse } from 'next/server';

import { createCustomer, getDefaultRep, listCustomers } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await listCustomers());
}

export async function POST(request: Request) {
  const body = (await request.json()) as { displayName?: string };
  const rep = await getDefaultRep();
  const customer = await createCustomer((body.displayName ?? '').trim(), rep.id);
  return NextResponse.json(customer, { status: 201 });
}
