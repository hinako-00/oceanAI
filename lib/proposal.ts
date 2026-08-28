import {
  CUSTOMER_FIELD_KEYS,
  SKILL_AXIS_KEYS,
  TENDENCY_CATEGORY_KEYS,
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
 * 保存候補（顧客カルテ・営業傾向・次回行動・社内知識の更新案）のスキーマと検証。
 *
 * モデルには本文とは別の「ツール呼び出し」として出させる。
 * 以前は本文の末尾に <<<SALES_UPDATE ... >>> という自前のブロックを書かせて
 * 正規表現で切り出していたが、次の理由で取りやめた。
 *   ・ブロックが本文の最後に来るため、出力上限に当たると丸ごと消える
 *   ・JSONの体裁が少しでも崩れると JSON.parse が落ち、保存候補が黙って失われる
 *   ・ストリーミング中に未完成のブロックを隠すための正規表現が必要になる
 * ツールなら strict:true でスキーマ適合が保証され、本文の長さとも切り離される。
 *
 * ただしスキーマが通ることと中身が妥当なことは別なので、
 * 受け取った値は以下で必ず検証し、既知の値だけを通す（未知のキーは捨てる）。
 */

const FACT_SOURCES: FactSource[] = ['confirmed', 'rep_report', 'ai_hypothesis', 'unconfirmed'];
const CONFIDENCES: Confidence[] = ['low', 'mid', 'high'];
const KNOWLEDGE_TYPES: KnowledgeType[] = ['product', 'rule', 'case', 'talk'];

/** モデルに情報源として選ばせる値。unconfirmed は openQuestions で表すので含めない。 */
const SELECTABLE_SOURCES: FactSource[] = ['confirmed', 'rep_report', 'ai_hypothesis'];

/**
 * 保存候補を受け取るツールの定義。
 *
 * strict:true を効かせるため、すべてのオブジェクトに additionalProperties:false を付け、
 * すべてのプロパティを required に入れている（strictでは省略可能なプロパティを作れない）。
 * 「該当なし」は null ではなく空文字・空配列で表す取り決めにしてある。
 */
export const SAVE_PROPOSAL_TOOL = {
  name: 'save_proposal',
  description:
    '商談記録や会話から読み取れた、顧客カルテ・営業傾向・次回行動・社内知識の更新案を登録する。' +
    'ここで渡した内容はまだ保存されず、担当者が画面で1件ずつ確認して承認したものだけが保存される。' +
    '本文の回答を書き終えたあとに呼ぶこと。更新案が何もない場合は呼ばなくてよい。',
  input_schema: {
    type: 'object' as const,
    properties: {
      customerUpdate: {
        type: 'object',
        description: '顧客カルテの更新案。顧客に関する新情報がなければ fields と openQuestions を空配列にする。',
        properties: {
          customerId: {
            type: 'string',
            description:
              '既存顧客を更新する場合、参照情報の【顧客情報】にある「顧客ID」をそのまま入れる。新規の顧客なら空文字。',
          },
          displayName: {
            type: 'string',
            description: '顧客の表示名（会社名または顧客名）。分からなければ空文字。',
          },
          fields: {
            type: 'array',
            description:
              '確認できた項目だけを入れる。情報がない項目を推測で埋めないこと（それは openQuestions に入れる）。',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', enum: CUSTOMER_FIELD_KEYS },
                value: { type: 'string' },
                source: {
                  type: 'string',
                  enum: SELECTABLE_SOURCES,
                  description:
                    '顧客本人が明確に発言した内容だけ confirmed。担当者の解釈は rep_report。あなたの推測は ai_hypothesis。',
                },
                evidence: {
                  type: 'string',
                  description: '根拠となる発言や記述を短く。なければ空文字。',
                },
              },
              required: ['key', 'value', 'source', 'evidence'],
              additionalProperties: false,
            },
          },
          openQuestions: {
            type: 'array',
            description: '未確認のまま残っている、次回confirmすべき事項。',
            items: { type: 'string' },
          },
        },
        required: ['customerId', 'displayName', 'fields', 'openQuestions'],
        additionalProperties: false,
      },
      patternUpdates: {
        type: 'array',
        description: '担当者の営業傾向として観察されたこと。根拠が薄い場合は confidence を low にする。',
        items: {
          type: 'object',
          properties: {
            axis: { type: 'string', enum: SKILL_AXIS_KEYS },
            category: { type: 'string', enum: TENDENCY_CATEGORY_KEYS },
            text: { type: 'string' },
            basis: { type: 'string', description: '判断の根拠。' },
            confidence: { type: 'string', enum: CONFIDENCES },
            dataCount: { type: 'integer', description: '判断に使った商談・会話の件数。' },
            neededData: {
              type: 'string',
              description: '判断の確度を上げるために必要な追加データ。なければ空文字。',
            },
          },
          required: ['axis', 'category', 'text', 'basis', 'confidence', 'dataCount', 'neededData'],
          additionalProperties: false,
        },
      },
      nextActions: {
        type: 'array',
        description: '次回までに担当者が取るべき具体的な行動。',
        items: {
          type: 'object',
          properties: {
            purpose: { type: 'string', description: 'その行動を取る目的。' },
            action: { type: 'string' },
            due: {
              type: 'string',
              description:
                '期限。YYYY-MM-DD 形式。参照情報の【本日の日付】を基準に決める。決められないなら空文字。',
            },
          },
          required: ['purpose', 'action', 'due'],
          additionalProperties: false,
        },
      },
      knowledgeCandidates: {
        type: 'array',
        description: 'チーム全体で共有する価値がある、自社の商品情報・営業ルール・成功事例・トーク。',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: KNOWLEDGE_TYPES },
            title: { type: 'string' },
            body: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['type', 'title', 'body', 'tags'],
          additionalProperties: false,
        },
      },
    },
    required: ['customerUpdate', 'patternUpdates', 'nextActions', 'knowledgeCandidates'],
    additionalProperties: false,
  },
  strict: true,
};

export interface ExtractedUpdate {
  customerUpdate?: CustomerUpdateProposal;
  patternUpdates: PatternUpdateProposal[];
  nextActions: NextActionProposal[];
  knowledgeCandidates: KnowledgeProposal[];
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
    ? (obj.fields
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
        .filter((v) => v !== null) as CustomerUpdateProposal['fields'])
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
        category: oneOf<TendencyCategory>(p.category, TENDENCY_CATEGORY_KEYS, 'habit'),
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

/**
 * save_proposal ツールの入力を検証して保存候補に変換する。
 * 中身が実質空なら undefined を返し、担当者に空の確認を出さない。
 */
export function parseProposal(input: unknown): ExtractedUpdate | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const obj = input as Record<string, unknown>;

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

  return isEmpty ? undefined : update;
}
