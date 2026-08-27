import { NextResponse } from 'next/server';

import {
  getDefaultRep,
  listCustomers,
  listKnowledge,
  listNextActions,
  listProposals,
  listSessions,
} from '@/lib/repo';

export const dynamic = 'force-dynamic';

/** 画面初期表示に必要なデータをまとめて返す。 */
export async function GET() {
  const rep = await getDefaultRep();
  const [customers, knowledge, sessions, nextActions, proposals] = await Promise.all([
    listCustomers(),
    listKnowledge(),
    listSessions(rep.id),
    listNextActions(rep.id),
    listProposals(rep.id),
  ]);
  return NextResponse.json({
    rep,
    customers,
    knowledge,
    // 一覧では本文は不要なので落とす。
    sessions: sessions.map(({ messages, ...rest }) => ({ ...rest, messageCount: messages.length })),
    nextActions,
    pendingProposals: proposals.filter((p) => p.status === 'pending'),
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
