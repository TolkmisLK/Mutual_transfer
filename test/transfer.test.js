import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { Store, CHUNK } from '../src/store.js';
import { createServer, byteRange } from '../src/server.js';

async function temp(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-transfer-'));
  t.after(() => fs.rm(root, { recursive: true, force: true })); return root;
}
test('resume after restart preserves bytes and SHA-256', async t => {
  const root = await temp(t); let store = await new Store(root).init();
  const item = await store.create({ name: 'photo & 工作.bin', size: 6 });
  await store.append(item.id, 0, Buffer.from([0, 255, 128]));
  store = await new Store(root).init(); assert.equal(store.get(item.id).offset, 3);
  await store.append(item.id, 3, Buffer.from([1, 2, 3]));
  const result = await store.finish(item.id); const bytes = Buffer.from([0, 255, 128, 1, 2, 3]);
  assert.deepEqual(await fs.readFile(store.file(item.id)), bytes);
  assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.deepEqual(await store.finish(item.id), result);
});
test('crash recovery discards bytes beyond the persisted checkpoint', async t => {
  const root = await temp(t); const store = await new Store(root).init(); const item = await store.create({ name: 'x', size: 10 });
  await store.append(item.id, 0, Buffer.from('hello'));
  await fs.appendFile(store.file(item.id), 'bad');
  const recovered = await new Store(root).init();
  assert.equal((await fs.stat(recovered.file(item.id))).size, 5);
});
test('stale offsets, oversize chunks and incomplete finish are rejected', async t => {
  const store = await new Store(await temp(t)).init(); const item = await store.create({ name: 'x', size: CHUNK * 2 });
  await assert.rejects(store.append(item.id, 1, Buffer.from('a')), { status: 409 });
  await assert.rejects(store.append(item.id, 0, Buffer.alloc(CHUNK + 1)), { status: 400 });
  await assert.rejects(store.finish(item.id), { status: 409 });
});
test('parallel creates cannot overbook quota; deletion releases reservation', async t => {
  const store = await new Store(await temp(t), { quota: 10 }).init();
  const results = await Promise.allSettled([store.create({ name: 'a', size: 8 }), store.create({ name: 'b', size: 8 })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const item = [...store.items.values()][0]; await store.remove(item.id);
  assert.equal((await store.create({ name: 'c', size: 10 })).size, 10);
});
test('parallel writes serialize without duplicating content', async t => {
  const store = await new Store(await temp(t)).init(); const item = await store.create({ name: 'x', size: 6 });
  const results = await Promise.allSettled([store.append(item.id, 0, Buffer.from('abc')), store.append(item.id, 0, Buffer.from('xyz'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(store.get(item.id).offset, 3);
});
test('rejects path separators and unsafe sizes; empty files complete', async t => {
  const store = await new Store(await temp(t)).init();
  for (const name of ['../x', 'C:\\x', 'x\nheader']) await assert.rejects(store.create({ name, size: 0 }), { status: 400 });
  for (const size of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(store.create({ name: 'x', size }), { status: 400 });
  const item = await store.create({ name: 'empty', size: 0 }); assert.equal((await store.finish(item.id)).complete, true);
});
test('ranges include suffix and >4 GiB offsets without 32-bit truncation', () => {
  assert.deepEqual(byteRange('bytes=-3', 10), { start: 7, end: 9, partial: true });
  assert.equal(byteRange('bytes=4294967296-', 5 * 1024 ** 3).start, 4294967296);
  for (const h of ['bytes=10-', 'bytes=3-2', 'bytes=-0', 'bytes=1-2,3-4']) assert.throws(() => byteRange(h, 10), { status: 416 });
});
async function running(t) {
  const key = 'test-workspace-key-with-enough-entropy';
  const instance = await createServer({ root: await temp(t), key });
  await new Promise(resolve => instance.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { instance.server.closeAllConnections(); await new Promise(resolve => instance.server.close(resolve)); });
  const base = `http://127.0.0.1:${instance.server.address().port}`;
  const login = await fetch(`${base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const call = (p, options = {}) => fetch(base + p, { ...options, headers: { Cookie: cookie, ...options.headers } });
  return { ...instance, base, cookie, call };
}
test('real HTTP login, upload, completion, range download and logout', async t => {
  const { base, call } = await running(t);
  assert.equal((await fetch(base + '/api/transfers')).status, 401);
  const item = await (await call('/api/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x.txt', size: 5 }) })).json();
  const url = `/api/transfers/${item.id}`;
  assert.equal((await call(url + '/chunk', { method: 'PUT', headers: { 'Upload-Offset': '0' }, body: 'hello' })).status, 200);
  assert.equal((await call(url + '/finish', { method: 'POST' })).status, 200);
  const response = await call(url + '/download', { headers: { Range: 'bytes=1-3' } });
  assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), 'bytes 1-3/5'); assert.equal(await response.text(), 'ell');
  assert.equal((await (await call(url + '/text')).json()).text, 'hello');
  await call('/api/session', { method: 'DELETE' }); assert.equal((await call('/api/transfers')).status, 401);
});
test('HTTP rejects cross-origin writes, unexpected hosts and invalid request bodies', async t => {
  const { call, base } = await running(t);
  assert.equal((await call('/api/transfers', { method: 'POST', headers: { Origin: 'https://evil.example' } })).status, 403);
  const status = await new Promise((resolve, reject) => {
    http.get(base + '/api/transfers', { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode); }).on('error', reject);
  });
  assert.equal(status, 403);
  assert.equal((await call('/api/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null' })).status, 400);
});
test('HTML disguised as an image is never served as an inline preview', async t => {
  const { call } = await running(t); const bytes = '<script>alert(1)</script>';
  const item = await (await call('/api/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x.png', size: bytes.length }) })).json();
  const url = `/api/transfers/${item.id}`;
  await call(url + '/chunk', { method: 'PUT', headers: { 'Upload-Offset': '0' }, body: bytes }); await call(url + '/finish', { method: 'POST' });
  assert.equal((await call(url + '/preview')).status, 415);
  const response = await call(url + '/download'); assert.equal(response.headers.get('content-type'), 'application/octet-stream'); assert.match(response.headers.get('content-disposition'), /^attachment/);
});
