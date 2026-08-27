import { NextResponse } from 'next/server';

import { applyProposal } from '@/lib/apply';
import type { ApplySelection } from '@/lib/apply';
import { getDefaultRep, listProposals, setProposalStatus } from '@/lib/repo';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

/** 更新候補の承認（apply）と却下（reject）。保存はここを通る場合のみ行われる。 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as { action: 'apply' | 'reject'; selection?: ApplySelection };
  const rep = await getDefaultRep();
  const proposal = (await listProposals(rep.id)).find((p) => p.id === id);
  if (!proposal) return NextResponse.json({ error: '更新候補が見つかりません。' }, { status: 404 });
  if (proposal.status !== 'pending') {
    return NextResponse.json({ error: 'この更新候補は処理済みです。' }, { status: 409 });
  }

  if (body.action === 'reject') {
    await setProposalStatus(id, 'rejected');
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  const selection: ApplySelection = body.selection ?? {
    patternIndexes: [],
    nextActionIndexes: [],
    knowledgeIndexes: [],
  };
  const result = await applyProposal(proposal, selection);
  return NextResponse.json({ ok: true, status: 'applied', result });
}
