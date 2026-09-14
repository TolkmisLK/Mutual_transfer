import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from '../src/server.js';
import { CHUNK } from '../src/store.js';

// Opt-in integration fixture, not an ordinary unit test. The workflow mounts
// an empty 16 MiB tmpfs for this command; never pass a real data directory.
const supplied = process.env.MUTUAL_DISKFULL_ROOT;
if (process.platform !== 'linux' || !supplied) throw new Error('Requires a dedicated Linux tmpfs fixture via MUTUAL_DISKFULL_ROOT');
const root = await fs.realpath(supplied);
const stat = await fs.statfs(root);
const capacity = stat.blocks * stat.bsize;
if (stat.type !== 0x01021994 || capacity < 12 * 1024 ** 2 || capacity > 32 * 1024 ** 2 || (await fs.readdir(root)).length) {
  throw new Error('Refusing to fill anything except an empty, dedicated 12–32 MiB tmpfs');
}
const data = path.join(root, 'files'); const filler = path.join(root, 'capacity-fixture.bin');
const key = randomBytes(32).toString('base64url');
let server; let base;
async function start() {
  ({ server } = await createServer({ root: data, key }));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
}
async function stop() {
  if (!server) return;
  const old = server; server = null; old.closeAllConnections();
  await new Promise(resolve => old.close(resolve));
}
const call = (route, options = {}) => fetch(base + route, {
  ...options, signal: AbortSignal.timeout(15000), headers: { Authorization: 'Bearer ' + key, ...options.headers },
});
async function json(route, value) {
  return call(route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
}
async function fill() {
  const handle = await fs.open(filler, 'wx', 0o600);
  let wrote = 0; let exhausted = false;
  try {
    const bytes = Buffer.alloc(4096, 0x5a);
    while (wrote <= capacity) {
      try { const result = await handle.write(bytes); wrote += result.bytesWritten; }
      catch (error) { if (error.code !== 'ENOSPC') throw error; exhausted = true; break; }
    }
  } finally { await handle.close(); }
  assert.equal(exhausted, true, 'kernel must return ENOSPC; no simulated filesystem errors');
  assert.ok(wrote <= capacity);
  return wrote;
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const first = Buffer.alloc(CHUNK, 0x31); const second = Buffer.alloc(CHUNK, 0x79);
const expected = createHash('sha256').update(first).update(second).digest('hex');
const report = { capacityBytes: capacity, realEnospc: false, failedChunkOffsetPreserved: false,
  failedCreateReservationReleased: false, metadataFailureNotComplete: false, recoveredSha256Matches: false };
try {
  await start();
  const created = await json('/api/transfers', { name: 'disk-full-fixture.bin', size: CHUNK * 2, expectedSha256: expected });
  assert.equal(created.status, 201); const item = await created.json(); const route = '/api/transfers/' + item.id;
  const chunk = (offset, bytes) => call(route + '/chunk', {
    method: 'PUT', headers: { 'Upload-Offset': String(offset), 'Upload-Checksum': sha(bytes) }, body: bytes,
  });
  assert.equal((await chunk(0, first)).status, 200);
  await fill(); report.realEnospc = true;
  const failed = await chunk(CHUNK, second);
  assert.equal(failed.status, 500); assert.match((await failed.json()).error, /disk space/);
  const after = await (await call(route)).json();
  assert.equal(after.offset, CHUNK); assert.equal(after.complete, false);
  assert.equal((await call(route + '/download')).status, 409);
  report.failedChunkOffsetPreserved = true;
  const rejected = await json('/api/transfers', { name: 'no-space.bin', size: 1 });
  assert.equal(rejected.status, 500); await rejected.arrayBuffer();
  assert.equal((await (await call('/api/transfers')).json()).files.length, 1);
  report.failedCreateReservationReleased = true;
  await stop(); await fs.rm(filler);
  await start();
  assert.equal((await (await call(route)).json()).offset, CHUNK);
  assert.equal((await fs.stat(path.join(data, item.id + '.data'))).size, CHUNK);
  assert.equal((await chunk(CHUNK, second)).status, 200);
  // Data is now complete, but marking it complete still needs a durable
  // metadata checkpoint. Exhaust the filesystem again before that checkpoint.
  await fill();
  const failedFinish = await call(route + '/finish', { method: 'POST' });
  assert.equal(failedFinish.status, 500); await failedFinish.arrayBuffer();
  assert.equal((await (await call(route)).json()).complete, false);
  assert.equal((await call(route + '/download')).status, 409);
  report.metadataFailureNotComplete = true;
  await stop(); await fs.rm(filler); await start();
  const completed = await call(route + '/finish', { method: 'POST' });
  assert.equal(completed.status, 200);
  const finished = await completed.json(); assert.equal(finished.sha256, expected); assert.equal(finished.integrityVerified, true);
  const download = await call(route + '/download'); assert.equal(download.status, 200);
  const hash = createHash('sha256'); let length = 0;
  for await (const part of download.body) { length += part.length; hash.update(part); }
  assert.equal(length, CHUNK * 2); assert.equal(hash.digest('hex'), expected);
  report.recoveredSha256Matches = true;
  await call(route, { method: 'DELETE' });
  const retry = await json('/api/transfers', { name: 'capacity-released.bin', size: CHUNK * 2 });
  assert.equal(retry.status, 201);
  console.log(JSON.stringify(report));
} finally {
  await stop();
  // The workflow unmounts only its generated mountpoint. No recursive deletion
  // here: this script never erases a caller-supplied data tree.
}
