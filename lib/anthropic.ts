import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/** 既定モデル。環境変数 ANTHROPIC_MODEL で上書きできる。 */
const DEFAULT_MODEL = 'claude-opus-5';
const DEFAULT_MAX_TOKENS = 8000;

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
 * 先頭の固定ブロックに cache_control を付け、会話ごとに変わる参照情報は後ろに置く。
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
