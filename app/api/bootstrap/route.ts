import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import {
  listCustomers,
  listKnowledge,
  listMeetings,
  listNextActions,
  listProposals,
  listSessions,
  listUsers,
} from '@/lib/repo';
import { toPublicUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** 積み上げの集計に使う期間。これより古い記録の時刻は画面へ送らない。 */
const ACTIVITY_WINDOW_DAYS = 30;

/**
 * 画面初期表示に必要なデータをまとめて返す。
 * クライアント・アポ・知識・メンバーはチーム共有、相談履歴と保存候補は本人のものだけ。
 */
export async function GET() {
  try {
    const user = await requireUser();
    const [customers, knowledge, sessions, nextActions, proposals, users, meetings] = await Promise.all([
      listCustomers(),
      listKnowledge(),
      listSessions(user.id),
      listNextActions(user.id),
      listProposals(user.id),
      listUsers(),
      listMeetings(),
    ]);

    // 積み上げの表示に必要なのは「いつ入れたか」だけ。
    // アポの原文は長いので画面へは送らない。日付の区切りは端末のローカル時刻で
    // 行いたいので、集計はせず作成時刻をそのまま渡す。
    const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const mine = customers.filter((customer) => customer.ownerRepId === user.id);
    const activity = {
      meetings: meetings
        .filter((meeting) => meeting.repId === user.id && meeting.createdAt >= since)
        .map((meeting) => meeting.createdAt),
      knowledge: knowledge
        .filter((item) => item.createdBy === user.id && item.createdAt >= since)
        .map((item) => item.createdAt),
      openQuestions: mine.reduce((sum, customer) => sum + customer.openQuestions.length, 0),
      customers: mine.length,
    };
    return NextResponse.json({
      user: toPublicUser(user),
      users: users.map(toPublicUser),
      customers,
      knowledge,
      // 一覧では本文は不要なので落とす。
      sessions: sessions.map(({ messages, ...rest }) => ({ ...rest, messageCount: messages.length })),
      nextActions,
      pendingProposals: proposals.filter((p) => p.status === 'pending'),
      activity,
      hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    });
  } catch (err) {
    return handleError(err);
  }
}
