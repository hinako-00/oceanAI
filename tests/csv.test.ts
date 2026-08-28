import assert from 'node:assert/strict';
import test from 'node:test';

import { csvFileName, escapeCell, toCsv } from '../lib/csv';

test('区切り文字・引用符・改行を含む値を壊さない', () => {
  assert.equal(escapeCell('株式会社みなと'), '株式会社みなと');
  assert.equal(escapeCell('A社, B社'), '"A社, B社"');
  assert.equal(escapeCell('彼は「"急ぎ"」と言った'), '"彼は「""急ぎ""」と言った"');
  // 商談メモは改行を含む。囲まないとファイルが1行ずれて崩れる。
  assert.equal(escapeCell('顧客：はい\n担当：ありがとうございます'), '"顧客：はい\n担当：ありがとうございます"');
});

test('Excelが数式として実行しうる値を文字列に固定する', () => {
  // 書き出す中身には顧客の発言やAIの生成文がそのまま入る。
  assert.equal(escapeCell('=1+1'), "'=1+1");
  assert.equal(escapeCell('=HYPERLINK("http://example.com")'), '"\'=HYPERLINK(""http://example.com"")"');
  assert.equal(escapeCell('+81-90-0000-0000'), "'+81-90-0000-0000");
  assert.equal(escapeCell('-100'), "'-100");
  assert.equal(escapeCell('@user'), "'@user");
  // 数式に見えない値には余計なものを足さない。
  assert.equal(escapeCell('100'), '100');
  assert.equal(escapeCell('2026-09-01'), '2026-09-01');
});

test('空の値を空文字にする', () => {
  assert.equal(escapeCell(null), '');
  assert.equal(escapeCell(undefined), '');
  assert.equal(escapeCell(''), '');
});

test('BOM付き・CRLF区切りで組み立てる', () => {
  const csv = toCsv([
    ['顧客', '担当者'],
    ['株式会社みなと', '山田 太郎'],
  ]);
  // BOMがないとExcelが日本語を文字化けさせる。
  assert.ok(csv.startsWith('﻿'), 'BOMがない');
  assert.equal(csv, '﻿顧客,担当者\r\n株式会社みなと,山田 太郎\r\n');
});

test('ファイル名にいつ時点のものかを入れる', () => {
  assert.equal(csvFileName('customers', '2026-08-28'), 'ocean-customers-2026-08-28.csv');
});
