import Anthropic from '@anthropic-ai/sdk';
import type { APIError } from '@anthropic-ai/sdk';

/**
 * Anthropic APIのエラーを、営業担当者が読んで次の行動が分かる日本語にする。
 *
 * SDKの例外をそのまま画面に出すと、英語のJSONがそのまま表示される。
 * 実際に「Your credit balance is too low to access the Anthropic API...」という
 * 生の応答が担当者の画面に出た。何が起きたのか、誰に何を頼めばいいのかが伝わらない。
 *
 * 判定は型（SDKの例外クラス）を優先し、型で区別できないものだけ文言を見る。
 */

/** クレジット残高・請求まわりの問題か。 */
function isBillingProblem(err: APIError): boolean {
  if (err.type === 'billing_error') return true;
  // Anthropicはクレジット不足を invalid_request_error として返すことがあり、
  // 型だけでは請求の問題だと判別できない。実際に観測した文言で補う。
  return /credit balance|billing|quota/i.test(err.message ?? '');
}

export function describeApiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return 'AIコーチに接続できませんでした。APIキーが正しくないか、無効になっています。社内の管理者に確認を依頼してください。';
  }

  if (err instanceof Anthropic.PermissionDeniedError) {
    return 'AIコーチの利用が許可されていません。APIキーの権限を社内の管理者に確認してください。';
  }

  if (err instanceof Anthropic.RateLimitError) {
    return 'リクエストが集中しています。1分ほど待ってから、もう一度お試しください。';
  }

  if (err instanceof Anthropic.BadRequestError) {
    if (isBillingProblem(err)) {
      return 'AnthropicアカウントのAPIクレジット残高が不足しているため、AIコーチを利用できません。社内の管理者に、Anthropic Console の Plans & Billing からクレジットの購入を依頼してください。（他の機能は通常どおり使えます）';
    }
    return 'AIコーチへのリクエストが受け付けられませんでした。入力を短くして試しても直らない場合は、社内の管理者に連絡してください。';
  }

  // 500系・529（混雑）はSDKが InternalServerError にまとめる。
  if (err instanceof Anthropic.InternalServerError) {
    return 'AIコーチ側で一時的な障害が起きています。しばらく待ってから、もう一度お試しください。';
  }

  if (err instanceof Anthropic.APIConnectionError) {
    return 'AIコーチに接続できませんでした。通信環境を確認して、もう一度お試しください。';
  }

  if (err instanceof Anthropic.APIError) {
    return 'AIコーチとの通信に失敗しました。しばらく待ってから、もう一度お試しください。';
  }

  // Anthropic由来でないエラー（保存の失敗など）は、元の文言のほうが手掛かりになる。
  return err instanceof Error && err.message ? err.message : '応答の生成に失敗しました。';
}

/**
 * 管理者が原因を追えるように、サーバーのログへ原文を残す。
 * 画面には出さない情報（リクエストID・ステータス）をここに含める。
 */
export function logApiError(context: string, err: unknown): void {
  if (err instanceof Anthropic.APIError) {
    console.error(`[${context}] Anthropic APIエラー`, {
      status: err.status,
      type: err.type,
      requestID: err.requestID,
      message: err.message,
    });
    return;
  }
  console.error(`[${context}] エラー`, err);
}
