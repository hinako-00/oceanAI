'use client';

import { useState } from 'react';

import { api, jsonBody } from '@/lib/client';
import { tap } from '@/lib/haptics';
import {
  CUSTOMER_FIELD_LABEL,
  FACT_SOURCE_LABEL,
  KNOWLEDGE_TYPE_LABEL,
  SKILL_AXIS_LABEL,
  TENDENCY_CATEGORY_LABEL,
  CONFIDENCE_LABEL,
} from '@/lib/types';
import type { Customer, FactSource, UpdateProposal } from '@/lib/types';

const SOURCE_CLASS: Record<FactSource, string> = {
  confirmed: 'badge badge-confirmed',
  rep_report: 'badge badge-rep',
  ai_hypothesis: 'badge badge-ai',
  unconfirmed: 'badge badge-unconfirmed',
};

interface Props {
  proposal: UpdateProposal;
  customers: Customer[];
  /** 会話で選択中のクライアント。既定の反映先にする。 */
  currentCustomerId?: string;
  onResolved: (result: { status: 'applied' | 'rejected'; customerId?: string }) => void;
}

/**
 * 継続学習用の更新候補を担当者が確認して保存する画面。
 * 既定では何も選択されていない。担当者がチェックしたものだけが保存される。
 */
export default function ProposalPanel({ proposal, customers, currentCustomerId, onResolved }: Props) {
  const customerUpdate = proposal.customerUpdate;
  const [fieldIndexes, setFieldIndexes] = useState<number[]>([]);
  const [questionIndexes, setQuestionIndexes] = useState<number[]>([]);
  const [patternIndexes, setPatternIndexes] = useState<number[]>([]);
  const [actionIndexes, setActionIndexes] = useState<number[]>([]);
  const [knowledgeIndexes, setKnowledgeIndexes] = useState<number[]>([]);
  const [targetCustomerId, setTargetCustomerId] = useState<string>(
    customerUpdate?.customerId ?? currentCustomerId ?? '',
  );
  const [busy, setBusy] = useState(false);
  // 保存が通ってからパネルが消えるまでの短い状態。何件がどこへ入ったかを見せる。
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const toggle = (list: number[], setList: (v: number[]) => void, index: number) => {
    setList(list.includes(index) ? list.filter((i) => i !== index) : [...list, index]);
  };

  const selectedCount =
    fieldIndexes.length +
    questionIndexes.length +
    patternIndexes.length +
    actionIndexes.length +
    knowledgeIndexes.length;

  const submit = async (action: 'apply' | 'reject') => {
    setBusy(true);
    setError('');
    try {
      await api<{ ok: boolean }>(
        `/api/proposals/${proposal.id}`,
        jsonBody({
          action,
          selection:
            action === 'apply'
              ? {
                  customer: customerUpdate
                    ? {
                        customerId: targetCustomerId || undefined,
                        fieldIndexes,
                        openQuestionIndexes: questionIndexes,
                      }
                    : undefined,
                  patternIndexes,
                  nextActionIndexes: actionIndexes,
                  knowledgeIndexes,
                }
              : undefined,
        }),
      );
      // 承認が効いたことを、消える前のひと呼吸で見せる。
      if (action === 'apply') {
        tap();
        setDone(true);
        await new Promise((resolve) => setTimeout(resolve, 420));
      }
      onResolved({ status: action === 'apply' ? 'applied' : 'rejected', customerId: targetCustomerId });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="card proposal-done" role="status">
        <svg className="save-flash-mark" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M7.5 12.4l3.2 3.2 6-6.4" />
        </svg>
        <div>
          <strong>{selectedCount}件を保存しました</strong>
          <div className="faint">クライアント情報・営業傾向・次回行動に反映しました。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ borderColor: 'var(--accent)' }}>
      <div className="spread" style={{ marginBottom: 8 }}>
        <h3 className="card-title" style={{ margin: 0 }}>
          保存候補
        </h3>
        <span className="faint">未保存</span>
      </div>
      <p className="faint" style={{ margin: '0 0 10px' }}>
        チェックした項目だけが保存されます。情報源のラベルを確認してください。
      </p>

      {customerUpdate && (
        <section style={{ marginBottom: 12 }}>
          <div className="faint" style={{ marginBottom: 4 }}>
            クライアント情報
          </div>
          <label className="field" style={{ marginBottom: 6 }}>
            <span>反映先</span>
            <select value={targetCustomerId} onChange={(e) => setTargetCustomerId(e.target.value)}>
              <option value="">新規クライアントとして作成（{customerUpdate.displayName ?? '名称未設定'}）</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </label>

          {customerUpdate.fields.map((field, index) => (
            <label key={`f${index}`} className="checkline">
              <input
                type="checkbox"
                checked={fieldIndexes.includes(index)}
                onChange={() => toggle(fieldIndexes, setFieldIndexes, index)}
              />
              <span style={{ minWidth: 0 }}>
                <span className={SOURCE_CLASS[field.source]}>{FACT_SOURCE_LABEL[field.source]}</span>{' '}
                <strong>{CUSTOMER_FIELD_LABEL[field.key]}</strong>: {field.value}
                {field.evidence && <div className="faint">根拠: {field.evidence}</div>}
              </span>
            </label>
          ))}

          {customerUpdate.openQuestions.map((question, index) => (
            <label key={`q${index}`} className="checkline">
              <input
                type="checkbox"
                checked={questionIndexes.includes(index)}
                onChange={() => toggle(questionIndexes, setQuestionIndexes, index)}
              />
              <span>
                <span className="badge badge-unconfirmed">未確認</span> {question}
              </span>
            </label>
          ))}
        </section>
      )}

      {proposal.patternUpdates.length > 0 && (
        <section style={{ marginBottom: 12 }}>
          <div className="faint" style={{ marginBottom: 4 }}>
            営業傾向
          </div>
          {proposal.patternUpdates.map((pattern, index) => (
            <label key={`p${index}`} className="checkline">
              <input
                type="checkbox"
                checked={patternIndexes.includes(index)}
                onChange={() => toggle(patternIndexes, setPatternIndexes, index)}
              />
              <span>
                <span className="badge">
                  {TENDENCY_CATEGORY_LABEL[pattern.category]}／{SKILL_AXIS_LABEL[pattern.axis]}
                </span>{' '}
                {pattern.text}
                <div className="faint">
                  根拠: {pattern.basis || '未記載'} ／ 信頼度: {CONFIDENCE_LABEL[pattern.confidence]}（データ
                  {pattern.dataCount}件）
                </div>
              </span>
            </label>
          ))}
        </section>
      )}

      {proposal.nextActions.length > 0 && (
        <section style={{ marginBottom: 12 }}>
          <div className="faint" style={{ marginBottom: 4 }}>
            次回行動
          </div>
          {proposal.nextActions.map((action, index) => (
            <label key={`a${index}`} className="checkline">
              <input
                type="checkbox"
                checked={actionIndexes.includes(index)}
                onChange={() => toggle(actionIndexes, setActionIndexes, index)}
              />
              <span>
                {action.action}
                <div className="faint">
                  目的: {action.purpose || '未記載'} ／ 期限: {action.due || '未設定'}
                </div>
              </span>
            </label>
          ))}
        </section>
      )}

      {proposal.knowledgeCandidates.length > 0 && (
        <section style={{ marginBottom: 12 }}>
          <div className="faint" style={{ marginBottom: 4 }}>
            社内知識の候補
          </div>
          {proposal.knowledgeCandidates.map((item, index) => (
            <label key={`k${index}`} className="checkline">
              <input
                type="checkbox"
                checked={knowledgeIndexes.includes(index)}
                onChange={() => toggle(knowledgeIndexes, setKnowledgeIndexes, index)}
              />
              <span>
                <span className="badge">{KNOWLEDGE_TYPE_LABEL[item.type]}</span> {item.title}
                <div className="faint">{item.body.slice(0, 90)}</div>
              </span>
            </label>
          ))}
        </section>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: 8 }}>{error}</div>}

      <div className="page-actions" style={{ marginTop: 0 }}>
        <button
          type="button"
          className="btn-primary"
          disabled={busy || selectedCount === 0}
          onClick={() => submit('apply')}
        >
          選択した{selectedCount}件を保存
        </button>
        <button type="button" disabled={busy} onClick={() => submit('reject')}>
          保存しない
        </button>
      </div>
    </div>
  );
}
