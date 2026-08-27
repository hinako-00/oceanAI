import type { Mode } from './types';

/**
 * セッションの見出し表示用に、入力からモードを推定する。
 * 実際の応答の作り分けはモデル側の判断に任せる（ここでの推定は表示ラベルのみに使う）。
 */
const RULES: Array<{ mode: Mode; patterns: RegExp[] }> = [
  { mode: 'F', patterns: [/ロープレ/, /ロールプレイ/, /顧客役/, /練習した/] },
  { mode: 'B', patterns: [/商談が終わ/, /振り返/, /今日の商談/, /文字起こし/, /議事録/, /商談メモ/] },
  { mode: 'A', patterns: [/明日の商談/, /商談前/, /準備/, /アポ前/, /これから提案/] },
  { mode: 'G', patterns: [/私の傾向/, /自分の傾向/, /私の強み/, /苦手/, /成長/] },
  { mode: 'C', patterns: [/顧客情報/, /カルテ/, /登録して/, /更新して/] },
  { mode: 'E', patterns: [/とは何/, /教えて/, /SPIN/i, /BANT/i, /MEDDIC/i, /理論/, /違いは/] },
  { mode: 'D', patterns: [/どうすれば/, /困って/, /止まって/, /失注/, /返事がな/, /相談/] },
];

export function detectMode(text: string): Mode {
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.mode;
  }
  return 'H';
}

/** セッション一覧に出す見出しを入力から作る。 */
export function makeTitle(text: string): string {
  const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean) ?? '新しい相談';
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}
