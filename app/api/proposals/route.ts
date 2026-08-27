import { NextResponse } from 'next/server';

import { getDefaultRep, listProposals } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get('status');
  const rep = await getDefaultRep();
  const proposals = await listProposals(rep.id);
  return NextResponse.json(status ? proposals.filter((p) => p.status === status) : proposals);
}
