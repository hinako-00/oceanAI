'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Formatted from './components/Formatted';
import ProposalPanel from './components/ProposalPanel';
import { api, jsonBody } from '@/lib/client';
import { MODE_LABEL } from '@/lib/types';
import type { Customer, Message, Mode, RepProfile, Session, UpdateProposal } from '@/lib/types';

interface SessionSummary extends Omit<Session, 'messages'> {
  messageCount: number;
}

interface Bootstrap {
  rep: RepProfile;
  customers: Customer[];
  sessions: SessionSummary[];
  pendingProposals: UpdateProposal[];
  hasApiKey: boolean;
}

/** 入力の手間を減らすための定型文。 */
const QUICK_PROMPTS = [
  { label: '商談前の準備', text: '明日の商談前の準備をしたいです。今回の目的、優先して聞くべき質問、想定される反論と返し方、着地点を整理してください。' },
  { label: '商談の振り返り', text: '今日の商談の振り返りをお願いします。商談メモは以下です。\n\n' },
  { label: '案件が止まった', text: '案件が止まっています。状況は以下です。原因の可能性と、次に確認すべきことを整理してください。\n\n' },
  { label: '営業傾向を確認', text: 'これまでの記録から、私の営業傾向、強み、繰り返している癖、次に試すべき行動を教えてください。' },
];

const DIFFICULTIES = ['易しい', '標準', '難しい'] as const;

