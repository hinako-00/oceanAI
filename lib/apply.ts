import 'server-only';

import {
  addKnowledge,
  addNextAction,
  createCustomer,
  getCustomer,
  setProposalStatus,
  updateCustomer,
} from './repo';
import { mutate, newId, now } from './store';
import type { CustomerField, CustomerFieldKey, UpdateProposal } from './types';

/**
 * 更新候補の適用。担当者が画面で選んだ項目だけを保存する。
 * AIの出力をそのまま保存しない（承認を必須にする）ための唯一の入口。
 */
export interface ApplySelection {
  customer?: {
    /** 既存顧客に反映する場合のID。未指定なら新規作成。 */
    customerId?: string;
    displayName?: string;
    /** customerUpdate.fields のうち適用する要素のindex。 */
    fieldIndexes: number[];
    /** customerUpdate.openQuestions のうち適用する要素のindex。 */
    openQuestionIndexes: number[];
  };
  patternIndexes: number[];
  nextActionIndexes: number[];
  knowledgeIndexes: number[];
}

export interface ApplyResult {
  customerId?: string;
  appliedFields: number;
  appliedOpenQuestions: number;
  appliedPatterns: number;
  appliedNextActions: number;
  appliedKnowledge: number;
}

export async function applyProposal(
  proposal: UpdateProposal,
  selection: ApplySelection,
): Promise<ApplyResult> {
  const result: ApplyResult = {
    appliedFields: 0,
    appliedOpenQuestions: 0,
    appliedPatterns: 0,
    appliedNextActions: 0,
    appliedKnowledge: 0,
  };

  // --- 顧客カルテ ---
  const customerUpdate = proposal.customerUpdate;
  const customerSelection = selection.customer;
  if (customerUpdate && customerSelection) {
    const fields = customerSelection.fieldIndexes
      .map((index) => customerUpdate.fields[index])
      .filter(Boolean);
    const openQuestions = customerSelection.openQuestionIndexes
      .map((index) => customerUpdate.openQuestions[index])
      .filter(Boolean);

    if (fields.length > 0 || openQuestions.length > 0) {
      const displayName =
        customerSelection.displayName ||
        customerUpdate.displayName ||
        fields.find((f) => f.key === 'customerName')?.value ||
        '名称未設定';

      let customerId = customerSelection.customerId;
      let customer = customerId ? await getCustomer(customerId) : undefined;
      if (!customer) {
        customer = await createCustomer(displayName, proposal.repId);
        customerId = customer.id;
      }

      const patch: Partial<Record<CustomerFieldKey, CustomerField>> = {};
      for (const field of fields) {
        patch[field.key] = {
          value: field.value,
          source: field.source,
          evidence: field.evidence,
          updatedAt: now(),
        };
      }
      // 未確認事項は重複を除いて追記する。
      const merged = Array.from(new Set([...customer.openQuestions, ...openQuestions]));
      await updateCustomer(customer.id, {
        displayName: customerSelection.displayName || customer.displayName,
        fields: patch,
        openQuestions: merged,
      });

      result.customerId = customer.id;
      result.appliedFields = fields.length;
      result.appliedOpenQuestions = merged.length - customer.openQuestions.length;
    }
  }

  // --- 担当者の傾向 ---
  const patterns = selection.patternIndexes
    .map((index) => proposal.patternUpdates[index])
    .filter(Boolean);
  if (patterns.length > 0) {
    await mutate('users', (rows) => {
      const rep = rows.find((r) => r.id === proposal.repId);
      if (!rep) return;
      for (const pattern of patterns) {
        rep.tendencies.push({
          id: newId(),
          axis: pattern.axis,
          category: pattern.category,
          text: pattern.text,
          basis: pattern.basis,
          confidence: pattern.confidence,
          dataCount: pattern.dataCount,
          neededData: pattern.neededData,
          observedAt: now(),
          sourceSessionId: proposal.sessionId,
        });
      }
      rep.updatedAt = now();
    });
    result.appliedPatterns = patterns.length;
  }

  // --- 次回行動 ---
  for (const index of selection.nextActionIndexes) {
    const action = proposal.nextActions[index];
    if (!action) continue;
    await addNextAction({
      repId: proposal.repId,
      purpose: action.purpose,
      action: action.action,
      due: action.due,
      customerId: result.customerId ?? proposal.customerUpdate?.customerId,
      done: false,
    });
    result.appliedNextActions += 1;
  }

  // --- 社内知識 ---
  for (const index of selection.knowledgeIndexes) {
    const item = proposal.knowledgeCandidates[index];
    if (!item) continue;
    await addKnowledge({ type: item.type, title: item.title, body: item.body, tags: item.tags });
    result.appliedKnowledge += 1;
  }

  await setProposalStatus(proposal.id, 'applied');
  return result;
}
