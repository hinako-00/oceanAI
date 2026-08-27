'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { api, jsonBody } from '@/lib/client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // 利用者が1人もいなければ初期設定へ送る。
  useEffect(() => {
    api<{ needsSetup: boolean }>('/api/auth/setup')
      .then((data) => {
        if (data.needsSetup) router.replace('/setup');
      })
      .catch(() => undefined);
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/login', jsonBody({ email, password }));
      const next = params.get('next');
      router.push(next && next.startsWith('/') ? next : '/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-brand">
        <div className="brand-mark">O</div>
        <div>
          <div className="brand-name">Ocean AI</div>
          <div className="brand-sub">AI営業コーチ</div>
        </div>
      </div>

      <div className="stack">
        <label className="field">
          <span>メールアドレス</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>パスワード</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'ログイン中…' : 'ログイン'}
        </button>
        <p className="faint" style={{ margin: 0 }}>
          パスワードが分からない場合は、社内の管理者に再設定を依頼してください。
        </p>
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-screen">
      <Suspense fallback={<div className="auth-card muted">読み込み中…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
