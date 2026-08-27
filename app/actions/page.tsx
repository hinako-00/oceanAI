'use client';

import { useCallback, useEffect, useState } from 'react';

import { api, jsonBody, patchBody, today } from '@/lib/client';
import type { Customer, NextAction, PublicUser } from '@/lib/types';

/** 次回行動の管理。AIの提案は保存候補を承認したときにここへ入る。 */
export default function ActionsPage() {
  const [actions, setActions] = useState<NextAction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [me, setMe] = useState<PublicUser | null>(null);
  const [scope, setScope] = useState<'mine' | 'team'>('mine');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ action: '', purpose: '', due: today(), customerId: '' });

  const load = useCallback(() => {
    Promise.all([
      api<NextAction[]>(`/api/next-actions${scope === 'team' ? '?scope=team' : ''}`),
      api<Customer[]>('/api/customers'),
      api<PublicUser[]>('/api/users'),
      api<PublicUser>('/api/me'),
    ])
      .then(([a, c, u, current]) => {
        setActions(a);
        setCustomers(c);
        setUsers(u);
        setMe(current);
      })
      .catch((err: Error) => setError(err.message));
  }, [scope]);

  useEffect(load, [load]);

  const add = async () => {
    if (!form.action.trim()) return;
    try {
      await api<NextAction>('/api/next-actions', jsonBody(form));
      setForm({ ...form, action: '', purpose: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました。');
    }
  };

  const toggle = async (action: NextAction) => {
    try {
      await api(`/api/next-actions/${action.id}`, patchBody({ done: !action.done }));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました。');
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/api/next-actions/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました。');
    }
  };

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? '（不明）';
  const canEdit = (action: NextAction) => action.repId === me?.id || me?.role === 'admin';

  const open = actions.filter((a) => !a.done);
  const done = actions.filter((a) => a.done);
  const overdue = (due: string) => due && due < today();

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">次回行動</h1>
        <p className="page-desc">担当者・期限・目的をセットで管理します。相談画面で承認した提案もここに入ります。</p>
      </div>

      <div className="tabs">
        <button type="button" className="tab" data-active={scope === 'mine'} onClick={() => setScope('mine')}>
          自分の行動
        </button>
        <button type="button" className="tab" data-active={scope === 'team'} onClick={() => setScope('team')}>
          チーム全体
        </button>
      </div>

      <div className="card">
        <h2 className="card-title">未完了（{open.length}件）</h2>
        {open.length === 0 ? (
          <div className="empty">未完了の行動はありません。</div>
        ) : (
          open.map((action) => (
            <div key={action.id} className="checkline">
              <input
                type="checkbox"
                checked={false}
                disabled={!canEdit(action)}
                onChange={() => toggle(action)}
              />
              <span style={{ flex: 1 }}>
                {action.action}
                <div className="faint">
                  {scope === 'team' && `担当: ${userName(action.repId)} ／ `}
                  目的: {action.purpose || '未記載'} ／ 期限:{' '}
                  <span style={overdue(action.due) ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>
                    {action.due || '未設定'}
                    {overdue(action.due) && '（期限超過）'}
                  </span>
                  {action.customerId &&
                    ` ／ 顧客: ${customers.find((c) => c.id === action.customerId)?.displayName ?? '（削除済み）'}`}
                </div>
              </span>
              {canEdit(action) && (
                <button type="button" className="btn-danger btn-sm" onClick={() => remove(action.id)}>
                  削除
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h2 className="card-title">行動を追加</h2>
        <div className="grid-2" style={{ marginBottom: 10 }}>
          <label className="field">
            <span>行動</span>
            <input
              value={form.action}
              placeholder="例：導入時期と決裁フローを確認する"
              onChange={(e) => setForm({ ...form, action: e.target.value })}
            />
          </label>
          <label className="field">
            <span>目的</span>
            <input
              value={form.purpose}
              placeholder="例：意思決定条件を特定するため"
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            />
          </label>
          <label className="field">
            <span>期限</span>
            <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
          </label>
          <label className="field">
            <span>顧客</span>
            <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>
              <option value="">指定しない</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <div className="alert alert-error" style={{ marginBottom: 10 }}>{error}</div>}
        <button type="button" className="btn-primary" onClick={add} disabled={!form.action.trim()}>
          追加
        </button>
      </div>

      {done.length > 0 && (
        <div className="card">
          <h2 className="card-title">完了（{done.length}件）</h2>
          {done.map((action) => (
            <div key={action.id} className="checkline">
              <input type="checkbox" checked readOnly onClick={() => toggle(action)} />
              <span style={{ flex: 1, color: 'var(--text-faint)' }}>{action.action}</span>
              <button type="button" className="btn-danger btn-sm" onClick={() => remove(action.id)}>
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
