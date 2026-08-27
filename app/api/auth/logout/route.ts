import { NextResponse } from 'next/server';

import { destroyLoginSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  await destroyLoginSession();
  return NextResponse.json({ ok: true });
}
