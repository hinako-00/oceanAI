'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Formatted from './components/Formatted';
import ProposalPanel from './components/ProposalPanel';
import { IconClose, IconHistory, IconPlus, IconSend, IconSettings } from './components/nav';
import { api, redirectToLogin, SessionExpiredError } from '@/lib/client';
import { MODE_LABEL } from '@/lib/types';
import type { Customer, Message, Mode, PublicUser, Session, UpdateProposal } from '@/lib/types';

interface SessionSummary extends Omit<Session, 'messages'> {
  messageCount: number;
}

interface Bootstrap {
  user: PublicUser;
  users: PublicUser[];
  customers: Customer[];
  sessions: SessionSummary[];
  pendingProposals: UpdateProposal[];
  hasApiKey: boolean;
}

/**
 * 入力の手間を減らすための定型文。
 *
 * それだけで質問として成立するものは、押したらそのまま送る（needsInput: false）。
 * アポメモの貼り付けが前提のものは入力欄に流し込んで続きを書いてもらう。
 * 全部を「入力欄に入れるだけ」にすると、押しても何も起きないように見える。
 */
const QUICK_PROMPTS = [
  {
    label: 'アポ前の準備',
    needsInput: false,
    text: '明日のアポ前の準備をしたいです。今回の目的、優先して聞くべき質問、想定される反論と返し方、着地点を整理してください。',
  },
  {
    label: 'アポの振り返り',
    needsInput: true,
    text: '今日のアポの振り返りをお願いします。アポメモは以下です。\n\n',
  },
  {
    label: '案件が止まった',
    needsInput: true,
    text: '案件が止まっています。状況は以下です。原因の可能性と、次に確認すべきことを整理してください。\n\n',
  },
  {
    label: '営業傾向を確認',
    needsInput: false,
    text: 'これまでの記録から、私の営業傾向、強み、繰り返している癖、次に試すべき行動を教えてください。',
  },
];

const DIFFICULTIES = ['易しい', '標準', '難しい'] as const;

