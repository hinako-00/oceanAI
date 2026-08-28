import assert from 'node:assert/strict';
import test from 'node:test';

import { buildContextBlock, formatCustomer, formatMeetings, formatTendencies } from '../lib/context';
import type { Customer, Meeting, User } from '../lib/types';

const customer: Customer = {
  id: 'c1',
  displayName: '株式会社A',
  fields: {
    coreIssue: { value: '締め処理に月3日', source: 'confirmed', evidence: '3日かかっています', updatedAt: '2026-08-01T00:00:00Z' },
    budget: { value: '月5万円程度か', source: 'ai_hypothesis', updatedAt: '2026-08-01T00:00:00Z' },
  },
  openQuestions: ['決裁フロー'],
  ownerRepId: 'rep-default',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
};

test('顧客カルテは情報源つきで整形され、未登録項目は未確認になる', () => {
  const text = formatCustomer(customer);
  assert.match(text, /本質的な課題: 締め処理に月3日（確認済みの事実/);
  assert.match(text, /予算: 月5万円程度か（AIによる仮説）/);
  // 値のない項目を推測で埋めない。
  assert.match(text, /比較対象・競合: 未確認/);
  assert.match(text, /未確認事項: 決裁フロー/);
});

test('傾向データがない場合は信頼度を低く扱うよう明示する', () => {
  assert.match(formatTendencies(undefined), /信頼度は「低」/);
});

test('参照情報ブロックに仕様のすべての見出しが含まれる', () => {
  const rep: User = {
    id: 'rep-default',
    email: 'yamada@example.com',
    passwordHash: 'scrypt$x$y',
    role: 'member',
    active: true,
    name: '山田',
    experienceYears: 2,
    product: '勤怠SaaS',
    territory: '中小企業',
    note: '',
    tendencies: [],
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
  };
  const block = buildContextBlock({ rep, customer, meetings: [], knowledge: [], nextActions: [] });
  for (const heading of ['【利用者情報】', '【過去の営業傾向】', '【顧客情報】', '【過去の商談履歴】', '【自社営業知識】']) {
    assert.ok(block.includes(heading), `${heading} が含まれていない`);
  }
});

function meeting(overrides: Partial<Meeting>): Meeting {
  return {
    id: 'm1',
    customerId: 'c1',
    repId: 'rep-default',
    date: '2026-08-01',
    title: '初回ヒアリング',
    stage: 'ヒアリング',
    outcome: '継続',
    inputType: 'transcript',
    rawInput: '',
    createdAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

test('長い文字起こしは前半だけでなく終盤も残す', () => {
  // 次回の約束・決裁者・予算といった「次の一手を決める情報」は終盤に出る。
  // 先頭から一律に切ると、そこが必ず失われる。
  const raw = ['冒頭の雑談です。', 'あ'.repeat(60000), '最後に決裁は部長が行うと伺いました。'].join('\n');
  const text = formatMeetings([meeting({ rawInput: raw })]);

  assert.ok(text.includes('冒頭の雑談です。'), '冒頭が残っていない');
  assert.ok(text.includes('最後に決裁は部長が行うと伺いました。'), '終盤が残っていない');
  assert.match(text, /中略：\d+文字を省略/);
});

test('原文が上限に収まるなら省略しない', () => {
  const text = formatMeetings([meeting({ rawInput: '短い商談メモです。', inputType: 'memo' })]);
  assert.ok(text.includes('短い商談メモです。'));
  assert.ok(!text.includes('中略'), '省略の必要がないのに中略が入っている');
  assert.ok(text.includes('[商談メモ]'));
});

test('古い商談も見出しだけにせず抜粋を添える', () => {
  // 見出しだけでは「商談があった」ことしか分からず、参照する意味がない。
  const meetings = Array.from({ length: 8 }, (_, i) =>
    meeting({
      id: `m${i}`,
      // 新しい順に並べ替えられるので、日付で順序を作る。
      date: `2026-08-${String(20 - i).padStart(2, '0')}`,
      rawInput: `${i}件目の商談の中身です。`,
    }),
  );
  const text = formatMeetings(meetings);
  // 6件目以降（原文を厚く付けない側）も中身が読める。
  assert.ok(text.includes('7件目の商談の中身です。'), '古い商談の中身が落ちている');
});

test('参照情報に本日の日付が入る（次回行動の期限の基準）', () => {
  const block = buildContextBlock({
    today: '2026-08-28',
    customer: undefined,
    meetings: [],
    knowledge: [],
    nextActions: [],
  });
  assert.ok(block.includes('【本日の日付】'));
  assert.ok(block.includes('2026-08-28'));
});
