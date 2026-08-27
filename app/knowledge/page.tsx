'use client';

import { useEffect, useState } from 'react';

import { api, jsonBody } from '@/lib/client';
import { KNOWLEDGE_TYPE_LABEL } from '@/lib/types';
import type { Knowledge, KnowledgeType } from '@/lib/types';

const TYPES = Object.keys(KNOWLEDGE_TYPE_LABEL) as KnowledgeType[];

/**
 * 自社の商品情報・営業ルール・成功事例の管理。
 * ここに登録された内容は、一般的な営業理論より優先してAIが参照する。
 */
export default function KnowledgePage() {
  const [items, setItems] = useState<Knowledge[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ type: 'product' as KnowledgeType, title: '', body: '', tags: '' });

  const load = () => {
    api<Knowledge[]>('/api/knowledge')
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  const add = async () => {
    try {
      await api<Knowledge>(
        '/api/knowledge',
        jsonBody({
          type: form.type,
          title: form.title,
          body: form.body,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      );
      setForm({ ...form, title: '', body: '', tags: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました。');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('この知識を削除しますか？')) return;
    await api(`/api/knowledge/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">自社営業知識</h1>
        <p className="page-desc">
          登録した商品資料・営業ルール・成功事例は、一般的な営業理論より優先してAIが参照します。
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">知識を登録</h2>
        <div className="grid-2" style={{ marginBottom: 10 }}>
          <label className="field">
            <span>種別</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as KnowledgeType })}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {KNOWLEDGE_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>タイトル</span>
            <input
              value={form.title}
              placeholder="例：料金体系と値引きルール"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
        </div>
        <label className="field" style={{ marginBottom: 10 }}>
          <span>本文</span>
          <textarea
            rows={6}
            value={form.body}
            placeholder="製品の仕様、禁止事項、勝ちパターンなどを具体的に書いてください。"
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </label>
        <label className="field" style={{ marginBottom: 10 }}>
          <span>タグ（カンマ区切り）</span>
          <input
            value={form.tags}
            placeholder="価格, 反論対応"
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
        </label>
        {error && <div className="alert alert-error" style={{ marginBottom: 10 }}>{error}</div>}
        <button
          type="button"
          className="btn-primary"
          onClick={add}
          disabled={!form.title.trim() || !form.body.trim()}
        >
          登録
        </button>
      </div>

      <div className="card">
        <h2 className="card-title">登録済み（{items.length}件）</h2>
        {items.length === 0 ? (
          <div className="empty">まだ登録がありません。登録するまでAIは一般的な営業理論で回答します。</div>
        ) : (
          <div className="stack">
            {items.map((item) => (
              <details key={item.id} className="disclosure">
                <summary>
                  <span className="badge">{KNOWLEDGE_TYPE_LABEL[item.type]}</span> {item.title}
                </summary>
                <div className="pre-wrap" style={{ marginTop: 8 }}>
                  {item.body}
                </div>
                <div className="spread" style={{ marginTop: 8 }}>
                  <span className="faint">{item.tags.join(' / ')}</span>
                  <button type="button" className="btn-danger btn-sm" onClick={() => remove(item.id)}>
                    削除
                  </button>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
