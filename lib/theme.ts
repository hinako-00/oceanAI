/**
 * 画面の配色（ブルーデザイン3案）。
 *
 * 実際の色は app/globals.css の `[data-theme='...']` に持たせ、
 * ここでは「どの案があるか」と「どこに覚えておくか」だけを定義する。
 * 端末ごとの見え方の好みなので、サーバーには保存せず localStorage に置く。
 */

export const THEME_KEYS = ['ocean', 'sky', 'navy'] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];

/** 既定の配色。data-theme が付いていないときもこの見た目になる。 */
export const DEFAULT_THEME: ThemeKey = 'ocean';

/** localStorage のキー。layout の先読みスクリプトと必ず同じ値を使う。 */
export const THEME_STORAGE_KEY = 'ocean-ai-theme';

export interface ThemeOption {
  key: ThemeKey;
  /** 案の番号（画面の見出しに出す）。 */
  label: string;
  name: string;
  description: string;
  /** 案の性格を一目で伝える見本の色。globals.css の light 側と揃える。 */
  swatch: [string, string, string, string];
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    key: 'ocean',
    label: '案A',
    name: 'オーシャンブルー',
    description:
      '白地に澄んだ青。文字と背景の差を一番大きく取った標準案です。迷ったらこれ。',
    swatch: ['#1a5fd0', '#e3ecfd', '#f2f6fc', '#101f38'],
  },
  {
    key: 'sky',
    label: '案B',
    name: 'ソフトスカイ',
    description:
      '水色寄りのやわらかい青。角を大きく丸め、線を弱めています。長時間見る人向け。',
    swatch: ['#0a6cb8', '#e0f0fb', '#eef4fb', '#16283b'],
  },
  {
    key: 'navy',
    label: '案C',
    name: 'ディープネイビー',
    description:
      '濃紺と、はっきりした罫線。一覧や表を数多く読むときに文字が拾いやすい案です。',
    swatch: ['#123a75', '#dde7f5', '#e9eef5', '#0b1626'],
  },
];

/** 保存値が壊れていても既定へ倒す。 */
export function normalizeTheme(value: string | null | undefined): ThemeKey {
  return THEME_KEYS.includes(value as ThemeKey) ? (value as ThemeKey) : DEFAULT_THEME;
}
