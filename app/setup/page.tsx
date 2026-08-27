'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { api, jsonBody } from '@/lib/client';

/** 最初の管理者を作る画面。利用者が1人でもいれば表示しない。 */
export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ needsSetup: boolean }>('/api/auth/setup')
      .then((data) => {
        if (!data.needsSetup) router.replace('/login');
      })
      .catch(() => undefined);
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError('確認用パスワードが一致しません。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/setup', jsonBody({ name: form.name, email: form.email, password: form.password }));
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '初期設定に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <div className="brand-mark">O</div>
          <div>
            <div className="brand-name">初期設定</div>
            <div className="brand-sub">最初の管理者アカウントを作成します</div>
          </div>
        </div>

        <div className="stack">
          <label className="field">
            <span>氏名</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="field">
            <span>メールアドレス</span>
            <input
              type="email"
              autoComplete="username"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>パスワード（10文字以上）</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>パスワード（確認）</span>
            <input
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              required
            />
          </label>
          {error && <div className="alert alert-error">{error}</div>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '作成中…' : '管理者を作成して開始'}
          </button>
          <p className="faint" style={{ margin: 0 }}>
            作成後、「メンバー管理」から他の営業担当者を追加できます。
          </p>
        </div>
      </form>
    </div>
  );
}
