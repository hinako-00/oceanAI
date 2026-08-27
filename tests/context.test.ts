import assert from 'node:assert/strict';
import test from 'node:test';

import { buildContextBlock, formatCustomer, formatTendencies } from '../lib/context';
import type { Customer, RepProfile } from '../lib/types';

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
  const rep: RepProfile = {
    id: 'rep-default',
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
