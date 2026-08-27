'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import TendencyList from '../../components/TendencyList';
import { api } from '@/lib/client';
import { USER_ROLE_LABEL } from '@/lib/types';
import type { PublicUser } from '@/lib/types';

/** メンバー1人の営業傾向。削除は本人と管理者だけがサーバー側で許可される。 */
export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const [member, setMember] = useState<PublicUser | null>(null);
  const [me, setMe] = useState<PublicUser | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [target, current] = await Promise.all([
        api<PublicUser>(`/api/users/${params.id}`),
        api<PublicUser>('/api/me'),
      ]);
      setMember(target);
      setMe(current);
    } catch (err) {
      setError(err instanceof Error ? err.message : '読み込みに失敗しました。');
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const canDelete = Boolean(me && member && (me.id === member.id || me.role === 'admin'));

  const removeTendency = async (id: string) => {
    if (!member) return;
    await api(`/api/users/${member.id}/tendencies/${id}`, { method: 'DELETE' });
    await load();
  };

  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>;
  if (!member) return <div className="page"><p className="muted">読み込み中…</p></div>;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{member.name} の営業傾向</h1>
        <p className="page-desc">
          {USER_ROLE_LABEL[member.role]}・経験{member.experienceYears}年
          {member.product && `・担当商材: ${member.product}`}
          {member.territory && `・担当領域: ${member.territory}`}
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">蓄積された傾向（{member.tendencies.length}件）</h2>
        <p className="faint" style={{ marginTop: 0 }}>
          AIによる観察結果です。データ数が少ないものは暫定的な傾向として扱ってください。
        </p>
        <TendencyList
          tendencies={member.tendencies}
          onDelete={canDelete ? removeTendency : undefined}
        />
      </div>
    </div>
  );
}
