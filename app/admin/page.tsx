'use client';

import { useEffect, useState } from 'react';

import { api, formatDate, jsonBody, patchBody } from '@/lib/client';
import { USER_ROLE_LABEL } from '@/lib/types';
import type { PublicUser, UserRole } from '@/lib/types';

/** メンバー管理（管理者のみ）。追加・役割変更・無効化・パスワード再設定。 */
export default function AdminPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' as UserRole });
  const [resetting, setResetting] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const load = () => {
    api<PublicUser[]>('/api/users')
      .then(setUsers)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  const add = async () => {
    setError('');
    setMessage('');
    try {
      await api<PublicUser>('/api/users', jsonBody(form));
      setMessage(`${form.name} さんを追加しました。初回パスワードを本人へ伝えてください。`);
      setForm({ name: '', email: '', password: '', role: 'member' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '追加に失敗しました。');
    }
  };

  const patch = async (id: string, body: Record<string, unknown>, note: string) => {
    setError('');
    setMessage('');
    try {
      await api(`/api/users/${id}`, patchBody(body));
      setMessage(note);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました。');
    }
  };

  const submitReset = async (id: string) => {
    await patch(id, { password: resetPassword }, 'パスワードを再設定しました。本人へ伝えてください。');
    setResetting(null);
    setResetPassword('');
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">メンバー管理</h1>
        <p className="page-desc">
          営業担当者のアカウントを管理します。退職・異動時は削除せず「無効化」してください。
          過去のアポ履歴との紐付けが残ります。
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-warn">{message}</div>}

      <div className="card">
        <h2 className="card-title">メンバーを追加</h2>
        <div className="grid-2" style={{ marginBottom: 10 }}>
          <label className="field">
            <span>氏名</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="field">
            <span>メールアドレス</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="field">
            <span>初回パスワード（10文字以上）</span>
            <input
              type="text"
              value={form.password}
              placeholder="本人へ伝えて、初回ログイン後に変更してもらう"
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label className="field">
            <span>役割</span>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              <option value="member">メンバー</option>
              <option value="admin">管理者</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          className="btn-primary btn-block"
          onClick={add}
          disabled={!form.name.trim() || !form.email.trim() || form.password.length < 10}
        >
          追加
        </button>
      </div>

      <div className="card">
        <h2 className="card-title">登録済み（{users.length}名）</h2>
        <table className="cards">
          <thead>
            <tr>
              <th>氏名</th>
              <th>メール</th>
              <th>役割</th>
              <th>状態</th>
              <th>最終ログイン</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td data-head="">
                  <strong>{user.name}</strong>
                  <div className="faint">{user.email}</div>
                </td>
                <td className="faint desktop-cell" data-label="メール">
                  {user.email}
                </td>
                <td data-label="役割">
                  <select
                    value={user.role}
                    onChange={(e) =>
                      patch(user.id, { role: e.target.value }, `${user.name} さんの役割を変更しました。`)
                    }
                  >
                    <option value="member">{USER_ROLE_LABEL.member}</option>
                    <option value="admin">{USER_ROLE_LABEL.admin}</option>
                  </select>
                </td>
                <td data-label="状態">
                  {user.active ? (
                    <span className="badge badge-confirmed">有効</span>
                  ) : (
                    <span className="badge badge-unconfirmed">無効</span>
                  )}
                </td>
                <td className="faint" data-label="最終ログイン">
                  {user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}
                </td>
                <td data-label="操作">
                  {resetting === user.id ? (
                    <div className="row">
                      <input
                        type="text"
                        value={resetPassword}
                        placeholder="新しいパスワード"
                        onChange={(e) => setResetPassword(e.target.value)}
                        style={{ flex: '1 1 160px', minWidth: 0 }}
                      />
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        disabled={resetPassword.length < 10}
                        onClick={() => submitReset(user.id)}
                      >
                        確定
                      </button>
                      <button type="button" className="btn-sm" onClick={() => setResetting(null)}>
                        取消
                      </button>
                    </div>
                  ) : (
                    <div className="row">
                      <button
                        type="button"
                        className="btn-sm"
                        onClick={() => {
                          setResetting(user.id);
                          setResetPassword('');
                        }}
                      >
                        パスワード再設定
                      </button>
                      <button
                        type="button"
                        className="btn-sm"
                        onClick={() =>
                          patch(
                            user.id,
                            { active: !user.active },
                            `${user.name} さんを${user.active ? '無効化' : '有効化'}しました。`,
                          )
                        }
                      >
                        {user.active ? '無効化' : '有効化'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
