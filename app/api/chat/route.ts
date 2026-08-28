import { NextResponse } from 'next/server';

import { buildSystem, getClient, getMaxTokens, getModel, MissingApiKeyError } from '@/lib/anthropic';
import { handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { buildContextBlock } from '@/lib/context';
import { detectMode, effortFor, makeTitle } from '@/lib/mode';
import { modeHint, OUTPUT_CONTRACT, ROLEPLAY_FEEDBACK_PROMPT, roleplayOverride, SYSTEM_PROMPT } from '@/lib/prompt';
import { parseProposal, SAVE_PROPOSAL_TOOL } from '@/lib/proposal';
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

  const inRoleplay = Boolean(roleplay?.active);
  const endingRoleplay = body.roleplay?.action === 'end';

  // --- 今回のモード ---
  // モードはシステムプロンプトの指示と推論の深さを決めるので、セッション作成時の
  // 一度きりの推定を使い回さない。担当者が画面で明示的に選んでいればそれを尊重し、
  // 「自動判定」のままなら毎ターン入力から推定し直す。
  // こうしないと、準備の相談で始めた会話に途中で文字起こしを貼っても
  // 「商談前の準備をしています」という古い指示が残り続ける。
  let turnMode: Mode | null;
  if (inRoleplay || body.roleplay?.action === 'start') {
    turnMode = 'F';
  } else if (body.mode) {
    turnMode = body.mode;
  } else if (endingRoleplay) {
    turnMode = 'F';
  } else {
    turnMode = detectMode(userText);
  }
  if (turnMode !== session.mode) {
    session = (await updateSession(session.id, { mode: turnMode })) ?? session;
  }

  // --- 参照情報の組み立て ---
  const customerId = session.customerId;
  const [customer, meetings, knowledge, nextActions] = await Promise.all([
    customerId ? getCustomer(customerId) : Promise.resolve(undefined),
    customerId ? listMeetings(customerId) : Promise.resolve([]),
    listKnowledge(),
    listNextActions(rep.id),
  ]);

  const contextBlock = buildContextBlock({ rep, customer, meetings, knowledge, nextActions });

  // ブロックは「毎回同じもの → 会話ごとに変わるもの → ターンごとに変わるもの」の順に並べる。
  // キャッシュは前方一致なので、揮発するものを先に置くと後ろが全部無効になる。
  // 参照情報（カルテ・文字起こし・自社知識）が一番大きいので、ここまでをキャッシュに載せる。
  const system = buildSystem([
    { text: SYSTEM_PROMPT, cache: true },
    // ロールプレイ中は保存候補を出させない（顧客役に徹させるため）。
    { text: inRoleplay ? '' : OUTPUT_CONTRACT },
    { text: contextBlock, cache: true },
    { text: modeHint(turnMode) },
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
      let answer = '';
      let emitted = 0;

      // 閉じたあとの enqueue は例外になるので、送信は必ずここを通す。
      let closed = false;
      const send = (event: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encodeEvent(event));
        } catch {
          // 利用者が画面を離れて接続が切れた場合。以降は送らない。
          closed = true;
        }
      };

      // 最初の1バイトをすぐ流す。
      // 推論に時間がかかると最初のトークンまで数十秒かかることがあり、その間ずっと
      // 無音だと、間に入るプロキシや実行基盤が「応答がない」と判断して接続を切る。
      // 切られると done が届かず、画面には空の吹き出しだけが残る。
      send({ type: 'start' });
      const keepAlive = setInterval(() => send({ type: 'ping' }), 5000);

      try {
        const response = client.messages.stream({
          model: getModel(),
          max_tokens: getMaxTokens(),
          // モデルに考える深さを自分で決めさせる。ANTHROPIC_MODEL を Opus 4.8 などに
          // 変えたときも思考が切れないよう、既定に頼らず明示する。
          thinking: { type: 'adaptive' },
          output_config: { effort: effortFor(turnMode) },
          system,
          // ロールプレイ中は顧客役に徹させるため、保存候補のツールを渡さない。
          ...(inRoleplay ? {} : { tools: [SAVE_PROPOSAL_TOOL] }),
          messages,
        });

        response.on('text', (delta) => {
          answer += delta;
          if (answer.length > emitted) {
            send({ type: 'delta', text: answer.slice(emitted) });
            emitted = answer.length;
          }
        });

        const final = await response.finalMessage();

        // 安全側の停止理由を素通りさせない。
        // refusal は HTTP 200 で返るため、見ていないと空の回答がそのまま履歴に残り、
        // 以降のターンの文脈を汚し続ける。
        if (final.stop_reason === 'refusal') {
          send({
            type: 'error',
            message:
              'この内容には回答できませんでした。表現を変えるか、扱う情報を絞って試してください。（この発言は履歴に残していません）',
          });
          return;
        }

        // 出力上限に当たった場合、本文は途中で切れており保存候補も出ていない。
        // 黙って完成品のように見せない。
        const truncated = final.stop_reason === 'max_tokens';

        // 保存候補はツール呼び出しで受け取る。本文の長さに左右されず、
        // スキーマ違反も起きない。
        const toolUse = final.content.find(
          (block): block is Extract<typeof block, { type: 'tool_use' }> =>
            block.type === 'tool_use' && block.name === SAVE_PROPOSAL_TOOL.name,
        );
        const update = toolUse ? parseProposal(toolUse.input) : undefined;

        const body = answer.trim();
        if (!body && !update) {
          send({ type: 'error', message: '回答が空でした。もう一度お試しください。' });
          return;
        }

        // 本文を書かずにツールだけ呼んだ場合でも、空の発言を履歴に残さない。
        // 空のまま保存すると、以降のターンでモデルが「自分は何も答えなかった」と読む。
        const assistantMessage = makeMessage(
          'assistant',
          body || '保存候補をまとめました。内容を確認してください。',
        );
        await appendMessages(sessionId, [userMessage, assistantMessage]);

        let proposalId: string | undefined;
        if (update) {
          const proposal = await saveProposal(sessionId, repId, update);
          proposalId = proposal.id;
        }

        send({
          type: 'done',
          sessionId,
          messageId: assistantMessage.id,
          proposalId,
          hasUpdate: Boolean(update),
          truncated,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : '応答の生成に失敗しました。';
        send({ type: 'error', message });
      } finally {
        clearInterval(keepAlive);
        closed = true;
        try {
          controller.close();
        } catch {
          // 接続が先に切れている場合は何もしない。
        }
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
