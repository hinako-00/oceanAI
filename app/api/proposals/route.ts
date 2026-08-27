import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { listProposals } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const status = new URL(request.url).searchParams.get('status');
    const proposals = await listProposals(user.id);
    return NextResponse.json(status ? proposals.filter((p) => p.status === status) : proposals);
  } catch (err) {
    return handleError(err);
  }
}
