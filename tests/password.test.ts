import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertNotLocked,
  AuthError,
  clearFailures,
  hashPassword,
  MAX_ATTEMPTS,
  normalizeEmail,
  recordFailure,
  validatePassword,
  verifyPassword,
} from '../lib/password';

test('パスワードは平文で保存されず、同じ入力でも毎回別のハッシュになる', async () => {
  const password = 'correct-horse-battery';
  const a = await hashPassword(password);
  const b = await hashPassword(password);
  assert.ok(!a.includes(password));
  assert.notEqual(a, b, 'ソルトが毎回変わること');
  assert.ok(a.startsWith('scrypt$'));
});

test('正しいパスワードだけを受け付ける', async () => {
  const stored = await hashPassword('correct-horse-battery');
  assert.equal(await verifyPassword('correct-horse-battery', stored), true);
  assert.equal(await verifyPassword('correct-horse-batter', stored), false);
  assert.equal(await verifyPassword('', stored), false);
});

test('壊れたハッシュを渡しても例外にせず不一致として扱う', async () => {
  assert.equal(await verifyPassword('x', 'not-a-hash'), false);
  assert.equal(await verifyPassword('x', 'scrypt$onlysalt'), false);
  assert.equal(await verifyPassword('x', ''), false);
});

test('短すぎるパスワードは拒否する', () => {
  assert.throws(() => validatePassword('short'), AuthError);
  assert.doesNotThrow(() => validatePassword('1234567890'));
});

test('メールアドレスは大文字小文字と前後の空白を無視して扱う', () => {
  assert.equal(normalizeEmail('  Yamada@Example.COM '), 'yamada@example.com');
});

test('ログイン失敗が続くと一時的にロックされ、成功で解除される', () => {
  const email = `lock-test-${Date.now()}@example.com`;
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    assert.doesNotThrow(() => assertNotLocked(email), `${i + 1}回目まではロックされない`);
    recordFailure(email);
  }
  assert.throws(() => assertNotLocked(email), AuthError);
  clearFailures(email);
  assert.doesNotThrow(() => assertNotLocked(email));
});
