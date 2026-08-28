/**
 * CSVの組み立て。Excelで開くことを前提にする。
 */

/**
 * セル1つ分を安全な形にする。
 *
 * 2つのことをしている。
 *
 * 1. CSVとしてのエスケープ
 *    区切り文字・引用符・改行を含む値は引用符で囲み、値の中の引用符は2つに増やす。
 *    アポメモは改行を含むので、これがないとファイルが1行ずれて崩れる。
 *
 * 2. 数式として実行されないようにする
 *    Excelは = + - @ で始まるセルを数式として解釈する。書き出す中身には
 *    クライアントの発言やAIの生成文がそのまま入るため、意図せず（あるいは仕込まれて）
 *    数式になりうる。先頭に ' を付けて、必ず文字列として扱わせる。
 */
export function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  // タブ・改行始まりも数式判定の回避に使われるため、あわせて見る。
  const looksLikeFormula = /^[=+\-@\t\r]/.test(text);
  const safe = looksLikeFormula ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * 表をCSVの文字列にする。
 *
 * 改行は CRLF にする（Excelがそれを期待するため）。
 * 先頭にBOMを付ける。付けないとExcelがUTF-8と判断せず、日本語が文字化けする。
 */
export function toCsv(rows: Array<Array<unknown>>): string {
  const body = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
  return `﻿${body}\r\n`;
}

/** 書き出しファイル名。いつ時点のものか分かるよう日付を入れる。 */
export function csvFileName(kind: string, today: string): string {
  return `ocean-${kind}-${today}.csv`;
}
