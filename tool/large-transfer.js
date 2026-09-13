// Opt-in local acceptance: writes real bytes, not a sparse file. Never touches user data.
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from '../src/server.js';
import { CHUNK } from '../src/store.js';

const total = Number(process.env.LARGE_TEST_BYTES || 5 * 1024 ** 3 + 17);
assert(Number.isSafeInteger(total) && total > CHUNK * 2, 'Use more than two chunks');
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-large-acceptance-'));
const key = randomBytes(32).toString('hex');
let instance; let base; let peakRss = process.memoryUsage().rss;
const start = performance.now();
const monitor = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 20);
const bytes = Buffer.alloc(CHUNK, 71);
function block(offset) {
  bytes.writeBigUInt64LE(BigInt(offset), 0);
  return bytes.subarray(0, Math.min(CHUNK, total - offset));
}
async function open() {
  instance = await createServer({ root, key, quota: total + CHUNK });
  await new Promise(resolve => instance.server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${instance.server.address().port}`;
}
async function close() {
  if (!instance) return;
  instance.server.closeAllConnections();
  await new Promise(resolve => instance.server.close(resolve)); instance = undefined;
}
async function call(route, options = {}) {
  const response = await fetch(base + route, { ...options, headers: { Authorization: `Bearer ${key}`, ...options.headers } });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  return response;
}
try {
  const available = await fs.statfs(root);
  assert(available.bavail * available.bsize > total + 1024 ** 3, 'Need file size plus 1 GiB free disk');
  const source = createHash('sha256');
  for (let offset = 0; offset < total; offset += CHUNK) source.update(block(offset));
  const expectedSha256 = source.digest('hex');
  await open();
  let item = await (await call('/api/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'large-acceptance.bin', size: total, expectedSha256 }) })).json();
  const route = `/api/transfers/${item.id}`;
  const restartOffset = Math.ceil(total / 2 / CHUNK) * CHUNK;
  let restarted = false;
  while (item.offset < total) {
    if (!restarted && item.offset >= restartOffset) {
      const checkpoint = item.offset;
      await close(); await open();
      item = await (await call(route)).json();
      assert.equal(item.offset, checkpoint); assert.equal(item.complete, false); restarted = true;
    }
    const part = block(item.offset);
    item = await (await call(route + '/chunk', { method: 'PUT', headers: { 'Upload-Offset': String(item.offset), 'Upload-Checksum': createHash('sha256').update(part).digest('hex') }, body: part })).json();
  }
  item = await (await call(route + '/finish', { method: 'POST' })).json();
  assert(item.complete && item.integrityVerified && restarted);
  assert.equal(item.sha256, expectedSha256);
  const downloaded = createHash('sha256'); let received = 0;
  for await (const part of (await call(route + '/download')).body) { received += part.length; downloaded.update(part); }
  assert.equal(received, total); assert.equal(downloaded.digest('hex'), expectedSha256);
  const suffix = await call(route + '/download', { headers: { Range: `bytes=${total - 17}-` } });
  assert.equal(suffix.status, 206);
  assert.equal(suffix.headers.get('content-range'), `bytes ${total - 17}-${total - 1}/${total}`);
  const expectedTail = Buffer.alloc(17);
  for (let i = 0; i < 17; i++) {
    const position = total - 17 + i; const chunkOffset = Math.floor(position / CHUNK) * CHUNK;
    expectedTail[i] = block(chunkOffset)[position - chunkOffset];
  }
  assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), expectedTail);
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
  assert(peakRss < 768 * 1024 ** 2, `Combined client/server RSS exceeded 768 MiB: ${peakRss}`);
  console.log(JSON.stringify({ passed: true, bytes: total, sha256: expectedSha256, restartedAt: restartOffset,
    elapsedSeconds: Math.round((performance.now() - start) / 100) / 10, peakRssMiB: Math.round(peakRss / 1024 ** 2),
    environment: `${process.platform}/${process.arch} Node ${process.version}`, scope: 'real loopback HTTP bytes; in-process server reinitialization, not Wi-Fi or OS crash testing' }, null, 2));
} finally { clearInterval(monitor); await close(); await fs.rm(root, { recursive: true, force: true }); }
