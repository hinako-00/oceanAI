/**
 * 一覧の検索・絞り込み。
 *
 * 件数が増えると目で探すのが現実的でなくなるため、どの一覧にも検索欄を置く。
 * 判定はここに集めて、画面側は結果を並べるだけにする。
 */

/**
 * 検索語の正規化。
 *
 * 日本語の入力では、全角の空白で単語を区切ったり、英数字が全角で入ったりする。
 * 「ＡＢＣ商事」と打っても「ABC商事」に当たってほしいので、
 * 全角英数字を半角に寄せ、大文字小文字の差も無視する。
 */
export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .trim();
}

/** 検索語を空白（半角・全角）で分割する。 */
export function tokenize(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

/**
 * 対象のどれかに、すべての語が含まれるか（AND検索）。
 * 語ごとに「いずれかの項目に含まれていればよい」とするので、
 * 「みなと 提案」で会社名と段階をまたいで絞り込める。
 */
export function matches(query: string, fields: Array<string | undefined | null>): boolean {
  const terms = tokenize(query);
  if (terms.length === 0) return true;
  const haystack = fields.filter(Boolean).map((f) => normalize(String(f)));
  return terms.every((term) => haystack.some((field) => field.includes(term)));
}
