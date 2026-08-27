import {
  CONFIDENCE_LABEL,
  CUSTOMER_FIELD_KEYS,
  CUSTOMER_FIELD_LABEL,
  FACT_SOURCE_LABEL,
  KNOWLEDGE_TYPE_LABEL,
  SKILL_AXIS_LABEL,
  TENDENCY_CATEGORY_LABEL,
} from './types';
import type { Customer, Knowledge, Meeting, NextAction, RepProfile } from './types';

/**
 * 保存済みデータをプロンプトの参照情報に変換する。
 * 仕様のテンプレート（【利用者情報】〜【今回の入力】）に対応する。
 */

/** 1件あたりの原文の上限。長い文字起こしでコンテキストを食い潰さないようにする。 */
const RAW_INPUT_LIMIT = 6000;
const KNOWLEDGE_LIMIT = 2000;

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n…（以下省略：全${text.length}文字）`;
}

export function formatRep(rep: RepProfile | undefined): string {
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

export function formatTendencies(rep: RepProfile | undefined): string {
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
  if (!customer) return '顧客未選択（顧客カルテの参照情報なし）';
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

export function formatMeetings(meetings: Meeting[]): string {
  if (meetings.length === 0) return '過去の商談履歴なし';
  // 直近の商談ほど重要なので新しい順に並べ、原文は直近3件のみ添付する。
  const sorted = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
  return sorted
    .slice(0, 8)
    .map((m, index) => {
      const head = `■ ${m.date} ${m.title}（段階: ${m.stage || '未設定'} ／ 結果: ${m.outcome || '未記録'}）`;
      if (index < 3 && m.rawInput) {
        return `${head}\n[${m.inputType === 'transcript' ? '文字起こし' : m.inputType === 'memo' ? '商談メモ' : 'チャット記録'}]\n${truncate(m.rawInput, RAW_INPUT_LIMIT)}`;
      }
      if (m.analysis) return `${head}\n[分析要約]\n${truncate(m.analysis, 800)}`;
      return head;
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
  rep?: RepProfile;
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
    '【過去の商談履歴】',
    formatMeetings(input.meetings),
    '',
    '【自社営業知識】',
    formatKnowledge(input.knowledge),
  ].join('\n');
}
