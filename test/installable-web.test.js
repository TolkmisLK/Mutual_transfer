import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('install manifest is origin-relative and has no credentials or external content', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.id, '/'); assert.equal(manifest.start_url, '/'); assert.equal(manifest.scope, '/'); assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.icons, [{ src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]);
  const icon = await readFile(new URL('../public/app-icon.svg', import.meta.url), 'utf8');
  assert.match(icon, /viewBox="0 0 512 512"/); assert.doesNotMatch(icon, /script|foreignObject|href|onload/i);
});
test('worker only handles the root navigation and never intercepts APIs, files or writes', async () => {
  let handler; let fetches = 0; const response = new Response('online generated fixture');
  const context = { self: { location: { origin: 'https://transfer.example' }, addEventListener: (name, callback) => { assert.equal(name, 'fetch'); handler = callback; } }, URL, Response, fetch: async () => { fetches++; return response; } };
  Object.defineProperty(context, 'caches', { get() { throw new Error('No cache access permitted'); } });
  vm.runInNewContext(await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'), context);
  for (const request of [
    { url: 'https://transfer.example/api/transfers', method: 'GET', mode: 'cors' },
    { url: 'https://transfer.example/api/transfers/file/download', method: 'GET', mode: 'navigate' },
    { url: 'https://transfer.example/', method: 'POST', mode: 'navigate' },
    { url: 'https://foreign.example/', method: 'GET', mode: 'navigate' },
    { url: 'https://transfer.example/?secret=fixture', method: 'GET', mode: 'navigate' },
  ]) handler({ request, respondWith() { assert.fail('Private or non-root request intercepted'); } });
  assert.equal(fetches, 0);
  let result; handler({ request: { url: 'https://transfer.example/', method: 'GET', mode: 'navigate' }, respondWith: value => { result = value; } });
  assert.equal(await result, response); assert.equal(fetches, 1);
});
test('offline root returns only static instructions, never stale authenticated content', async () => {
  let handler; let result;
  const context = { self: { location: { origin: 'https://transfer.example' }, addEventListener: (_name, callback) => { handler = callback; } }, URL, Response, fetch: async () => { throw new Error('offline'); } };
  Object.defineProperty(context, 'caches', { get() { throw new Error('No cache access permitted'); } });
  vm.runInNewContext(await readFile(new URL('../public/service-worker.js', import.meta.url), 'utf8'), context);
  handler({ request: { url: 'https://transfer.example/', method: 'GET', mode: 'navigate' }, respondWith: value => { result = value; } });
  const response = await result; assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
  const html = await response.text(); assert.match(html, /暂时无法连接文件空间/); assert.doesNotMatch(html, /<script|localStorage|indexedDB|mutual_session|api\/transfers/);
});
