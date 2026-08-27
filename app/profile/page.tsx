'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import TendencyList from '../components/TendencyList';
import { api, jsonBody, patchBody } from '@/lib/client';
import { USER_ROLE_LABEL } from '@/lib/types';
import type { PublicUser } from '@/lib/types';

/** 自分のプロフィール・パスワード・蓄積された営業傾向。 */
export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<PublicUser | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: '', experienceYears: 0, product: '', territory: '', note: '' });
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const load = () => {
    api<PublicUser>('/api/me')
      .then((data) => {
        setMe(data);
        setForm({
          name: data.name,
          experienceYears: data.experienceYears,
          product: data.product,
          territory: data.territory,
          note: data.note,
        });
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  const save = async () => {
    try {
      await api<PublicUser>('/api/me', patchBody(form));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      load();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。');
    }
  };

  const changePassword = async () => {
    setPasswordError('');
    setPasswordMessage('');
    if (password.next !== password.confirm) {
      setPasswordError('確認用パスワードが一致しません。');
      return;
    }
    try {
      await api('/api/me/password', jsonBody({ current: password.current, next: password.next }));
      setPassword({ current: '', next: '', confirm: '' });
      setPasswordMessage('パスワードを変更しました。他の端末のログインは無効になりました。');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '変更に失敗しました。');
    }
  };

  const removeTendency = async (id: string) => {
    if (!me) return;
    await api(`/api/users/${me.id}/tendencies/${id}`, { method: 'DELETE' });
    load();
  };

  const total = me?.tendencies.length ?? 0;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">自分の設定と営業傾向</h1>
        <p className="page-desc">
          記録が少ない段階の分析は「暫定的な傾向」です。根拠・データ数・信頼度をあわせて確認してください。
          営業傾向はチームのメンバーも閲覧できます。
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h2 className="card-title">プロフィール</h2>
        {me && (
          <p className="faint" style={{ marginTop: 0 }}>
            {me.email}（{USER_ROLE_LABEL[me.role]}）
          </p>
        )}
        <div className="grid-2" style={{ marginBottom: 10 }}>
          <label className="field">
            <span>氏名</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="field">
            <span>営業経験年数</span>
            <input
              type="number"
              min={0}
              value={form.experienceYears}
              onChange={(e) => setForm({ ...form, experienceYears: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>担当商材</span>
            <input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
          </label>
          <label className="field">
            <span>担当領域・顧客層</span>
            <input value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} />
          </label>
        </div>
        <label className="field" style={{ marginBottom: 10 }}>
          <span>自分で感じている課題</span>
          <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </label>
        <div className="row">
          <button type="button" className="btn-primary" style={{ flex: '1 1 auto' }} onClick={save}>
            保存
          </button>
          {saved && <span className="badge badge-confirmed">保存しました</span>}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">パスワードの変更</h2>
        <div className="grid-2" style={{ marginBottom: 10 }}>
          <label className="field">
            <span>現在のパスワード</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password.current}
              onChange={(e) => setPassword({ ...password, current: e.target.value })}
            />
          </label>
          <label className="field">
            <span>新しいパスワード（10文字以上）</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password.next}
              onChange={(e) => setPassword({ ...password, next: e.target.value })}
            />
          </label>
          <label className="field">
            <span>新しいパスワード（確認）</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password.confirm}
              onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
            />
          </label>
        </div>
        {passwordError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{passwordError}</div>}
        {passwordMessage && <div className="alert alert-warn" style={{ marginBottom: 10 }}>{passwordMessage}</div>}
        <button
          type="button"
          className="btn-block"
          onClick={changePassword}
          disabled={!password.current || !password.next}
        >
          変更する
        </button>
      </div>

      <div className="card">
        <div className="spread" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            蓄積された傾向（{total}件）
          </h2>
          <button
            type="button"
            className="btn-sm"
            onClick={() => {
              sessionStorage.setItem(
                'ocean:prefill',
                JSON.stringify({
                  mode: 'G',
                  text: 'これまでの記録から私の営業傾向を分析してください。強み、繰り返している癖、次に試すべき行動を、根拠と信頼度つきで教えてください。',
                }),
              );
              router.push('/');
            }}
          >
            AIに傾向を分析させる
          </button>
        </div>
        <TendencyList tendencies={me?.tendencies ?? []} onDelete={removeTendency} />
      </div>
    </div>
  );
}
