import assert from 'node:assert/strict';
import test from 'node:test';

import { detectMode, makeTitle } from '../lib/mode';

test('入力からモードのラベルを推定する', () => {
  assert.equal(detectMode('明日の商談前に準備したい'), 'A');
  assert.equal(detectMode('今日の商談の振り返りをお願いします'), 'B');
  assert.equal(detectMode('ロープレをしたい'), 'F');
  assert.equal(detectMode('私の傾向を教えて'), 'G');
  assert.equal(detectMode('SPINとは何ですか'), 'E');
  assert.equal(detectMode('こんにちは'), 'H');
});

test('見出しは1行目から作り、長い場合は省略する', () => {
  assert.equal(makeTitle('株式会社Aの相談\n詳細です'), '株式会社Aの相談');
  assert.equal(makeTitle('あ'.repeat(60)).length, 41);
});
