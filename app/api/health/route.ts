import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** 死活監視用。ログイン不要で応答する（内部情報は返さない）。 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
