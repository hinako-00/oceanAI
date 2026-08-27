import { NextResponse } from 'next/server';

import { buildSystem, getClient, getMaxTokens, getModel, MissingApiKeyError } from '@/lib/anthropic';
import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { buildContextBlock } from '@/lib/context';
import { extractUpdate, stripPartialBlock } from '@/lib/extract';
import { detectMode, makeTitle } from '@/lib/mode';
import { modeHint, OUTPUT_CONTRACT, ROLEPLAY_FEEDBACK_PROMPT, roleplayOverride, SYSTEM_PROMPT } from '@/lib/prompt';
import {
  appendMessages,
  createSession,
  getCustomer,
  getSession,
  listKnowledge,
  listMeetings,
  listNextActions,
  makeMessage,
  saveProposal,
  updateSession,
} from '@/lib/repo';
import type { Mode, RoleplayConfig } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatRequest {
  sessionId?: string;
  customerId?: string;
  mode?: Mode | null;
  message: string;
  /** ロールプレイの開始・終了操作。 */
  roleplay?: { action: 'start'; config: Omit<RoleplayConfig, 'active'> } | { action: 'end' };
}

function encodeEvent(event: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

export async function POST(request: Request) {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json({ error: 'リクエストの形式が不正です。' }, { status: 400 });
  }

  const userText = (body.message ?? '').trim();
  const roleplayAction = body.roleplay?.action;
  if (!userText && roleplayAction !== 'end') {
    return NextResponse.json({ error: 'メッセージが空です。' }, { status: 400 });
  }

  let rep;
  try {
    rep = await requireUser();
  } catch (err) {
    return handleError(err);
  }

  let client;
  try {
    client = getClient();
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    throw err;
  }

  // --- セッションの解決 ---
  // 他のメンバーの相談は開けない。IDを直接指定されても自分のものだけを扱う。
  const requested = body.sessionId ? await getSession(body.sessionId) : undefined;
  let session = requested && requested.repId === rep.id ? requested : undefined;
  if (!session) {
    session = await createSession({
      repId: rep.id,
      customerId: body.customerId,
      mode: body.mode ?? detectMode(userText),
      title: makeTitle(userText || 'ロールプレイ'),
    });
  }

  // --- ロールプレイ状態の更新 ---
  let roleplay = session.roleplay;
  if (body.roleplay?.action === 'start') {
    roleplay = { ...body.roleplay.config, active: true };
    session = (await updateSession(session.id, { roleplay, mode: 'F' })) ?? session;
  } else if (body.roleplay?.action === 'end' && roleplay) {
    roleplay = { ...roleplay, active: false };
    session = (await updateSession(session.id, { roleplay })) ?? session;
  }
  if (body.customerId && body.customerId !== session.customerId) {
    session = (await updateSession(session.id, { customerId: body.customerId })) ?? session;
  }
  if (body.mode && body.mode !== session.mode && body.roleplay?.action !== 'start') {
    session = (await updateSession(session.id, { mode: body.mode })) ?? session;
  }

  const inRoleplay = Boolean(roleplay?.active);
  const endingRoleplay = body.roleplay?.action === 'end';

  // --- 参照情報の組み立て ---
  const customerId = session.customerId;
  const [customer, meetings, knowledge, nextActions] = await Promise.all([
    customerId ? getCustomer(customerId) : Promise.resolve(undefined),
    customerId ? listMeetings(customerId) : Promise.resolve([]),
    listKnowledge(),
    listNextActions(rep.id),
  ]);

  const contextBlock = buildContextBlock({ rep, customer, meetings, knowledge, nextActions });

  const system = buildSystem([
    { text: SYSTEM_PROMPT, cache: true },
    // ロールプレイ中は保存候補を出させない（顧客役に徹させるため）。
    { text: inRoleplay ? '' : OUTPUT_CONTRACT, cache: true },
    { text: modeHint(session.mode) },
    { text: contextBlock },
    { text: inRoleplay && roleplay ? roleplayOverride(roleplay) : '' },
    { text: endingRoleplay ? ROLEPLAY_FEEDBACK_PROMPT : '' },
  ]);

  const outgoingText = endingRoleplay && !userText ? 'ロールプレイを終了します。' : userText;
  const userMessage = makeMessage('user', outgoingText);

  const history = session.messages.map((m) => ({ role: m.role, content: m.content }));
  const messages = [...history, { role: 'user' as const, content: outgoingText }];

  const sessionId = session.id;
  const repId = rep.id;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = '';
      let emitted = 0;
      try {
        const response = client.messages.stream({
          model: getModel(),
          max_tokens: getMaxTokens(),
          system,
          messages,
        });

        response.on('text', (delta) => {
          full += delta;
          // 保存候補ブロックは画面に出さない。未完成の途中経過も隠す。
          const visible = stripPartialBlock(full);
          if (visible.length > emitted) {
            controller.enqueue(encodeEvent({ type: 'delta', text: visible.slice(emitted) }));
            emitted = visible.length;
          }
        });

        await response.finalMessage();

        const { body: answer, update } = extractUpdate(full);
        const assistantMessage = makeMessage('assistant', answer);
        await appendMessages(sessionId, [userMessage, assistantMessage]);

        let proposalId: string | undefined;
        if (update) {
          const proposal = await saveProposal(sessionId, repId, update);
          proposalId = proposal.id;
        }

        controller.enqueue(
          encodeEvent({
            type: 'done',
            sessionId,
            messageId: assistantMessage.id,
            proposalId,
            hasUpdate: Boolean(update),
          }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : '応答の生成に失敗しました。';
        controller.enqueue(encodeEvent({ type: 'error', message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Session-Id': sessionId,
    },
  });
}
