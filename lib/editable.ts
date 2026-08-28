import { KNOWLEDGE_TYPE_LABEL, MEETING_INPUT_TYPES } from './types';
import type { Knowledge, KnowledgeType, Meeting, MeetingInputType, NextAction } from './types';

/**
 * 更新リクエストの本文から、書き換えてよい項目だけを取り出す。
 *
 * 以前は request.json() の結果を型アサーションしただけで Object.assign していた。
 * 型は実行時には何も守らないので、repId や createdBy を本文に混ぜれば
 * 「誰の記録か」を書き換えられる状態だった。所有者は作成時に決まり、
 * あとから変えられてはいけない。
 *
 * 未知のキーは黙って捨てる。値の形式が不正なものも捨てて、既存の値を残す。
 */

const KNOWLEDGE_TYPES = Object.keys(KNOWLEDGE_TYPE_LABEL) as KnowledgeType[];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export type MeetingPatch = Partial<Omit<Meeting, 'id' | 'createdAt' | 'repId'>>;

export function pickMeetingPatch(raw: unknown): MeetingPatch {
  const body = asObject(raw);
  const patch: MeetingPatch = {};

  if (typeof body.customerId === 'string' && body.customerId) patch.customerId = body.customerId;
  // 日付が崩れると一覧の並びとアポ履歴の順序が壊れるので、形式が合うものだけ通す。
  if (typeof body.date === 'string' && DATE_RE.test(body.date)) patch.date = body.date;
  if (typeof body.title === 'string') patch.title = body.title;
  if (typeof body.stage === 'string') patch.stage = body.stage;
  if (typeof body.outcome === 'string') patch.outcome = body.outcome;
  if (typeof body.rawInput === 'string') patch.rawInput = body.rawInput;
  if (MEETING_INPUT_TYPES.includes(body.inputType as MeetingInputType)) {
    patch.inputType = body.inputType as MeetingInputType;
  }
  return patch;
}

export type KnowledgePatch = Partial<Omit<Knowledge, 'id' | 'createdAt' | 'createdBy'>>;

export function pickKnowledgePatch(raw: unknown): KnowledgePatch {
  const body = asObject(raw);
  const patch: KnowledgePatch = {};

  if (KNOWLEDGE_TYPES.includes(body.type as KnowledgeType)) patch.type = body.type as KnowledgeType;
  if (typeof body.title === 'string') patch.title = body.title;
  if (typeof body.body === 'string') patch.body = body.body;
  if (Array.isArray(body.tags)) {
    patch.tags = body.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
  }
  return patch;
}

export type NextActionPatch = Partial<Omit<NextAction, 'id' | 'createdAt' | 'repId'>>;

export function pickNextActionPatch(raw: unknown): NextActionPatch {
  const body = asObject(raw);
  const patch: NextActionPatch = {};

  if (typeof body.done === 'boolean') patch.done = body.done;
  if (typeof body.action === 'string') patch.action = body.action;
  if (typeof body.purpose === 'string') patch.purpose = body.purpose;
  // 期限が崩れると「期限超過」の判定が壊れる。未設定にしたい場合は空文字を許す。
  if (typeof body.due === 'string' && (body.due === '' || DATE_RE.test(body.due))) {
    patch.due = body.due;
  }
  if (typeof body.customerId === 'string') patch.customerId = body.customerId || undefined;
  return patch;
}
