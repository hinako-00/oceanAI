'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { api, formatDate, patchBody } from '@/lib/client';
import {
  CUSTOMER_FIELD_KEYS,
  CUSTOMER_FIELD_LABEL,
  FACT_SOURCE_LABEL,
} from '@/lib/types';
import type { Customer, CustomerFieldKey, FactSource, Meeting, Mode } from '@/lib/types';

const SOURCE_CLASS: Record<FactSource, string> = {
  confirmed: 'badge badge-confirmed',
  rep_report: 'badge badge-rep',
  ai_hypothesis: 'badge badge-ai',
  unconfirmed: 'badge badge-unconfirmed',
};

const EDITABLE_SOURCES: FactSource[] = ['confirmed', 'rep_report', 'ai_hypothesis'];

/** 顧客カルテの詳細。項目ごとに値と情報源を編集できる。 */
export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<CustomerFieldKey | null>(null);
  const [draft, setDraft] = useState<{ value: string; source: FactSource; evidence: string }>({
    value: '',
    source: 'confirmed',
    evidence: '',
  });
  const [newQuestion, setNewQuestion] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api<{ customer: Customer; meetings: Meeting[] }>(`/api/customers/${params.id}`);
      setCustomer(data.customer);
      setMeetings(data.meetings);
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました。');
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (key: CustomerFieldKey) => {
    const field = customer?.fields[key];
    setEditing(key);
    setDraft({
      value: field?.value ?? '',
      source: field?.source && field.source !== 'unconfirmed' ? field.source : 'confirmed',
      evidence: field?.evidence ?? '',
    });
  };

  const saveField = async () => {
    if (!customer || !editing) return;
    await api(
      `/api/customers/${customer.id}`,
      patchBody({
        fields: {
          [editing]: {
            value: draft.value.trim(),
            source: draft.source,
            evidence: draft.evidence.trim() || undefined,
            updatedAt: new Date().toISOString(),
          },
        },
      }),
    );
    setEditing(null);
    await load();
  };

  const saveQuestions = async (questions: string[]) => {
    if (!customer) return;
    await api(`/api/customers/${customer.id}`, patchBody({ openQuestions: questions }));
    await load();
  };

  const remove = async () => {
    if (!customer) return;
    if (!confirm('この顧客と商談履歴を削除しますか？')) return;
    await api(`/api/customers/${customer.id}`, { method: 'DELETE' });
    router.push('/customers');
  };

  /** カルテを添えて相談画面へ渡す。 */
  const askCoach = (text: string, mode: Mode) => {
    sessionStorage.setItem('ocean:prefill', JSON.stringify({ text, customerId: customer?.id, mode }));
    router.push('/');
  };

  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>;
  if (!customer) return <div className="page"><p className="muted">読み込み中…</p></div>;

  return (
    <div className="page">
      <div className="page-head spread">
        <div>
          <h1 className="page-title">{customer.displayName}</h1>
          <p className="page-desc">最終更新 {formatDate(customer.updatedAt)}</p>
        </div>
        <div className="row">
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              askCoach(
                'この顧客との次回商談の準備をしたいです。目的、優先質問、想定反論、着地点を整理してください。',
                'A',
              )
            }
          >
            次回商談の準備を相談
          </button>
          <button type="button" className="btn-danger" onClick={remove}>
            削除
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">ヒアリング項目</h2>
        <table>
          <tbody>
            {CUSTOMER_FIELD_KEYS.map((key) => {
              const field = customer.fields[key];
              const isEditing = editing === key;
              return (
                <tr key={key}>
                  <th style={{ width: 168 }}>{CUSTOMER_FIELD_LABEL[key]}</th>
                  <td>
                    {isEditing ? (
                      <div className="stack">
                        <textarea
                          rows={2}
                          value={draft.value}
                          onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                        />
                        <div className="row">
                          <select
                            value={draft.source}
                            onChange={(e) => setDraft({ ...draft, source: e.target.value as FactSource })}
                            style={{ maxWidth: 200 }}
                          >
                            {EDITABLE_SOURCES.map((source) => (
                              <option key={source} value={source}>
                                {FACT_SOURCE_LABEL[source]}
                              </option>
                            ))}
                          </select>
                          <input
                            value={draft.evidence}
                            placeholder="根拠（顧客の発言など）"
                            onChange={(e) => setDraft({ ...draft, evidence: e.target.value })}
                            style={{ maxWidth: 320 }}
                          />
                        </div>
                        <div className="row">
                          <button type="button" className="btn-primary btn-sm" onClick={saveField}>
                            保存
                          </button>
                          <button type="button" className="btn-sm" onClick={() => setEditing(null)}>
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="spread">
                        <div>
                          {field?.value ? (
                            <>
                              <span className={SOURCE_CLASS[field.source]}>
                                {FACT_SOURCE_LABEL[field.source]}
                              </span>{' '}
                              {field.value}
                              {field.evidence && <div className="faint">根拠: {field.evidence}</div>}
                            </>
                          ) : (
                            <span className="badge badge-unconfirmed">未確認</span>
                          )}
                        </div>
                        <button type="button" className="btn-sm" onClick={() => startEdit(key)}>
                          編集
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="card-title">未確認事項（{customer.openQuestions.length}件）</h2>
        {customer.openQuestions.length === 0 && <p className="faint">登録なし</p>}
        {customer.openQuestions.map((question, index) => (
          <div key={`${question}-${index}`} className="spread" style={{ padding: '4px 0' }}>
            <span>・{question}</span>
            <button
              type="button"
              className="btn-danger btn-sm"
              onClick={() => saveQuestions(customer.openQuestions.filter((_, i) => i !== index))}
            >
              解消
            </button>
          </div>
        ))}
        <div className="row" style={{ marginTop: 8 }}>
          <input
            value={newQuestion}
            placeholder="次回確認したいこと"
            onChange={(e) => setNewQuestion(e.target.value)}
            style={{ maxWidth: 360 }}
          />
          <button
            type="button"
            onClick={() => {
              if (!newQuestion.trim()) return;
              void saveQuestions([...customer.openQuestions, newQuestion.trim()]);
              setNewQuestion('');
            }}
          >
            追加
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">商談履歴（{meetings.length}件）</h2>
        {meetings.length === 0 ? (
          <div className="empty">商談記録がありません。「商談を記録」から登録できます。</div>
        ) : (
          <div className="stack">
            {meetings.map((meeting) => (
              <details key={meeting.id} className="disclosure">
                <summary>
                  {meeting.date}　{meeting.title}
                  {meeting.stage && `（${meeting.stage}）`}
                  {meeting.outcome && ` ／ ${meeting.outcome}`}
                </summary>
                <div className="pre-wrap" style={{ marginTop: 8 }}>
                  {meeting.rawInput}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-sm"
                    onClick={() =>
                      askCoach(
                        `以下の商談を振り返ってください。\n\n日付: ${meeting.date}\n段階: ${meeting.stage || '未設定'}\n結果: ${meeting.outcome || '未記録'}\n\n${meeting.rawInput}`,
                        'B',
                      )
                    }
                  >
                    この商談を振り返る
                  </button>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
