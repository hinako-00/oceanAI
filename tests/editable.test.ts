import assert from 'node:assert/strict';
import test from 'node:test';

import { pickKnowledgePatch, pickMeetingPatch, pickNextActionPatch } from '../lib/editable';

test('所有者を書き換えようとしても通さない', () => {
  // 型アサーションは実行時に何も守らない。repId を混ぜれば
  // 他人の商談記録にすり替えられる、という状態を塞いでいる。
  const patch = pickMeetingPatch({
    title: '初回ヒアリング',
    repId: '別のメンバーのID',
    id: 'すり替えたID',
    createdAt: '2000-01-01T00:00:00Z',
  });
  assert.deepEqual(patch, { title: '初回ヒアリング' });
  assert.equal('repId' in patch, false);
  assert.equal('id' in patch, false);
  assert.equal('createdAt' in patch, false);
});

test('社内知識も登録者を書き換えられない', () => {
  const patch = pickKnowledgePatch({ title: '値引きルール', createdBy: '別人', id: 'x' });
  assert.deepEqual(patch, { title: '値引きルール' });
});

test('次回行動も担当者を書き換えられない', () => {
  const patch = pickNextActionPatch({ done: true, repId: '別人' });
  assert.deepEqual(patch, { done: true });
});

test('日付の形式が崩れているものは捨てて既存の値を残す', () => {
  // 商談日が壊れると一覧の並びと商談履歴の順序が壊れる。
  assert.equal('date' in pickMeetingPatch({ date: '来週' }), false);
  assert.equal('date' in pickMeetingPatch({ date: '2026/09/01' }), false);
  assert.equal(pickMeetingPatch({ date: '2026-09-01' }).date, '2026-09-01');

  // 期限は「未設定に戻す」があるので空文字だけは通す。
  assert.equal(pickNextActionPatch({ due: '来週' }).due, undefined);
  assert.equal(pickNextActionPatch({ due: '' }).due, '');
  assert.equal(pickNextActionPatch({ due: '2026-09-03' }).due, '2026-09-03');
});

test('列挙値は既知のものだけ通す', () => {
  assert.equal(pickMeetingPatch({ inputType: 'transcript' }).inputType, 'transcript');
  assert.equal('inputType' in pickMeetingPatch({ inputType: 'でっちあげ' }), false);
  assert.equal(pickKnowledgePatch({ type: 'rule' }).type, 'rule');
  assert.equal('type' in pickKnowledgePatch({ type: 'unknown' }), false);
});

test('タグは文字列だけを残す', () => {
  assert.deepEqual(pickKnowledgePatch({ tags: ['価格', '', 42, null, '反論対応'] }).tags, [
    '価格',
    '反論対応',
  ]);
});

test('空文字での上書きは許す（値を消したい場合があるため）', () => {
  // 商談名や段階は「やっぱり空にしたい」ことがある。
  assert.equal(pickMeetingPatch({ title: '' }).title, '');
  assert.equal(pickMeetingPatch({ stage: '' }).stage, '');
});

test('本文がオブジェクトでなければ何も更新しない', () => {
  assert.deepEqual(pickMeetingPatch(null), {});
  assert.deepEqual(pickMeetingPatch('文字列'), {});
  assert.deepEqual(pickNextActionPatch(undefined), {});
});
