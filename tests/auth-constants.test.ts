import assert from 'node:assert/strict';
import test from 'node:test';

import { isPublicPath, isSafeNextPath, loginPath } from '../lib/auth-constants';

test('公開パスだけがログインなしで通る', () => {
  assert.equal(isPublicPath('/login'), true);
  assert.equal(isPublicPath('/setup'), true);
  assert.equal(isPublicPath('/api/auth/login'), true);
  assert.equal(isPublicPath('/api/health'), true);
  assert.equal(isPublicPath('/'), false);
  assert.equal(isPublicPath('/customers'), false);
  assert.equal(isPublicPath('/api/chat'), false);
  // 前方一致で通してしまわないこと（/loginer のような別パスを公開にしない）。
  assert.equal(isPublicPath('/loginer'), false);
  assert.equal(isPublicPath('/setups'), false);
});

test('外部サイトへの遷移を戻り先にしない', () => {
  assert.equal(isSafeNextPath('/customers'), true);
  // 「/」で始まるがブラウザは外部サイトへ飛ばす。
  assert.equal(isSafeNextPath('//example.com'), false);
  assert.equal(isSafeNextPath('https://example.com'), false);
  assert.equal(isSafeNextPath(''), false);
  assert.equal(isSafeNextPath(null), false);
});

test('ログインURLに戻り先とセッション切れの理由を載せる', () => {
  assert.equal(loginPath('/customers/abc'), '/login?next=%2Fcustomers%2Fabc');
  assert.equal(
    loginPath('/actions', true),
    '/login?next=%2Factions&expired=1',
  );
  assert.equal(loginPath(null, true), '/login?expired=1');
  assert.equal(loginPath(), '/login');
});

test('ログイン画面自身を戻り先にしない（堂々巡りを防ぐ）', () => {
  // ここで /login を next に入れると、ログイン後にまたログイン画面へ戻ってしまう。
  assert.equal(loginPath('/login', true), '/login?expired=1');
  assert.equal(loginPath('/login?next=%2F', true), '/login?expired=1');
  assert.equal(loginPath('/setup'), '/login');
  // 外部URLも落とす。
  assert.equal(loginPath('//example.com', true), '/login?expired=1');
});
