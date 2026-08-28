import assert from 'node:assert/strict';
import test from 'node:test';

import { matches, normalize, tokenize } from '../lib/search';

test('全角と大文字小文字の違いを吸収する', () => {
  // 日本語入力では英数字が全角で入りやすい。打ち方の違いで見つからないのは困る。
  assert.equal(normalize('ＡＢＣ商事'), 'abc商事');
  assert.equal(normalize('  Ocean  '), 'ocean');
  assert.ok(matches('ABC', ['ＡＢＣ商事']));
  assert.ok(matches('ａｂｃ', ['ABC商事']));
});

test('全角スペースでも語を区切れる', () => {
  assert.deepEqual(tokenize('みなと　提案'), ['みなと', '提案']);
  assert.deepEqual(tokenize('  a   b  '), ['a', 'b']);
});

test('複数の語は、項目をまたいでAND検索になる', () => {
  const fields = ['株式会社みなと製作所', '提案', '継続'];
  assert.ok(matches('みなと 提案', fields));
  assert.ok(matches('みなと 継続', fields));
  // 片方でも欠ければ対象外。
  assert.equal(matches('みなと 失注', fields), false);
});

test('検索語が空なら全部通す', () => {
  assert.ok(matches('', ['なんでも']));
  assert.ok(matches('   ', ['なんでも']));
});

test('未設定の項目があっても落ちない', () => {
  assert.ok(matches('みなと', ['株式会社みなと', undefined, null, '']));
  assert.equal(matches('みなと', [undefined, null]), false);
});