export default function ChatPage() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [mode, setMode] = useState<Mode | ''>('');
  const [proposal, setProposal] = useState<UpdateProposal | null>(null);
  const [roleplay, setRoleplay] = useState({
    product: '',
    persona: '',
    stage: '初回商談',
    difficulty: '標準' as (typeof DIFFICULTIES)[number],
    focus: '',
  });
  const [roleplayActive, setRoleplayActive] = useState(false);
  const [showRoleplayForm, setShowRoleplayForm] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const reload = useCallback(async () => {
    const bootstrap = await api<Bootstrap>('/api/bootstrap');
    setData(bootstrap);
    return bootstrap;
  }, []);

  useEffect(() => {
    reload().catch((err: Error) => setError(err.message));
  }, [reload]);

  // 他画面（商談記録など）からの引き継ぎ入力を取り込む。
  useEffect(() => {
    const raw = sessionStorage.getItem('ocean:prefill');
    if (!raw) return;
    sessionStorage.removeItem('ocean:prefill');
    try {
      const prefill = JSON.parse(raw) as { text?: string; customerId?: string; mode?: Mode };
      if (prefill.text) setInput(prefill.text);
      if (prefill.customerId) setCustomerId(prefill.customerId);
      if (prefill.mode) setMode(prefill.mode);
    } catch {
      // 壊れていれば無視する。
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  const openSession = async (id: string) => {
    setError('');
    setProposal(null);
    try {
      const session = await api<Session>(`/api/sessions/${id}`);
      setSessionId(session.id);
      setMessages(session.messages);
      setCustomerId(session.customerId ?? '');
      setMode(session.mode ?? '');
      setRoleplayActive(Boolean(session.roleplay?.active));
      if (session.roleplay) {
        const { active, ...config } = session.roleplay;
        setRoleplay({ ...config, difficulty: config.difficulty });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '会話を開けませんでした。');
    }
  };

  const newSession = () => {
    setSessionId(null);
    setMessages([]);
    setStreaming('');
    setProposal(null);
    setRoleplayActive(false);
    setShowRoleplayForm(false);
    setInput('');
    textareaRef.current?.focus();
  };

  const removeSession = async (id: string) => {
    if (!confirm('この会話を削除しますか？')) return;
    await api(`/api/sessions/${id}`, { method: 'DELETE' });
    if (sessionId === id) newSession();
    await reload();
  };

  /** チャット送信。NDJSONストリームを読みながら画面を更新する。 */
  const send = async (
    text: string,
    roleplayOp?: { action: 'start'; config: typeof roleplay } | { action: 'end' },
  ) => {
    if (busy) return;
    if (!text.trim() && roleplayOp?.action !== 'end') return;

    setBusy(true);
    setError('');
    setProposal(null);
    setStreaming('');

    const shown = text.trim() || 'ロールプレイを終了します。';
    setMessages((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, role: 'user', content: shown, createdAt: new Date().toISOString() },
    ]);
    setInput('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          customerId: customerId || undefined,
          mode: mode || undefined,
          message: text,
          roleplay: roleplayOp,
        }),
      });

      if (!response.ok || !response.body) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? '応答を取得できませんでした。');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answer = '';
      let finished: { sessionId: string; proposalId?: string } | null = null;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: 'delta'; text: string }
            | { type: 'done'; sessionId: string; proposalId?: string }
            | { type: 'error'; message: string };
          if (event.type === 'delta') {
            answer += event.text;
            setStreaming(answer);
          } else if (event.type === 'error') {
            throw new Error(event.message);
          } else {
            finished = { sessionId: event.sessionId, proposalId: event.proposalId };
          }
        }
      }

      setStreaming('');
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: answer,
          createdAt: new Date().toISOString(),
        },
      ]);

      if (finished) {
        setSessionId(finished.sessionId);
        const bootstrap = await reload();
        if (finished.proposalId) {
          setProposal(bootstrap.pendingProposals.find((p) => p.id === finished!.proposalId) ?? null);
        }
      }
    } catch (err) {
      setStreaming('');
      setError(err instanceof Error ? err.message : '応答に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const startRoleplay = async () => {
    if (!roleplay.product.trim() || !roleplay.persona.trim()) {
      setError('ロールプレイを始める前に、商材と顧客像を入力してください。');
      return;
    }
    setRoleplayActive(true);
    setShowRoleplayForm(false);
    setMode('F');
    await send('ロールプレイを開始します。顧客役として最初の一言をお願いします。', {
      action: 'start',
      config: roleplay,
    });
  };

  const endRoleplay = async () => {
    setRoleplayActive(false);
    await send('', { action: 'end' });
  };

  const selectedCustomer = useMemo(
    () => data?.customers.find((c) => c.id === customerId),
    [data, customerId],
  );

  return (
    <div className="chat">
      {/* 会話一覧 */}
      <div className="chat-list">
        <button type="button" className="btn-primary" style={{ width: '100%' }} onClick={newSession}>
          ＋ 新しい相談
        </button>
        <div className="nav-label" style={{ marginTop: 16 }}>
          これまでの相談
        </div>
        {data?.sessions.length === 0 && <div className="faint" style={{ padding: '8px 10px' }}>まだ相談はありません</div>}
        {data?.sessions.map((session) => (
          <div
            key={session.id}
            className="session-item"
            data-active={session.id === sessionId}
            onClick={() => openSession(session.id)}
          >
            <div className="session-title">{session.title}</div>
            <div className="spread">
              <span className="faint">
                {session.mode ? MODE_LABEL[session.mode] : '未分類'}・{session.messageCount}件
              </span>
              <button
                type="button"
                className="btn-danger btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  void removeSession(session.id);
                }}
              >
                削除
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 会話本体 */}
      <div className="chat-main">
        <div className="chat-scroll" ref={scrollRef}>
          <div className="chat-inner">
            {data && !data.hasApiKey && (
              <div className="alert alert-warn">
                ANTHROPIC_API_KEY が未設定です。プロジェクト直下に .env.local を作成し、キーを設定してから再起動してください。
              </div>
            )}

            {messages.length === 0 && !streaming && (
              <div className="card">
                <h2 className="card-title">何を手伝いましょうか</h2>
                <p className="muted" style={{ marginTop: 0 }}>
                  商談メモや文字起こしを貼り付ければ振り返りを、これからの商談なら準備を支援します。
                  目的が決まっていない場合はそのまま相談してください。
                </p>
                <div className="row">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.label}
                      type="button"
                      className="btn-sm"
                      onClick={() => {
                        setInput(prompt.text);
                        textareaRef.current?.focus();
                      }}
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="msg-user">
                  <div className="msg-role">担当者</div>
                  <div className="bubble">{message.content}</div>
                </div>
              ) : (
                <div key={message.id} className="msg-ai">
                  <div className="msg-role">AIコーチ{roleplayActive ? '（顧客役）' : ''}</div>
                  <div className="bubble">
                    <Formatted text={message.content} />
                  </div>
                </div>
              ),
            )}

            {streaming && (
              <div className="msg-ai">
                <div className="msg-role">AIコーチ</div>
                <div className="bubble typing">
                  <Formatted text={streaming} />
                </div>
              </div>
            )}

            {busy && !streaming && <div className="faint">考えています…</div>}

            {error && <div className="alert alert-error">{error}</div>}

            {proposal && data && (
              <ProposalPanel
                proposal={proposal}
                customers={data.customers}
                currentCustomerId={customerId || undefined}
                onResolved={async (result) => {
                  setProposal(null);
                  const bootstrap = await reload();
                  if (result.status === 'applied' && !customerId && bootstrap.customers[0]) {
                    // 新規作成された顧客を会話の対象にする。
                    setCustomerId(result.customerId || bootstrap.customers[0].id);
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* 入力欄 */}
        <div className="composer">
          <div className="composer-inner">
            {roleplayActive && (
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="badge badge-rep">ロールプレイ中：AIは顧客役です</span>
                <button type="button" className="btn-sm" onClick={endRoleplay} disabled={busy}>
                  終了してフィードバックを受ける
                </button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              placeholder={
                roleplayActive
                  ? '顧客への発言を入力（Ctrl+Enterで送信）'
                  : '商談メモ・文字起こし・相談内容を入力（Ctrl+Enterで送信）'
              }
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void send(input);
                }
              }}
            />
            <div className="spread">
              <span className="faint">
                {selectedCustomer ? `対象顧客：${selectedCustomer.displayName}` : '顧客未選択'}
              </span>
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !input.trim()}
                onClick={() => void send(input)}
              >
                送信
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 設定パネル */}
      <div className="chat-side">
        <div className="nav-label">この相談の設定</div>

        <label className="field" style={{ marginBottom: 10 }}>
          <span>対象顧客</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">選択しない</option>
            {data?.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="field" style={{ marginBottom: 10 }}>
          <span>モード</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode | '')}>
            <option value="">自動判定</option>
            {(Object.keys(MODE_LABEL) as Mode[]).map((key) => (
              <option key={key} value={key}>
                {key}. {MODE_LABEL[key]}
              </option>
            ))}
          </select>
        </label>

        <div className="nav-label" style={{ marginTop: 14 }}>
          ロールプレイ
        </div>
        {!roleplayActive && !showRoleplayForm && (
          <button type="button" style={{ width: '100%' }} onClick={() => setShowRoleplayForm(true)}>
            設定して開始する
          </button>
        )}
        {showRoleplayForm && (
          <div className="stack" style={{ marginTop: 6 }}>
            <label className="field">
              <span>商材</span>
              <input
                value={roleplay.product}
                onChange={(e) => setRoleplay({ ...roleplay, product: e.target.value })}
                placeholder="例：中小企業向け勤怠管理SaaS"
              />
            </label>
            <label className="field">
              <span>顧客像</span>
              <input
                value={roleplay.persona}
                onChange={(e) => setRoleplay({ ...roleplay, persona: e.target.value })}
                placeholder="例：従業員80名の製造業／総務部長"
              />
            </label>
            <label className="field">
              <span>商談段階</span>
              <input
                value={roleplay.stage}
                onChange={(e) => setRoleplay({ ...roleplay, stage: e.target.value })}
              />
            </label>
            <label className="field">
              <span>難易度</span>
              <select
                value={roleplay.difficulty}
                onChange={(e) =>
                  setRoleplay({ ...roleplay, difficulty: e.target.value as (typeof DIFFICULTIES)[number] })
                }
              >
                {DIFFICULTIES.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>練習したい項目</span>
              <input
                value={roleplay.focus}
                onChange={(e) => setRoleplay({ ...roleplay, focus: e.target.value })}
                placeholder="例：価格の反論対応"
              />
            </label>
            <div className="row">
              <button type="button" className="btn-primary" onClick={startRoleplay} disabled={busy}>
                開始
              </button>
              <button type="button" onClick={() => setShowRoleplayForm(false)}>
                やめる
              </button>
            </div>
          </div>
        )}
        {roleplayActive && (
          <div className="faint">
            {roleplay.product} ／ {roleplay.persona}（難易度：{roleplay.difficulty}）
            <br />
            AIは指導せず顧客役に徹します。終了後にフィードバックします。
          </div>
        )}

        {data && data.pendingProposals.length > 0 && (
          <>
            <div className="nav-label" style={{ marginTop: 16 }}>
              未確認の保存候補
            </div>
            <div className="faint">
              {data.pendingProposals.length}件あります。会話を開くと内容を確認できます。
            </div>
          </>
        )}
      </div>
    </div>
  );
}
