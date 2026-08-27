import assert from 'node:assert/strict';
import test from 'node:test';

import { extractUpdate, stripPartialBlock } from '../lib/extract';

test('保存候補ブロックがなければ本文をそのまま返す', () => {
  const result = extractUpdate('【総評】よい商談でした。');
  assert.equal(result.body, '【総評】よい商談でした。');
  assert.equal(result.update, undefined);
});

test('保存候補ブロックを本文から切り離す', () => {
  const text = [
    '【総評】課題の具体化ができていました。',
    '',
    '<<<SALES_UPDATE',
    JSON.stringify({
      customerUpdate: {
        displayName: '株式会社A',
        fields: [
          { key: 'coreIssue', value: '締め処理に月3日', source: 'confirmed', evidence: '3日かかっています' },
          { key: 'budget', value: '月5万円まで', source: 'rep_report' },
        ],
        openQuestions: ['決裁フロー'],
      },
      patternUpdates: [
        { axis: 'digging', category: 'improve', text: '深掘りが1段で止まる', basis: '5回中4回', confidence: 'low', dataCount: 2 },
      ],
      nextActions: [{ purpose: '意思決定条件の特定', action: '決裁者を確認', due: '2026-09-03' }],
      knowledgeCandidates: [{ type: 'case', title: '締め処理の訴求', body: '工数を日数で聞くと響く', tags: ['ヒアリング'] }],
    }),
    '>>>',
  ].join('\n');

  const result = extractUpdate(text);
  assert.equal(result.body, '【総評】課題の具体化ができていました。');
  assert.ok(result.update);
  assert.equal(result.update.customerUpdate?.fields.length, 2);
  assert.equal(result.update.customerUpdate?.fields[0].source, 'confirmed');
  assert.equal(result.update.patternUpdates[0].axis, 'digging');
  assert.equal(result.update.nextActions[0].due, '2026-09-03');
  assert.equal(result.update.knowledgeCandidates[0].type, 'case');
});

test('未知のキーや不正な値は落とす', () => {
  const text = `本文\n<<<SALES_UPDATE\n${JSON.stringify({
    customerUpdate: {
      fields: [
        { key: 'unknownKey', value: 'x', source: 'confirmed' },
        { key: 'budget', value: '未定', source: 'でっちあげ' },
        { key: 'coreIssue', value: '   ' },
      ],
      openQuestions: [],
    },
    patternUpdates: [{ axis: '存在しない軸', category: '不明', text: '傾向', dataCount: -3 }],
    nextActions: [{ action: '確認する', due: '来週' }],
  })}\n>>>`;

  const result = extractUpdate(text);
  assert.ok(result.update);
  const fields = result.update.customerUpdate?.fields ?? [];
  assert.equal(fields.length, 1);
  assert.equal(fields[0].key, 'budget');
  // 情報源が不正なときは最も弱い扱い（AI仮説）に倒す。
  assert.equal(fields[0].source, 'ai_hypothesis');
  assert.equal(result.update.patternUpdates[0].axis, 'questioning');
  assert.equal(result.update.patternUpdates[0].confidence, 'low');
  assert.equal(result.update.patternUpdates[0].dataCount, 1);
  // 日付形式が崩れていれば空にして担当者に入力させる。
  assert.equal(result.update.nextActions[0].due, '');
});

test('JSONが壊れていても本文は表示できる', () => {
  const result = extractUpdate('本文です。\n<<<SALES_UPDATE\n{ 壊れたJSON\n>>>');
  assert.equal(result.body, '本文です。');
  assert.equal(result.update, undefined);
});

test('中身が空の保存候補は候補として扱わない', () => {
  const text = `本文\n<<<SALES_UPDATE\n${JSON.stringify({
    customerUpdate: { fields: [], openQuestions: [] },
    patternUpdates: [],
    nextActions: [],
    knowledgeCandidates: [],
  })}\n>>>`;
  assert.equal(extractUpdate(text).update, undefined);
});

test('ストリーミング中の未完成ブロックは画面に出さない', () => {
  assert.equal(stripPartialBlock('回答の途中'), '回答の途中');
  assert.equal(stripPartialBlock('回答\n<<<SALES_UPD'), '回答\n');
  assert.equal(stripPartialBlock('回答\n<<<SALES_UPDATE\n{"a":'), '回答\n');
  assert.equal(stripPartialBlock('回答\n<<<SALES_UPDATE\n{}\n>>>'), '回答');
  // 開始マーカーの断片も隠す。
  assert.equal(stripPartialBlock('回答<<<'), '回答');
});
