import assert from 'node:assert/strict';
import test from 'node:test';

import { detectMode, effortFor, makeTitle } from '../lib/mode';

test('入力からモードのラベルを推定する', () => {
  assert.equal(detectMode('明日のアポ前に準備したい'), 'A');
  assert.equal(detectMode('今日のアポの振り返りをお願いします'), 'B');
  assert.equal(detectMode('ロープレをしたい'), 'F');
  assert.equal(detectMode('私の傾向を教えて'), 'G');
  assert.equal(detectMode('SPINとは何ですか'), 'E');
  assert.equal(detectMode('こんにちは'), 'H');
});

test('見出しは1行目から作り、長い場合は省略する', () => {
  assert.equal(makeTitle('株式会社Aの相談\n詳細です'), '株式会社Aの相談');
  assert.equal(makeTitle('あ'.repeat(60)).length, 41);
});

test('分析が重いモードだけ推論を深くする', () => {
  // アポの振り返り・問題解決・傾向分析は複数の記録を突き合わせる仕事なので深くする。
  assert.equal(effortFor('B'), 'xhigh');
  assert.equal(effortFor('D'), 'xhigh');
  assert.equal(effortFor('G'), 'xhigh');
  // 知識質問やロールプレイの1発言は深く考えても質が変わらず、待ち時間だけ増える。
  assert.equal(effortFor('E'), 'high');
  assert.equal(effortFor('F'), 'high');
  assert.equal(effortFor('H'), 'high');
  assert.equal(effortFor(null), 'high');
});
