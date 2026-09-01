'use client';

import { useEffect, useMemo, useState } from 'react';

import SaveFlash, { useSaveFlash } from '../components/SaveFlash';
import { api, jsonBody, patchBody } from '@/lib/client';
import { matches } from '@/lib/search';
import { KNOWLEDGE_TYPE_LABEL } from '@/lib/types';
import type { Knowledge, KnowledgeType, PublicUser } from '@/lib/types';

const TYPES = Object.keys(KNOWLEDGE_TYPE_LABEL) as KnowledgeType[];

/**
 * 自社の商品情報・営業ルール・成功事例の管理。
 * ここに登録された内容は、一般的な営業理論より優先してAIが参照する。
 */
export default function KnowledgePage() {
  const [items, setItems] = useState<Knowledge[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [me, setMe] = useState<PublicUser | null>(null);
  const [error, setError] = useState('');
  // 編集中の知識ID。null なら新規登録。上のフォームを編集モードに切り替えて使い回す。
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState({ query: '', type: 'all' });
  const [form, setForm] = useState({ type: 'product' as KnowledgeType, title: '', body: '', tags: '' });
  const { note, celebrate } = useSaveFlash();

  const load = () => {
    Promise.all([
      api<Knowledge[]>('/api/knowledge'),
      api<PublicUser[]>('/api/users'),
      api<PublicUser>('/api/me'),
    ])
      .then(([k, u, current]) => {
        setItems(k);
        setUsers(u);
        setMe(current);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  const startEdit = (item: Knowledge) => {
    setEditingId(item.id);
    setForm({ type: item.type, title: item.title, body: item.body, tags: item.tags.join(', ') });
    setError('');
    // 編集フォームは画面の上にあるので、そこまで戻す。
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ ...form, title: '', body: '', tags: '' });
    setError('');
  };

  const save = async () => {
    const payload = {
      type: form.type,
      title: form.title,
      body: form.body,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (editingId) {
        await api<Knowledge>(`/api/knowledge/${editingId}`, patchBody(payload));
      } else {
        await api<Knowledge>('/api/knowledge', jsonBody(payload));
      }
      celebrate(editingId ? '知識を更新しました' : `${KNOWLEDGE_TYPE_LABEL[payload.type]}を1件ふやしました`);
      setEditingId(null);
      setForm({ ...form, title: '', body: '', tags: '' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId ? '更新に失敗しました。' : '登録に失敗しました。');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('この知識を削除しますか？チーム全員から見えなくなります。')) return;
    try {
      await api(`/api/knowledge/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました。');
    }
  };

  const userName = (id?: string) => (id ? users.find((u) => u.id === id)?.name ?? '（不明）' : '—');

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (filter.type !== 'all' && item.type !== filter.type) return false;
        // 本文とタグからも探せるようにする。AIが参照する材料なので、
        // 何が登録済みかを把握できることが登録の重複を防ぐ。
        return matches(filter.query, [item.title, item.body, ...item.tags]);
      }),
    [items, filter],
  );
  const canDelete = (item: Knowledge) =>
    !item.createdBy || item.createdBy === me?.id || me?.role === 'admin';

  // 種別ごとの登録数。どの種類が手薄かが分かると、次に何を足せばよいか決めやすい。
  // 種別に順序はないので色は分けず、1系列として同じ色で並べる。
  const byType = TYPES.map((type) => ({ type, count: items.filter((i) => i.type === type).length }));
  const typePeak = Math.max(1, ...byType.map((row) => row.count));

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">自社営業知識</h1>
        <p className="page-desc">
          登録した商品資料・営業ルール・成功事例は、一般的な営業理論より優先してAIが参照します。
          チーム全員で共有されます。
        </p>
      </div>

      <SaveFlash note={note} />

      <div className="card">
        <div className="spread" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            たまっている知識
          </h2>
          <span className="faint">全{items.length}件</span>
        </div>
        <ul className="tally">
          {byType.map((row) => (
            <li key={row.type}>
              <span className="tally-label">{KNOWLEDGE_TYPE_LABEL[row.type]}</span>
              <span className="tally-track">
                <span
                  className="tally-fill"
                  data-empty={row.count === 0}
                  style={{ width: `${(row.count / typePeak) * 100}%` }}
                />
              </span>
              <b className="tally-value">{row.count}</b>
            </li>
          ))}
        </ul>
        <p className="faint" style={{ margin: '10px 0 0' }}>
          少ない種別ほど、AIが引ける材料が足りていません。まずはそこから足すのが効きます。
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">{editingId ? '知識を編集' : '知識を登録'}</h2>
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
        <div className="page-actions" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="btn-primary"
            onClick={save}
            disabled={!form.title.trim() || !form.body.trim()}
          >
            {editingId ? '更新' : '登録'}
          </button>
          {editingId && (
            <button type="button" onClick={cancelEdit}>
              取消
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">
          登録済み（{visible.length}件{visible.length !== items.length && ` / 全${items.length}件`}）
        </h2>

        <label className="field" style={{ marginBottom: 10 }}>
          <span>検索</span>
          <input
            type="search"
            value={filter.query}
            placeholder="タイトル・本文・タグから探す"
            onChange={(e) => setFilter({ ...filter, query: e.target.value })}
          />
        </label>
        <label className="field" style={{ marginBottom: 12 }}>
          <span>種別</span>
          <select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}>
            <option value="all">すべて</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {KNOWLEDGE_TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </label>

        {visible.length === 0 ? (
          <div className="empty">
            {items.length === 0
              ? 'まだ登録がありません。登録するまでAIは一般的な営業理論で回答します。'
              : '条件に合う知識がありません。検索語や種別の絞り込みを見直してください。'}
          </div>
        ) : (
          <div className="stack">
            {visible.map((item) => (
              <details key={item.id} className="disclosure">
                <summary>
                  <span className="badge">{KNOWLEDGE_TYPE_LABEL[item.type]}</span> {item.title}
                </summary>
                <div className="pre-wrap" style={{ marginTop: 8 }}>
                  {item.body}
                </div>
                <div className="spread" style={{ marginTop: 10, alignItems: 'flex-start' }}>
                  <span className="faint" style={{ minWidth: 0 }}>
                    {item.tags.join(' / ')}
                    {item.tags.length > 0 && ' ／ '}登録者: {userName(item.createdBy)}
                  </span>
                  {canDelete(item) && (
                    <span className="row" style={{ flex: 'none', gap: 4 }}>
                      <button type="button" className="btn-sm" onClick={() => startEdit(item)}>
                        編集
                      </button>
                      <button type="button" className="btn-danger btn-sm" onClick={() => remove(item.id)}>
                        削除
                      </button>
                    </span>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
