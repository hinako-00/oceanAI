import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import {
  listCustomers,
  listKnowledge,
  listNextActions,
  listProposals,
  listSessions,
  listUsers,
} from '@/lib/repo';
import { toPublicUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * 画面初期表示に必要なデータをまとめて返す。
 * 顧客・商談・知識・メンバーはチーム共有、相談履歴と保存候補は本人のものだけ。
 */
export async function GET() {
  try {
    const user = await requireUser();
    const [customers, knowledge, sessions, nextActions, proposals, users] = await Promise.all([
      listCustomers(),
      listKnowledge(),
      listSessions(user.id),
      listNextActions(user.id),
      listProposals(user.id),
      listUsers(),
    ]);
    return NextResponse.json({
      user: toPublicUser(user),
      users: users.map(toPublicUser),
      customers,
      knowledge,
      // 一覧では本文は不要なので落とす。
      sessions: sessions.map(({ messages, ...rest }) => ({ ...rest, messageCount: messages.length })),
      nextActions,
      pendingProposals: proposals.filter((p) => p.status === 'pending'),
      hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    });
  } catch (err) {
    return handleError(err);
  }
}
