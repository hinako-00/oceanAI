'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { api, jsonBody, today } from '@/lib/client';
import type { Customer, Meeting, MeetingInputType, PublicUser } from '@/lib/types';

const INPUT_TYPES: Array<{ value: MeetingInputType; label: string }> = [
  { value: 'memo', label: '商談メモ' },
  { value: 'transcript', label: '録音の文字起こし' },
  { value: 'chat', label: 'チャット・メールのやりとり' },
];

const OUTCOMES = ['継続', '次回アポ確定', '検討中', '保留', '受注', '失注'];

/** 商談を記録し、そのままAIの振り返りに渡す画面。 */
export default function MeetingsPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [me, setMe] = useState<PublicUser | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    date: today(),
    title: '',
    stage: '',
    outcome: '継続',
    inputType: 'memo' as MeetingInputType,
    rawInput: '',
  });

  const load = () => {
    Promise.all([
      api<Customer[]>('/api/customers'),
      api<Meeting[]>('/api/meetings'),
      api<PublicUser[]>('/api/users'),
      api<PublicUser>('/api/me'),
    ])
      .then(([c, m, u, current]) => {
        setCustomers(c);
        setMeetings(m);
        setUsers(u);
        setMe(current);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  const save = async (thenAnalyze: boolean) => {
    if (!form.customerId) {
      setError('顧客を選択してください。');
      return;
    }
    if (!form.rawInput.trim()) {
      setError('商談メモまたは文字起こしを入力してください。');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api<Meeting>('/api/meetings', jsonBody(form));
      if (thenAnalyze) {
        const label = INPUT_TYPES.find((t) => t.value === form.inputType)?.label ?? '記録';
        sessionStorage.setItem(
          'ocean:prefill',
          JSON.stringify({
            customerId: form.customerId,
            mode: 'B',
            text: `以下の商談を振り返ってください。\n\n日付: ${form.date}\n商談: ${form.title || '未設定'}\n段階: ${form.stage || '未設定'}\n結果: ${form.outcome}\n形式: ${label}\n\n${form.rawInput}`,
          }),
        );
        router.push('/');
        return;
      }
      setForm({ ...form, title: '', stage: '', rawInput: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('この商談記録を削除しますか？')) return;
    try {
      await api(`/api/meetings/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました。');
    }
  };

  const customerName = (id: string) => customers.find((c) => c.id === id)?.displayName ?? '（削除済み）';
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? '（不明）';

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">商談を記録</h1>
        <p className="page-desc">
          メモや文字起こしをそのまま貼り付けてください。記録はチーム全員が閲覧でき、
          AIの振り返りと次回準備に使われます。
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">新しい商談</h2>
        {customers.length === 0 && (
          <div className="alert alert-warn" style={{ marginBottom: 10 }}>
            先に「顧客カルテ」で顧客を登録してください。
          </div>
        )}
        <div className="grid-2" style={{ marginBottom: 10 }}>
          <label className="field">
            <span>顧客</span>
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            >
              <option value="">選択してください</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>商談日</span>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label className="field">
            <span>商談名</span>
            <input
              value={form.title}
              placeholder="例：初回ヒアリング"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="field">
            <span>商談段階</span>
            <input
              value={form.stage}
              placeholder="例：ヒアリング／提案／クロージング"
              onChange={(e) => setForm({ ...form, stage: e.target.value })}
            />
          </label>
          <label className="field">
            <span>入力の種類</span>
            <select
              value={form.inputType}
              onChange={(e) => setForm({ ...form, inputType: e.target.value as MeetingInputType })}
            >
              {INPUT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>商談結果</span>
            <select value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })}>
              {OUTCOMES.map((outcome) => (
                <option key={outcome} value={outcome}>
                  {outcome}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field" style={{ marginBottom: 10 }}>
          <span>商談メモ・文字起こし</span>
          <textarea
            rows={10}
            value={form.rawInput}
            placeholder={'例）\n顧客：今の勤怠管理はExcelで、締めのたびに総務が3日かかっています。\n担当：それは大変ですね。今の運用でいちばん困っているのはどこですか。'}
            onChange={(e) => setForm({ ...form, rawInput: e.target.value })}
          />
        </label>

        {error && <div className="alert alert-error" style={{ marginBottom: 10 }}>{error}</div>}

        <div className="row">
          <button type="button" className="btn-primary" disabled={saving} onClick={() => save(true)}>
            保存してAIに振り返らせる
          </button>
          <button type="button" disabled={saving} onClick={() => save(false)}>
            保存だけする
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">記録済みの商談（{meetings.length}件）</h2>
        {meetings.length === 0 ? (
          <div className="empty">まだ商談記録がありません。</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>日付</th>
                <th>顧客</th>
                <th>担当者</th>
                <th>商談</th>
                <th>段階</th>
                <th>結果</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {meetings.map((meeting) => (
                <tr key={meeting.id}>
                  <td>{meeting.date}</td>
                  <td>{customerName(meeting.customerId)}</td>
                  <td className="owner-tag">{userName(meeting.repId)}</td>
                  <td>{meeting.title}</td>
                  <td>{meeting.stage || '—'}</td>
                  <td>{meeting.outcome || '—'}</td>
                  <td>
                    {(meeting.repId === me?.id || me?.role === 'admin') && (
                      <button type="button" className="btn-danger btn-sm" onClick={() => remove(meeting.id)}>
                        削除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
