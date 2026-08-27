import {
  CUSTOMER_FIELD_KEYS,
  SKILL_AXIS_KEYS,
} from './types';
import type {
  Confidence,
  CustomerFieldKey,
  CustomerUpdateProposal,
  FactSource,
  KnowledgeProposal,
  KnowledgeType,
  NextActionProposal,
  PatternUpdateProposal,
  SkillAxis,
  TendencyCategory,
} from './types';

/**
 * AIの回答末尾に付く <<<SALES_UPDATE ... >>> ブロックを取り出し、
 * 表示用の本文と保存候補に分離する。
 * モデル出力は信用せず、既知の値だけを通す（未知のキーは捨てる）。
 */

const BLOCK_RE = /<<<SALES_UPDATE\s*([\s\S]*?)>>>/;

const FACT_SOURCES: FactSource[] = ['confirmed', 'rep_report', 'ai_hypothesis', 'unconfirmed'];
const CONFIDENCES: Confidence[] = ['low', 'mid', 'high'];
const KNOWLEDGE_TYPES: KnowledgeType[] = ['product', 'rule', 'case', 'talk'];
const TENDENCY_CATEGORIES: TendencyCategory[] = [
  'strength',
  'habit',
  'improve',
  'goodFit',
  'hardFit',
  'nextTry',
  'change',
];

export interface ExtractedUpdate {
  customerUpdate?: CustomerUpdateProposal;
  patternUpdates: PatternUpdateProposal[];
  nextActions: NextActionProposal[];
  knowledgeCandidates: KnowledgeProposal[];
}

export interface ExtractResult {
  /** 画面に表示する本文（ブロックを取り除いたもの）。 */
  body: string;
  update?: ExtractedUpdate;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(str).filter(Boolean);
}

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  const v = str(value) as T;
  return allowed.includes(v) ? v : fallback;
}

function parseCustomerUpdate(raw: unknown): CustomerUpdateProposal | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const fields = Array.isArray(obj.fields)
    ? obj.fields
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const f = entry as Record<string, unknown>;
          const key = str(f.key) as CustomerFieldKey;
          if (!CUSTOMER_FIELD_KEYS.includes(key)) return null;
          const value = str(f.value);
          if (!value) return null;
          return {
            key,
            value,
            // 情報源が欠けている場合は最も弱い扱い（AI仮説）に倒す。
            source: oneOf<FactSource>(f.source, FACT_SOURCES, 'ai_hypothesis'),
            evidence: str(f.evidence) || undefined,
          };
        })
        .filter((v) => v !== null) as CustomerUpdateProposal['fields']
    : [];
  const openQuestions = strArray(obj.openQuestions);
  const displayName = str(obj.displayName) || undefined;
  const customerId = str(obj.customerId) || undefined;
  if (fields.length === 0 && openQuestions.length === 0) return undefined;
  return { customerId, displayName, fields, openQuestions };
}

function parsePatternUpdates(raw: unknown): PatternUpdateProposal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const p = entry as Record<string, unknown>;
      const text = str(p.text);
      if (!text) return null;
      const dataCount = Number(p.dataCount);
      return {
        axis: oneOf<SkillAxis>(p.axis, SKILL_AXIS_KEYS, 'questioning'),
        category: oneOf<TendencyCategory>(p.category, TENDENCY_CATEGORIES, 'habit'),
        text,
        basis: str(p.basis),
        confidence: oneOf<Confidence>(p.confidence, CONFIDENCES, 'low'),
        dataCount: Number.isFinite(dataCount) && dataCount > 0 ? Math.floor(dataCount) : 1,
        neededData: str(p.neededData) || undefined,
      };
    })
    .filter((v) => v !== null) as PatternUpdateProposal[];
}

function parseNextActions(raw: unknown): NextActionProposal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const a = entry as Record<string, unknown>;
      const action = str(a.action);
      if (!action) return null;
      const due = str(a.due);
      return {
        purpose: str(a.purpose),
        action,
        // 日付形式が崩れている場合は空にして、担当者に入力させる。
        due: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : '',
      };
    })
    .filter((v) => v !== null) as NextActionProposal[];
}

function parseKnowledge(raw: unknown): KnowledgeProposal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const k = entry as Record<string, unknown>;
      const title = str(k.title);
      const body = str(k.body);
      if (!title || !body) return null;
      return {
        type: oneOf<KnowledgeType>(k.type, KNOWLEDGE_TYPES, 'case'),
        title,
        body,
        tags: strArray(k.tags),
      };
    })
    .filter((v) => v !== null) as KnowledgeProposal[];
}

/** 回答テキストから保存候補ブロックを切り出す。 */
export function extractUpdate(text: string): ExtractResult {
  const match = text.match(BLOCK_RE);
  if (!match) return { body: text.trim() };

  const body = text.replace(BLOCK_RE, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[1].trim());
  } catch {
    // JSONが壊れていても会話は続行できるようにする。
    return { body };
  }
  if (!parsed || typeof parsed !== 'object') return { body };

  const obj = parsed as Record<string, unknown>;
  const update: ExtractedUpdate = {
    customerUpdate: parseCustomerUpdate(obj.customerUpdate),
    patternUpdates: parsePatternUpdates(obj.patternUpdates),
    nextActions: parseNextActions(obj.nextActions),
    knowledgeCandidates: parseKnowledge(obj.knowledgeCandidates),
  };

  const isEmpty =
    !update.customerUpdate &&
    update.patternUpdates.length === 0 &&
    update.nextActions.length === 0 &&
    update.knowledgeCandidates.length === 0;

  return { body, update: isEmpty ? undefined : update };
}

/** ストリーミング中の途中経過から、未完成のブロックを画面に出さないためのフィルタ。 */
export function stripPartialBlock(text: string): string {
  const start = text.indexOf('<<<SALES_UPDATE');
  if (start === -1) {
    // 開始マーカーが途中まで届いている場合も隠す。
    const partial = text.match(/<{1,3}S?A?L?E?S?_?U?P?D?A?T?E?$/);
    return partial ? text.slice(0, text.length - partial[0].length) : text;
  }
  const end = text.indexOf('>>>', start);
  if (end === -1) return text.slice(0, start);
  return (text.slice(0, start) + text.slice(end + 3)).trimEnd();
}
