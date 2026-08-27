'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { api, formatDate, jsonBody } from '@/lib/client';
import { CUSTOMER_FIELD_LABEL, FACT_SOURCE_LABEL } from '@/lib/types';
import type { Customer } from '@/lib/types';

/** 顧客カルテの一覧。要約として中心課題と温度感を出す。 */
export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    api<Customer[]>('/api/customers')
      .then(setCustomers)
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

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">顧客カルテ</h1>
        <p className="page-desc">
          確認済みの事実・担当者の報告・AIの仮説を区別して記録します。情報がない項目は「未確認」のままにします。
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
            style={{ maxWidth: 320 }}
          />
          <button type="button" className="btn-primary" onClick={create} disabled={!name.trim()}>
            追加
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

      <div className="card">
        <h2 className="card-title">登録済み（{customers.length}件）</h2>
        {customers.length === 0 ? (
          <div className="empty">まだ顧客がありません。相談画面でAIが抽出した情報から作成することもできます。</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>顧客</th>
                <th>{CUSTOMER_FIELD_LABEL.coreIssue}</th>
                <th>{CUSTOMER_FIELD_LABEL.temperature}</th>
                <th>未確認</th>
                <th>更新</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const issue = customer.fields.coreIssue;
                const temperature = customer.fields.temperature;
                return (
                  <tr key={customer.id}>
                    <td>
                      <Link href={`/customers/${customer.id}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        {customer.displayName}
                      </Link>
                    </td>
                    <td>
                      {issue ? (
                        <>
                          {issue.value}
                          <div className="faint">{FACT_SOURCE_LABEL[issue.source]}</div>
                        </>
                      ) : (
                        <span className="badge badge-unconfirmed">未確認</span>
                      )}
                    </td>
                    <td>{temperature?.value ?? <span className="badge badge-unconfirmed">未確認</span>}</td>
                    <td>{customer.openQuestions.length}件</td>
                    <td className="faint">{formatDate(customer.updatedAt)}</td>
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
