import {
  CONFIDENCE_LABEL,
  CUSTOMER_FIELD_KEYS,
  CUSTOMER_FIELD_LABEL,
  FACT_SOURCE_LABEL,
  KNOWLEDGE_TYPE_LABEL,
  SKILL_AXIS_LABEL,
  TENDENCY_CATEGORY_LABEL,
} from './types';
import type { Customer, Knowledge, Meeting, NextAction, User } from './types';

/**
 * 保存済みデータをプロンプトの参照情報に変換する。
 * 仕様のテンプレート（【利用者情報】〜【今回の入力】）に対応する。
 */

/**
 * 1件あたりの原文の上限。
 *
 * 1時間のアポの文字起こしは2〜4万字になる。以前は6000字だったが、
 * それでは雑談から始まる冒頭だけが残り、次回の約束・意思決定者・予算・反論といった
 * 「次の一手を決める情報」が集まる終盤が丸ごと捨てられていた。
 * 参照するモデルは100万トークンの文脈を持つので、ここを絞る意味は薄い。
 */
const RAW_INPUT_LIMIT = 30000;
/** 原文を添えない古いアポに付ける抜粋の長さ。 */
const EXCERPT_LIMIT = 1200;
const KNOWLEDGE_LIMIT = 2000;

/**
 * 上限を超えるテキストを、前半と後半を残して中央を省く。
 *
 * アポは「冒頭の状況説明」と「終盤の合意・宿題」の両方が重要で、
 * 先頭から一律に切ると後者が必ず失われる。
 */
function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  // 終盤の情報密度が高いので、後半をやや厚く残す。
  const head = Math.floor(limit * 0.45);
  const tail = limit - head;
  return [
    text.slice(0, head),
    `\n…（中略：${text.length - limit}文字を省略。全${text.length}文字）…\n`,
    text.slice(text.length - tail),
  ].join('');
}

export function formatRep(rep: User | undefined): string {
  if (!rep) return '未登録';
  const lines = [
    `氏名: ${rep.name}`,
    `営業経験: ${rep.experienceYears}年`,
    `担当商材: ${rep.product || '未登録'}`,
    `担当領域: ${rep.territory || '未登録'}`,
  ];
  if (rep.note) lines.push(`本人の申告: ${rep.note}`);
  return lines.join('\n');
}

export function formatTendencies(rep: User | undefined): string {
  if (!rep || rep.tendencies.length === 0) {
    return '過去の傾向データなし（この会話が初回分析の場合、信頼度は「低」として扱うこと）';
  }
  // 新しい観察を先に見せる。
  const sorted = [...rep.tendencies].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  return sorted
    .slice(0, 40)
    .map((t) => {
      const parts = [
        `[${TENDENCY_CATEGORY_LABEL[t.category]}/${SKILL_AXIS_LABEL[t.axis]}] ${t.text}`,
        `  根拠: ${t.basis}`,
        `  信頼度: ${CONFIDENCE_LABEL[t.confidence]}（分析データ数: ${t.dataCount}件、観察日: ${t.observedAt.slice(0, 10)}）`,
      ];
      if (t.neededData) parts.push(`  必要な追加データ: ${t.neededData}`);
      return parts.join('\n');
    })
    .join('\n');
}

export function formatCustomer(customer: Customer | undefined): string {
  if (!customer) return '顧客未選択（顧客情報の参照情報なし）';
  const lines: string[] = [`顧客ID: ${customer.id}`, `表示名: ${customer.displayName}`];
  for (const key of CUSTOMER_FIELD_KEYS) {
    const field = customer.fields[key];
    if (!field || !field.value) {
      lines.push(`${CUSTOMER_FIELD_LABEL[key]}: 未確認`);
      continue;
    }
    const evidence = field.evidence ? ` ／ 根拠: ${field.evidence}` : '';
    lines.push(
      `${CUSTOMER_FIELD_LABEL[key]}: ${field.value}（${FACT_SOURCE_LABEL[field.source]}${evidence}）`,
    );
  }
  lines.push(
    `未確認事項: ${customer.openQuestions.length ? customer.openQuestions.join(' / ') : 'なし（ただし未登録なだけの可能性あり）'}`,
  );
  return lines.join('\n');
}

const INPUT_TYPE_LABEL: Record<Meeting['inputType'], string> = {
  transcript: '文字起こし',
  memo: 'アポメモ',
  chat: 'チャット記録',
};

export function formatMeetings(meetings: Meeting[]): string {
  if (meetings.length === 0) return '過去のアポ履歴なし';
  // 直近のアポほど重要なので新しい順に並べ、原文は直近5件に添付する。
  const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
  return sorted
    .slice(0, 10)
    .map((m, index) => {
      const head = `■ ${m.date} ${m.title}（段階: ${m.stage || '未設定'} ／ 結果: ${m.outcome || '未記録'}）`;
      if (!m.rawInput) return m.analysis ? `${head}\n[分析要約]\n${truncate(m.analysis, 800)}` : head;
      // 古いアポも見出しだけにはしない。何があったか分からないと参照する意味がないため、
      // 原文を短く抜粋して添える。
      const limit = index < 5 ? RAW_INPUT_LIMIT : EXCERPT_LIMIT;
      return `${head}\n[${INPUT_TYPE_LABEL[m.inputType]}]\n${truncate(m.rawInput, limit)}`;
    })
    .join('\n\n');
}

export function formatKnowledge(knowledge: Knowledge[]): string {
  if (knowledge.length === 0) return '自社営業知識の登録なし（一般的な営業理論で回答すること）';
  return knowledge
    .map((k) => `■ [${KNOWLEDGE_TYPE_LABEL[k.type]}] ${k.title}\n${truncate(k.body, KNOWLEDGE_LIMIT)}`)
    .join('\n\n');
}

export function formatNextActions(actions: NextAction[]): string {
  const open = actions.filter((a) => !a.done);
  if (open.length === 0) return '未完了の次回行動なし';
  return open
    .map((a) => `・${a.due} まで: ${a.action}（目的: ${a.purpose}）`)
    .join('\n');
}

export interface ContextInput {
  /** 本日の日付（YYYY-MM-DD）。テストから固定するために外から渡せるようにしている。 */
  today?: string;
  rep?: User;
  customer?: Customer;
  meetings: Meeting[];
  knowledge: Knowledge[];
  nextActions: NextAction[];
}

/** 仕様のテンプレートに沿った参照情報ブロックを組み立てる。 */
export function buildContextBlock(input: ContextInput): string {
  return [
    '以下はアプリに保存されている参照情報です。ここに書かれていない情報を「確認済みの事実」として扱わないでください。',
    '',
    // 期限（次回行動の due）を決めるには今日が何日か分かっている必要がある。
    // 日付までなので、1日に1回しか変わらず、プロンプトキャッシュを壊さない。
    '【本日の日付】',
    input.today ?? new Date().toISOString().slice(0, 10),
    '',
    '【利用者情報】',
    formatRep(input.rep),
    '',
    '【過去の営業傾向】',
    formatTendencies(input.rep),
    '',
    '【未完了の次回行動】',
    formatNextActions(input.nextActions),
    '',
    '【顧客情報】',
    formatCustomer(input.customer),
    '',
    '【過去のアポ履歴】',
    formatMeetings(input.meetings),
    '',
    '【自社営業知識】',
    formatKnowledge(input.knowledge),
  ].join('\n');
}
