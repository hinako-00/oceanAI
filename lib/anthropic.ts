import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/** 既定モデル。環境変数 ANTHROPIC_MODEL で上書きできる。 */
const DEFAULT_MODEL = 'claude-opus-5';

/**
 * 出力の上限。
 *
 * 「商談後の標準出力」は9セクションあり、日本語で丁寧に書くと1万トークンを超える。
 * 上限に当たると本文が途中で切れるだけでなく、保存候補のツール呼び出しまで
 * 到達せずに打ち切られるため、余裕を大きく取る。
 * 応答は常にストリーミングで受け取るので、大きな値にしてもHTTPタイムアウトの心配はない。
 * 実際の課金は生成されたトークン数に対して発生するため、上限を上げても
 * 短い回答が高くなることはない。
 */
const DEFAULT_MAX_TOKENS = 64000;

export class MissingApiKeyError extends Error {
  constructor() {
    super('ANTHROPIC_API_KEY が設定されていません。.env.local に追加してください。');
    this.name = 'MissingApiKeyError';
  }
}

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export function getModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

export function getMaxTokens(): number {
  const raw = Number(process.env.ANTHROPIC_MAX_TOKENS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_TOKENS;
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * システムプロンプトを複数ブロックで渡す。
 *
 * キャッシュは前方一致なので、1バイトでも変わるとそれ以降が全部無効になる。
 * 呼び出し側は「毎回同じもの」を先に、「会話ごと・ターンごとに変わるもの」を後ろに置き、
 * 安定した部分の末尾に cache=true を付けること。
 */
export function buildSystem(blocks: Array<{ text: string; cache?: boolean }>) {
  return blocks
    .filter((block) => block.text.trim().length > 0)
    .map((block) => ({
      type: 'text' as const,
      text: block.text,
      ...(block.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
    }));
}
