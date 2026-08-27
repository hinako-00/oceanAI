'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { api, formatDate, patchBody } from '@/lib/client';
import {
  CONFIDENCE_LABEL,
  SKILL_AXIS_LABEL,
  TENDENCY_CATEGORY_LABEL,
} from '@/lib/types';
import type { Confidence, RepProfile, TendencyCategory } from '@/lib/types';

const CATEGORY_ORDER: TendencyCategory[] = [
  'strength',
  'habit',
  'improve',
  'goodFit',
  'hardFit',
  'nextTry',
  'change',
];

const CONFIDENCE_CLASS: Record<Confidence, string> = {
  low: 'badge badge-ai',
  mid: 'badge badge-rep',
  high: 'badge badge-confirmed',
};

/** 担当者プロフィールと、蓄積された営業傾向の確認画面。 */
export default function ProfilePage() {
  const router = useRouter();
  const [rep, setRep] = useState<RepProfile | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: '', experienceYears: 0, product: '', territory: '', note: '' });

  const load = () => {
    api<RepProfile>('/api/rep')
      .then((data) => {
        setRep(data);
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
    await api<RepProfile>('/api/rep', patchBody(form));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  };

  const removeTendency = async (id: string) => {
    await api(`/api/rep/tendencies/${id}`, { method: 'DELETE' });
    load();
  };

  const grouped = useMemo(() => {
    const map = new Map<TendencyCategory, RepProfile['tendencies']>();
    for (const category of CATEGORY_ORDER) map.set(category, []);
    for (const tendency of rep?.tendencies ?? []) {
      map.get(tendency.category)?.push(tendency);
    }
    for (const list of map.values()) list.sort((a, b) => b.observedAt.localeCompare(a.observedAt));
    return map;
  }, [rep]);

  const total = rep?.tendencies.length ?? 0;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">自分の営業傾向</h1>
        <p className="page-desc">
          記録が少ない段階の分析は「暫定的な傾向」です。根拠・データ数・信頼度をあわせて確認してください。
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h2 className="card-title">担当者プロフィール</h2>
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
          <button type="button" className="btn-primary" onClick={save}>
            保存
          </button>
          {saved && <span className="badge badge-confirmed">保存しました</span>}
        </div>
      </div>

      <div className="card">
        <div className="spread" style={{ marginBottom: 8 }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            蓄積された傾向（{total}件）
          </h2>
          <button
            type="button"
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
        {total === 0 ? (
          <div className="empty">
            まだ傾向データがありません。商談の振り返りを重ね、保存候補を承認すると蓄積されます。
          </div>
        ) : (
          CATEGORY_ORDER.map((category) => {
            const list = grouped.get(category) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={category} style={{ marginBottom: 14 }}>
                <div className="nav-label" style={{ padding: '0 0 4px' }}>
                  {TENDENCY_CATEGORY_LABEL[category]}
                </div>
                {list.map((tendency) => (
                  <div key={tendency.id} className="spread" style={{ padding: '6px 0', alignItems: 'flex-start' }}>
                    <div>
                      <span className="badge">{SKILL_AXIS_LABEL[tendency.axis]}</span>{' '}
                      <span className={CONFIDENCE_CLASS[tendency.confidence]}>
                        信頼度 {CONFIDENCE_LABEL[tendency.confidence]}
                      </span>{' '}
                      {tendency.text}
                      <div className="faint">
                        根拠: {tendency.basis || '未記載'} ／ 分析データ {tendency.dataCount}件 ／{' '}
                        {formatDate(tendency.observedAt)}
                        {tendency.neededData && ` ／ 必要な追加データ: ${tendency.neededData}`}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-danger btn-sm"
                      onClick={() => removeTendency(tendency.id)}
                    >
                      削除
                    </button>
                  </div>
                ))}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
