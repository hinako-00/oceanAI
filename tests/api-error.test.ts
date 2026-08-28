import assert from 'node:assert/strict';
import test from 'node:test';
import Anthropic from '@anthropic-ai/sdk';

import { describeApiError } from '../lib/api-error';

/** APIの応答からSDKの例外を組み立てる（本物と同じ経路）。 */
function apiError(status: number, type: string, message: string) {
  return Anthropic.APIError.generate(
    status,
    { type: 'error', error: { type, message } },
    undefined,
    new Headers(),
  );
}

test('クレジット残高不足は、誰に何を頼めばよいか分かる案内にする', () => {
  // 実際に画面へ出てしまった応答そのもの。
  // Anthropic は請求の問題を billing_error ではなく invalid_request_error で返すことがあり、
  // 型だけでは判別できない。
  const err = apiError(
    400,
    'invalid_request_error',
    'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
  );
  const message = describeApiError(err);

  assert.match(message, /クレジット残高が不足/);
  assert.match(message, /Plans & Billing/);
  // 生の英語がそのまま出ないこと。
  assert.doesNotMatch(message, /credit balance is too low/);
});

test('billing_error 型でも同じ案内になる', () => {
  const err = apiError(400, 'billing_error', 'Billing issue.');
  assert.match(describeApiError(err), /クレジット残高が不足/);
});

test('原因ごとに案内を出し分ける', () => {
  assert.match(describeApiError(apiError(401, 'authentication_error', 'invalid x-api-key')), /APIキー/);
  assert.match(describeApiError(apiError(403, 'permission_error', 'forbidden')), /許可されていません/);
  assert.match(describeApiError(apiError(429, 'rate_limit_error', 'rate limited')), /集中しています/);
  assert.match(describeApiError(apiError(500, 'api_error', 'oops')), /一時的な障害/);
  assert.match(describeApiError(apiError(529, 'overloaded_error', 'overloaded')), /一時的な障害/);
});

test('請求以外の400は、別の案内にする（誤って請求の話にしない）', () => {
  const err = apiError(400, 'invalid_request_error', 'tools.0.input_schema: invalid schema');
  const message = describeApiError(err);
  assert.doesNotMatch(message, /クレジット/);
  assert.match(message, /受け付けられませんでした/);
});

test('Anthropic由来でないエラーは元の文言を残す', () => {
  // 保存の失敗などは、こちらの文言のほうが手掛かりになる。
  assert.equal(describeApiError(new Error('保存に失敗しました。')), '保存に失敗しました。');
  assert.equal(describeApiError(undefined), '応答の生成に失敗しました。');
});
