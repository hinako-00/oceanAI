'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { api, formatDate, jsonBody } from '@/lib/client';
import { matches } from '@/lib/search';
import { CUSTOMER_FIELD_LABEL, FACT_SOURCE_LABEL } from '@/lib/types';
import type { Customer, PublicUser } from '@/lib/types';

/** 顧客カルテの一覧。チーム全員の顧客を表示し、担当者で絞り込める。 */
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [me, setMe] = useState<PublicUser | null>(null);
  const [name, setName] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([
      api<Customer[]>('/api/customers'),
      api<PublicUser[]>('/api/users'),
      api<PublicUser>('/api/me'),
    ])
      .then(([c, u, m]) => {
        setCustomers(c);
        setUsers(u);
        setMe(m);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  const create = async () => {
    if (!name.trim()) return;
    try {
      await api<Customer>('/api/customers', jsonBody({ displayName: name.trim() }));
      setName('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました。');
    }
  };

  const ownerName = (id: string) => users.find((u) => u.id === id)?.name ?? '（不明）';

  const visible = useMemo(() => {
    const byOwner =
      ownerFilter === 'all'
        ? customers
        : ownerFilter === 'mine'
          ? customers.filter((c) => c.ownerRepId === me?.id)
          : customers.filter((c) => c.ownerRepId === ownerFilter);
    if (!query.trim()) return byOwner;
    // 会社名だけでなく、課題や未確認事項の文言からも探せるようにする。
    return byOwner.filter((c) =>
      matches(query, [
        c.displayName,
        c.fields.coreIssue?.value,
        c.fields.currentSituation?.value,
        c.fields.surfaceRequest?.value,
        c.fields.temperature?.value,
        ...c.openQuestions,
      ]),
    );
  }, [customers, ownerFilter, me, query]);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">顧客カルテ</h1>
        <p className="page-desc">
          チーム全員で共有します。確認済みの事実・担当者の報告・AIの仮説を区別して記録し、
          情報がない項目は「未確認」のままにします。
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">顧客を追加</h2>
        <div className="row">
          <input
            value={name}
            placeholder="会社名または顧客名"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            style={{ flex: '1 1 200px', minWidth: 0 }}
          />
          <button type="button" className="btn-primary" onClick={create} disabled={!name.trim()}>
            追加
          </button>
        </div>
        <p className="faint" style={{ margin: '8px 0 0' }}>
          担当者は自分になります（後から引き継げます）
        </p>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

      <div className="card">
        <div className="spread" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
          <h2 className="card-title" style={{ margin: 0 }}>
          登録済み（{visible.length}件{visible.length !== customers.length && ` / 全${customers.length}件`}）
          </h2>
          <a className="btn btn-sm" href="/api/export?kind=customers" download>
            CSVで書き出す
          </a>
        </div>
        <label className="field" style={{ marginBottom: 12 }}>
          <span>検索</span>
          <input
            type="search"
            value={query}
            placeholder="会社名・課題・未確認事項から探す"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="field" style={{ marginBottom: 12 }}>
          <span>担当者でしぼり込む</span>
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="all">すべて</option>
            <option value="mine">自分の顧客</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        {visible.length === 0 ? (
          <div className="empty">
            {query.trim() || ownerFilter !== 'all'
              ? '条件に合う顧客がありません。検索語や担当者の絞り込みを見直してください。'
              : 'まだ顧客が登録されていません。'}
          </div>
        ) : (
          <table className="cards">
            <thead>
              <tr>
                <th>顧客</th>
                <th>担当者</th>
                <th>{CUSTOMER_FIELD_LABEL.coreIssue}</th>
                <th>{CUSTOMER_FIELD_LABEL.temperature}</th>
                <th>未確認</th>
                <th>更新</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((customer) => {
                const issue = customer.fields.coreIssue;
                const temperature = customer.fields.temperature;
                return (
                  <tr key={customer.id}>
                    <td data-head="">
                      <Link href={`/customers/${customer.id}`} style={{ color: 'var(--accent)', fontWeight: 700 }}>
                        {customer.displayName}
                      </Link>
                    </td>
                    <td className="owner-tag" data-label="担当者">
                      {ownerName(customer.ownerRepId)}
                      {customer.ownerRepId === me?.id && <span className="badge badge-rep"> 自分</span>}
                    </td>
                    <td data-label={CUSTOMER_FIELD_LABEL.coreIssue}>
                      {issue ? (
                        <span>
                          {issue.value}
                          <div className="faint">{FACT_SOURCE_LABEL[issue.source]}</div>
                        </span>
                      ) : (
                        <span className="badge badge-unconfirmed">未確認</span>
                      )}
                    </td>
                    <td data-label={CUSTOMER_FIELD_LABEL.temperature}>
                      {temperature?.value ?? <span className="badge badge-unconfirmed">未確認</span>}
                    </td>
                    <td data-label="未確認">{customer.openQuestions.length}件</td>
                    <td className="faint" data-label="更新">{formatDate(customer.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
