import assert from 'node:assert/strict';
import test from 'node:test';

import { parseProposal, SAVE_PROPOSAL_TOOL } from '../lib/proposal';
import { CUSTOMER_FIELD_KEYS, SKILL_AXIS_KEYS, TENDENCY_CATEGORY_KEYS } from '../lib/types';

test('ツール入力を保存候補に変換する', () => {
  const update = parseProposal({
    customerUpdate: {
      customerId: '',
      displayName: '株式会社A',
      fields: [
        { key: 'coreIssue', value: '締め処理に月3日', source: 'confirmed', evidence: '3日かかっています' },
        { key: 'budget', value: '月5万円まで', source: 'rep_report', evidence: '' },
      ],
      openQuestions: ['決裁フロー'],
    },
    patternUpdates: [
      {
        axis: 'digging',
        category: 'improve',
        text: '深掘りが1段で止まる',
        basis: '5回中4回',
        confidence: 'low',
        dataCount: 2,
        neededData: '',
      },
    ],
    nextActions: [{ purpose: '意思決定条件の特定', action: '決裁者を確認', due: '2026-09-03' }],
    knowledgeCandidates: [
      { type: 'case', title: '締め処理の訴求', body: '工数を日数で聞くと響く', tags: ['ヒアリング'] },
    ],
  });

  assert.ok(update);
  assert.equal(update.customerUpdate?.fields.length, 2);
  assert.equal(update.customerUpdate?.fields[0].source, 'confirmed');
  // 空文字の根拠は undefined に寄せて、画面に空行を出さない。
  assert.equal(update.customerUpdate?.fields[1].evidence, undefined);
  assert.equal(update.patternUpdates[0].axis, 'digging');
  assert.equal(update.nextActions[0].due, '2026-09-03');
  assert.equal(update.knowledgeCandidates[0].type, 'case');
});

test('未知のキーや不正な値は落とす', () => {
  // strict:true でスキーマは保証されるが、それでも中身は信用せず検証する。
  const update = parseProposal({
    customerUpdate: {
      customerId: '',
      displayName: '',
      fields: [
        { key: 'unknownKey', value: 'x', source: 'confirmed', evidence: '' },
        { key: 'budget', value: '未定', source: 'でっちあげ', evidence: '' },
        { key: 'coreIssue', value: '   ', source: 'confirmed', evidence: '' },
      ],
      openQuestions: [],
    },
    patternUpdates: [{ axis: '存在しない軸', category: '不明', text: '傾向', dataCount: -3 }],
    nextActions: [{ action: '確認する', due: '来週' }],
    knowledgeCandidates: [],
  });

  assert.ok(update);
  const fields = update.customerUpdate?.fields ?? [];
  assert.equal(fields.length, 1);
  assert.equal(fields[0].key, 'budget');
  // 情報源が不正なときは最も弱い扱い（AI仮説）に倒す。
  assert.equal(fields[0].source, 'ai_hypothesis');
  assert.equal(update.patternUpdates[0].axis, 'questioning');
  assert.equal(update.patternUpdates[0].confidence, 'low');
  assert.equal(update.patternUpdates[0].dataCount, 1);
  // 日付形式が崩れていれば空にして担当者に入力させる。
  assert.equal(update.nextActions[0].due, '');
});

test('中身が空の呼び出しは候補として扱わない', () => {
  assert.equal(
    parseProposal({
      customerUpdate: { customerId: '', displayName: '', fields: [], openQuestions: [] },
      patternUpdates: [],
      nextActions: [],
      knowledgeCandidates: [],
    }),
    undefined,
  );
  assert.equal(parseProposal(undefined), undefined);
  assert.equal(parseProposal('文字列'), undefined);
});

test('ツールのスキーマは strict の要求を満たす', () => {
  // strict:true では、すべてのオブジェクトが additionalProperties:false を持ち、
  // すべてのプロパティが required に入っている必要がある。
  // 1箇所でも漏れるとAPIが400を返し、保存候補の機能ごと止まる。
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    const schema = node as Record<string, unknown>;
    if (schema.type === 'object') {
      assert.equal(schema.additionalProperties, false, `${path}: additionalProperties が false でない`);
      const properties = (schema.properties ?? {}) as Record<string, unknown>;
      const required = (schema.required ?? []) as string[];
      assert.deepEqual(
        [...Object.keys(properties)].sort(),
        [...required].sort(),
        `${path}: required が全プロパティを網羅していない`,
      );
      for (const [key, value] of Object.entries(properties)) walk(value, `${path}.${key}`);
    }
    if (schema.type === 'array') walk(schema.items, `${path}[]`);
  };

  assert.equal(SAVE_PROPOSAL_TOOL.strict, true);
  walk(SAVE_PROPOSAL_TOOL.input_schema, 'input_schema');
});

test('スキーマの列挙値はアプリの定義と一致する', () => {
  // ここがずれると、モデルは通るのにアプリ側の検証で落ちて候補が黙って消える。
  const schema = SAVE_PROPOSAL_TOOL.input_schema.properties;
  const fieldItems = schema.customerUpdate.properties.fields.items.properties;
  assert.deepEqual(fieldItems.key.enum, CUSTOMER_FIELD_KEYS);

  const patternItems = schema.patternUpdates.items.properties;
  assert.deepEqual(patternItems.axis.enum, SKILL_AXIS_KEYS);
  assert.deepEqual(patternItems.category.enum, TENDENCY_CATEGORY_KEYS);
});
