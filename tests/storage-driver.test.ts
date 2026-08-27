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
