import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveStorageDriver } from '../lib/storage-driver';

test('NETLIFY環境変数が立っていればBlobsを使う', () => {
  assert.equal(resolveStorageDriver({ NETLIFY: 'true' }), 'blobs');
});

test('NETLIFY環境変数がなければファイルを使う（自前サーバー・Docker運用）', () => {
  assert.equal(resolveStorageDriver({}), 'file');
});

test('STORAGE_DRIVER を明示すればNETLIFYより優先される', () => {
  assert.equal(resolveStorageDriver({ NETLIFY: 'true', STORAGE_DRIVER: 'file' }), 'file');
  assert.equal(resolveStorageDriver({ STORAGE_DRIVER: 'blobs' }), 'blobs');
});

test('NETLIFY変数が実行時に来ない場合でも、AWS Lambdaのランタイム変数からサーバーレス実行を検知する', () => {
  // Netlify Functionsの実際の関数実行時には process.env.NETLIFY が乗らないことがある
  // （これでEROFS: read-only file systemの障害を一度起こしている）。
  // Lambda自身が注入する変数はNetlify側の設定漏れに影響されないため、これで補う。
  assert.equal(resolveStorageDriver({ AWS_LAMBDA_FUNCTION_NAME: 'nextjs-server' }), 'blobs');
  assert.equal(resolveStorageDriver({ LAMBDA_TASK_ROOT: '/var/task' }), 'blobs');
});
