import type { Mode } from './types';

/**
 * 入力からモードを推定する。
 *
 * 推定結果は表示ラベルだけでなく、システムプロンプトの「今回のモード」（prompt.ts の
 * modeHint）と推論の深さ（effortFor）にも使われる。つまり誤検知はモデルを
 * 誤った仕事へ誘導するため、判定はターンごとにやり直すこと。
 * セッション作成時に一度決めて固定すると、途中で話題が変わったときに
 * 古い指示が残り続ける。
 */
const RULES: Array<{ mode: Mode; patterns: RegExp[] }> = [
  { mode: 'F', patterns: [/ロープレ/, /ロールプレイ/, /お客様役/, /顧客役/, /練習した/] },
  { mode: 'B', patterns: [/アポが終わ/, /振り返/, /今日のアポ/, /文字起こし/, /議事録/, /アポメモ/] },
  { mode: 'A', patterns: [/明日のアポ/, /アポ前/, /準備/, /アポ前/, /これから提案/] },
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

/** 推論の深さ。API の既定は high。 */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * 分析が重いモードだけ推論を深くする。
 *
 * アポの振り返り（B）、営業上の問題解決（D）、営業傾向の分析（G）は、
 * 複数の記録を突き合わせて根拠つきの判断を組み立てる仕事なので推論の深さが効く。
 * 一方で知識質問（E）やロールプレイ（F）の1発言は深く考えても質が変わらず、
 * 待ち時間とトークン代だけが増えるため既定のままにする。
 */
const DEEP_MODES: Mode[] = ['B', 'D', 'G'];

export function effortFor(mode: Mode | null): Effort {
  return mode && DEEP_MODES.includes(mode) ? 'xhigh' : 'high';
}

/** セッション一覧に出す見出しを入力から作る。 */
export function makeTitle(text: string): string {
  const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean) ?? '新しい相談';
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}
