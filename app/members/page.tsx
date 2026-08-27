'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { api, formatDate } from '@/lib/client';
import { TENDENCY_CATEGORY_LABEL, USER_ROLE_LABEL } from '@/lib/types';
import type { PublicUser } from '@/lib/types';

/**
 * チームの営業傾向の一覧。
 * 誰がどの点を強みにしているかを共有し、相談先を見つけやすくするための画面。
 */
export default function MembersPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<PublicUser[]>('/api/users')
      .then(setUsers)
      .catch((err: Error) => setError(err.message));
  }, []);

  const count = (user: PublicUser, category: string) =>
    user.tendencies.filter((t) => t.category === category).length;

  const lastObserved = (user: PublicUser) => {
    const latest = user.tendencies
      .map((t) => t.observedAt)
      .sort()
      .at(-1);
    return latest ? formatDate(latest) : '—';
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">チームの傾向</h1>
        <p className="page-desc">
          メンバーの強みと改善点を共有し、相談先や勝ちパターンの共有に使う画面です。
          人事評価のための資料ではありません。分析はAIによる観察であり、信頼度と根拠を必ず確認してください。
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h2 className="card-title">メンバー（{users.length}名）</h2>
        {users.length === 0 ? (
          <div className="empty">メンバーがいません。</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>氏名</th>
                <th>担当商材</th>
                <th>{TENDENCY_CATEGORY_LABEL.strength}</th>
                <th>{TENDENCY_CATEGORY_LABEL.improve}</th>
                <th>{TENDENCY_CATEGORY_LABEL.nextTry}</th>
                <th>最終更新</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Link href={`/members/${user.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      {user.name}
                    </Link>
                    {!user.active && <span className="badge badge-unconfirmed"> 無効</span>}
                    <div className="faint">
                      {USER_ROLE_LABEL[user.role]}・経験{user.experienceYears}年
                    </div>
                  </td>
                  <td>{user.product || '—'}</td>
                  <td>{count(user, 'strength')}件</td>
                  <td>{count(user, 'improve')}件</td>
                  <td>{count(user, 'nextTry')}件</td>
                  <td className="faint">{lastObserved(user)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
