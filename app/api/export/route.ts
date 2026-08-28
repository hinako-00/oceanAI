import { NextResponse } from 'next/server';

import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { csvFileName, toCsv } from '@/lib/csv';
import { listCustomers, listMeetings, listNextActions, listUsers } from '@/lib/repo';
import {
  CUSTOMER_FIELD_KEYS,
  CUSTOMER_FIELD_LABEL,
  FACT_SOURCE_LABEL,
  MEETING_INPUT_TYPE_LABEL,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * 一覧のCSV書き出し。
 * Excelで集計したり、他のツールへ渡したりするための出口。
 */
const KINDS = ['customers', 'meetings', 'actions'] as const;
type Kind = (typeof KINDS)[number];

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const kind = new URL(request.url).searchParams.get('kind') as Kind | null;
    if (!kind || !KINDS.includes(kind)) {
      return NextResponse.json({ error: '書き出す種類が正しくありません。' }, { status: 400 });
    }

    const users = await listUsers();
    const userName = (id?: string) => (id ? users.find((u) => u.id === id)?.name ?? '（不明）' : '');
    const rows: Array<Array<unknown>> = [];

    if (kind === 'customers') {
      const customers = await listCustomers();
      rows.push([
        'クライアント',
        '担当者',
        ...CUSTOMER_FIELD_KEYS.flatMap((key) => [CUSTOMER_FIELD_LABEL[key], `${CUSTOMER_FIELD_LABEL[key]}の情報源`]),
        '未確認事項',
        '最終更新',
      ]);
      for (const customer of customers) {
        rows.push([
          customer.displayName,
          userName(customer.ownerRepId),
          // 値と情報源を必ず対にする。値だけ持ち出すと、確認済みの事実とAIの仮説が
          // 区別できなくなり、このアプリが守っている前提が壊れる。
          ...CUSTOMER_FIELD_KEYS.flatMap((key) => {
            const field = customer.fields[key];
            return field?.value ? [field.value, FACT_SOURCE_LABEL[field.source]] : ['', '未確認'];
          }),
          customer.openQuestions.join(' / '),
          customer.updatedAt.slice(0, 10),
        ]);
      }
    }

    if (kind === 'meetings') {
      const [meetings, customers] = await Promise.all([listMeetings(), listCustomers()]);
      const customerName = (id: string) =>
        customers.find((c) => c.id === id)?.displayName ?? '（削除済み）';
      rows.push(['アポの日付', 'クライアント', '担当者', 'アポの名称', '段階', '結果', '入力の種類', 'アポメモ・文字起こし']);
      for (const meeting of meetings) {
        rows.push([
          meeting.date,
          customerName(meeting.customerId),
          userName(meeting.repId),
          meeting.title,
          meeting.stage,
          meeting.outcome,
          MEETING_INPUT_TYPE_LABEL[meeting.inputType],
          meeting.rawInput,
        ]);
      }
    }

    if (kind === 'actions') {
      // 次回行動は画面と同じく本人のぶんだけ書き出す。
      const [actions, customers] = await Promise.all([listNextActions(user.id), listCustomers()]);
      rows.push(['期限', '状態', 'クライアント', '担当者', '行動', '目的']);
      for (const action of actions) {
        rows.push([
          action.due,
          action.done ? '完了' : '未完了',
          action.customerId
            ? customers.find((c) => c.id === action.customerId)?.displayName ?? '（削除済み）'
            : '',
          userName(action.repId),
          action.action,
          action.purpose,
        ]);
      }
    }

    const fileName = csvFileName(kind, new Date().toISOString().slice(0, 10));
    return new NextResponse(toCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        // ブラウザに保存させる。ファイル名は日本語を含まないのでそのまま渡せる。
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