/** モバイルで開いている副パネル。PCでは常時表示なので使わない。 */
type Pane = 'none' | 'list' | 'side';

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
  const [pane, setPane] = useState<Pane>('none');
  const [roleplay, setRoleplay] = useState({
    product: '',
    persona: '',
    stage: '初回アポ',
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

  // 他画面（アポ記録など）からの引き継ぎ入力を取り込む。
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

  // 入力量に応じて高さを変える。スマートフォンでは画面の4割までに抑える。
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, window.innerHeight * 0.4)}px`;
  }, [input]);

  // シートを開いている間は背面をスクロールさせない。Escキーで閉じられるようにする。
  useEffect(() => {
    if (pane === 'none') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPane('none');
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [pane]);

  const openSession = async (id: string) => {
    setError('');
    setProposal(null);
    setPane('none');
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
    setPane('none');
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

      if (response.status === 401) {
        // この経路は api() を通らない生の fetch なので、401を自前で拾う。
        redirectToLogin();
        throw new SessionExpiredError();
      }

      if (!response.ok || !response.body) {
        const detail = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? '応答を取得できませんでした。');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answer = '';
      let finished: { sessionId: string; proposalId?: string; truncated?: boolean } | null = null;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: 'start' | 'ping' }
            | { type: 'delta'; text: string }
            | { type: 'done'; sessionId: string; proposalId?: string; truncated?: boolean }
            | { type: 'error'; message: string };
          if (event.type === 'delta') {
            answer += event.text;
            setStreaming(answer);
          } else if (event.type === 'error') {
            throw new Error(event.message);
          } else if (event.type === 'done') {
            finished = {
              sessionId: event.sessionId,
              proposalId: event.proposalId,
              truncated: event.truncated,
            };
          }
          // start / ping は接続を保つためだけのもの。知らない種類は無視する。
        }
      }

      setStreaming('');

      // done が来ないままストリームが終わった＝最後まで届いていない。
      // サーバーは done を出す前に保存するので、この回答はサーバーにも残っていない。
      // 黙って画面にだけ残すと、再読込で消える回答や空の吹き出しができてしまう。
      if (!finished) {
        if (answer.trim()) {
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              role: 'assistant',
              content: answer,
              createdAt: new Date().toISOString(),
            },
          ]);
          setError(
            '回答が最後まで届きませんでした（途中で接続が切れています）。この回答は保存されていません。もう一度お試しください。',
          );
        } else {
          setError(
            '回答が届きませんでした。時間がかかりすぎて接続が切れた可能性があります。対象を絞って聞き直すか、しばらく待ってからお試しください。',
          );
        }
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: answer,
          createdAt: new Date().toISOString(),
        },
      ]);

      setSessionId(finished.sessionId);
      // 出力の上限に当たった回答は途中で切れており、保存候補も出ていない。
      // 完成した回答のように見せない。
      if (finished.truncated) {
        setError(
          '回答が長くなりすぎて途中で切れました。対象を絞って聞き直すか、アポメモを分割してお試しください。',
        );
      }
      const bootstrap = await reload();
      const proposalId = finished.proposalId;
      if (proposalId) {
        setProposal(bootstrap.pendingProposals.find((p) => p.id === proposalId) ?? null);
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
      setError('ロールプレイを始める前に、商材とクライアント像を入力してください。');
      return;
    }
    setRoleplayActive(true);
    setShowRoleplayForm(false);
    setPane('none');
    setMode('F');
    await send('ロールプレイを開始します。クライアント役として最初の一言をお願いします。', {
      action: 'start',
      config: roleplay,
    });
  };

  /** ロープレモードへ。設定が済んでいなければ設定カードを出す。 */
  const openRoleplay = () => {
    if (roleplayActive) return;
    setPane('none');
    setShowRoleplayForm(true);
    setError('');
  };

  /** 対話モードへ。ロープレ中なら終了して講評させる。 */
  const backToTalk = () => {
    setShowRoleplayForm(false);
    setError('');
    if (roleplayActive) void endRoleplay();
  };

  const endRoleplay = async () => {
    setRoleplayActive(false);
    await send('', { action: 'end' });
  };

  const selectedCustomer = useMemo(
    () => data?.customers.find((c) => c.id === customerId),
    [data, customerId],
  );

  const useQuickPrompt = (prompt: (typeof QUICK_PROMPTS)[number]) => {
    if (prompt.needsInput) {
      // アポメモを貼ってもらう必要があるので、入力欄に入れて続きを書いてもらう。
      setInput(prompt.text);
      textareaRef.current?.focus();
      return;
    }
    // それだけで質問として成立するものは、押したらそのまま送る。
    void send(prompt.text);
  };

  return (
    <div className="chat">
      {/* モバイル専用の操作バー。履歴と設定をシートで開く。 */}
      <div className="chat-toolbar mobile-only">
        <button
          type="button"
          className="btn-icon"
          aria-label="これまでの相談"
          onClick={() => setPane(pane === 'list' ? 'none' : 'list')}
        >
          <IconHistory />
        </button>
        <span className="chat-toolbar-context">
          {roleplayActive
            ? 'ロールプレイ中'
            : selectedCustomer
              ? selectedCustomer.displayName
              : 'クライアント未選択'}
        </span>
        <button
          type="button"
          className="btn-icon"
          aria-label="新しい相談"
          onClick={newSession}
        >
          <IconPlus />
        </button>
        <button
          type="button"
          className="btn-icon"
          aria-label="この相談の設定"
          onClick={() => setPane(pane === 'side' ? 'none' : 'side')}
        >
          <IconSettings />
        </button>
      </div>

      {/* シートを開いている間の背景。PCでは表示しない。 */}
      {pane !== 'none' && (
        <div className="sheet-backdrop mobile-only" onClick={() => setPane('none')} />
      )}

      {/* 会話一覧 */}
      <div className="chat-pane chat-pane-list" data-open={pane === 'list'}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2 className="sheet-title mobile-only">これまでの相談</h2>
          <button
            type="button"
            className="btn-icon sheet-close mobile-only"
            aria-label="閉じる"
            onClick={() => setPane('none')}
          >
            <IconClose />
          </button>
        </div>

        <button type="button" className="btn-primary btn-block" onClick={newSession}>
          ＋ 新しい相談
        </button>

        <div className="nav-label desktop-only" style={{ marginTop: 16 }}>
          これまでの相談
        </div>

        {data?.sessions.length === 0 && (
          <div className="faint" style={{ padding: '10px 2px' }}>
            まだ相談はありません
          </div>
        )}

        {data?.sessions.map((session) => (
          <div
            key={session.id}
            className="session-item"
            data-active={session.id === sessionId}
            role="button"
            tabIndex={0}
            onClick={() => openSession(session.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void openSession(session.id);
              }
            }}
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
        {/* 対話とロープレの切り替え。
            以前はロールプレイが設定シートの奥にあり、存在に気づけなかった。
            この相談で何をしているのかが一目で分かるよう、本体の上に置く。 */}
        <div className="chat-modes" role="group" aria-label="モードの切り替え">
          <button
            type="button"
            className="chat-mode"
            data-active={!roleplayActive}
            disabled={busy}
            onClick={backToTalk}
          >
            対話モード
          </button>
          <button
            type="button"
            className="chat-mode"
            data-active={roleplayActive}
            disabled={busy}
            onClick={openRoleplay}
          >
            ロープレモード
          </button>
        </div>
        <div className="chat-scroll" ref={scrollRef}>
          <div className="chat-inner">
            {data && !data.hasApiKey && (
              <div className="alert alert-warn">
                ANTHROPIC_API_KEY が未設定です。設定するとAIコーチとの相談が使えます。
              </div>
            )}

            {showRoleplayForm && !roleplayActive && (
              <div className="card" style={{ borderColor: 'var(--accent)' }}>
                <h2 className="card-title">ロープレの設定</h2>
                <p className="muted" style={{ margin: '0 0 12px' }}>
                  ここで設定した内容でAIがクライアント役になります。開始後は指導せず、
                  クライアントとして受け答えします。対話モードに戻すと講評します。
                </p>
                <div className="stack">
                  <label className="field">
                    <span>商材</span>
                    <input
                      value={roleplay.product}
                      onChange={(e) => setRoleplay({ ...roleplay, product: e.target.value })}
                      placeholder="例：個人向けの家計相談サービス"
                    />
                  </label>
                  <label className="field">
                    <span>クライアント像</span>
                    <input
                      value={roleplay.persona}
                      onChange={(e) => setRoleplay({ ...roleplay, persona: e.target.value })}
                      placeholder="例：30代・共働き・小学生の子ども2人"
                    />
                  </label>
                  <label className="field">
                    <span>アポの段階</span>
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
                        setRoleplay({
                          ...roleplay,
                          difficulty: e.target.value as (typeof DIFFICULTIES)[number],
                        })
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
                      placeholder="例：金額の不安への対応"
                    />
                  </label>
                  <div className="page-actions" style={{ marginTop: 0 }}>
                    <button type="button" className="btn-primary" onClick={startRoleplay} disabled={busy}>
                      この設定で始める
                    </button>
                    <button type="button" onClick={() => setShowRoleplayForm(false)} disabled={busy}>
                      やめる
                    </button>
                  </div>
                </div>
              </div>
            )}

            {messages.length === 0 && !streaming && (
              <div className="card">
                <h2 className="card-title">何を手伝いましょうか</h2>
                <p className="muted" style={{ margin: '0 0 12px' }}>
                  アポメモや文字起こしを貼り付ければ振り返りを、これからのアポなら準備を支援します。
                  目的が決まっていない場合はそのまま相談してください。
                </p>
                <div className="chips">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.label}
                      type="button"
                      className="btn-sm"
                      disabled={busy}
                      onClick={() => useQuickPrompt(prompt)}
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
                  <div className="msg-role">AIコーチ{roleplayActive ? '（クライアント役）' : ''}</div>
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
                    // 新規作成されたクライアントを会話の対象にする。
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
              <div className="spread">
                <span className="badge badge-rep">ロールプレイ中：AIはクライアント役</span>
                <button type="button" className="btn-sm" onClick={endRoleplay} disabled={busy}>
                  終了して講評
                </button>
              </div>
            )}

            <div className="composer-row">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                placeholder={roleplayActive ? 'クライアントへの発言を入力' : 'アポメモ・相談内容を入力'}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  // PCのキーボード向けのショートカット。スマートフォンでは改行のまま。
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void send(input);
                  }
                }}
              />
              <button
                type="button"
                className="btn-primary composer-send"
                aria-label="送信"
                disabled={busy || !input.trim()}
                onClick={() => void send(input)}
              >
                <IconSend />
              </button>
            </div>

            <div className="composer-meta desktop-only">
              <span className="faint">
                {selectedCustomer ? `対象クライアント：${selectedCustomer.displayName}` : 'クライアント未選択'}
              </span>
              <span className="faint">Ctrl+Enter で送信</span>
            </div>
          </div>
        </div>
      </div>

      {/* 設定パネル */}
      <div className="chat-pane chat-pane-side" data-open={pane === 'side'}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <h2 className="sheet-title mobile-only">この相談の設定</h2>
          <button
            type="button"
            className="btn-icon sheet-close mobile-only"
            aria-label="閉じる"
            onClick={() => setPane('none')}
          >
            <IconClose />
          </button>
        </div>

        <div className="nav-label desktop-only">この相談の設定</div>

        <label className="field" style={{ marginBottom: 12 }}>
          <span>対象クライアント</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">選択しない</option>
            {data?.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="field" style={{ marginBottom: 12 }}>
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
