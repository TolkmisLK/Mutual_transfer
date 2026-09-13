import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256 } from '@noble/hashes/sha2.js';
import { hashFile, resumeMatches } from '../public/integrity.js';
import { Store, CHUNK } from '../src/store.js';

test('browser streaming hash matches native SHA-256 across block and chunk boundaries', async () => {
  for (const length of [0, 1, 55, 56, 63, 64, 65, CHUNK + 19]) {
    const bytes = randomBytes(length); const progress = [];
    const digest = await hashFile(new Blob([bytes]), sha256, { onProgress: n => progress.push(n) });
    assert.equal(digest, createHash('sha256').update(bytes).digest('hex'));
    if (length) assert.equal(progress.at(-1), length);
  }
});
test('hashing never requests more than one bounded chunk', async () => {
  const slices = []; const size = 11;
  const file = { size, slice(start, end) { slices.push([start, end]); return new Blob([new Uint8Array(Math.min(end, size) - start)]); } };
  await hashFile(file, sha256, { chunkSize: 4 });
  assert.deepEqual(slices, [[0, 4], [4, 8], [8, 12]]);
  await assert.rejects(hashFile(file, sha256, { chunkSize: 0 }));
});
test('hashing can pause before sending or reading the next chunk', async () => {
  let progress = 0;
  await assert.rejects(hashFile(new Blob(['123456789']), sha256, { chunkSize: 4, onProgress: n => { progress = n; }, isCancelled: () => progress >= 4 }));
  assert.equal(progress, 4);
});
test('resume matching requires original contents, not just filename and size', () => {
  const file = { name: 'same.txt', size: 10 };
  const item = { ...file, offset: 4, expectedSha256: 'a'.repeat(64), complete: false };
  assert.equal(resumeMatches(item, file, 'a'.repeat(64)), true);
  assert.equal(resumeMatches(item, file, 'b'.repeat(64)), false);
  assert.equal(resumeMatches({ ...item, expectedSha256: undefined }, file, 'a'.repeat(64)), false);
  assert.equal(resumeMatches({ ...item, offset: 11 }, file, 'a'.repeat(64)), false);
  assert.equal(resumeMatches({ ...item, complete: true }, file, 'a'.repeat(64)), false);
});
async function storeFor(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-integrity-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return new Store(root).init();
}
test('wrong chunk digest cannot advance the persisted offset', async t => {
  const store = await storeFor(t); const item = await store.create({ name: 'x', size: 3 });
  await assert.rejects(store.append(item.id, 0, Buffer.from('abc'), '0'.repeat(64)), { status: 422 });
  assert.equal(store.get(item.id).offset, 0); assert.equal((await fs.stat(store.file(item.id))).size, 0);
  await store.append(item.id, 0, Buffer.from('abc'), createHash('sha256').update('abc').digest('hex'));
  assert.equal(store.get(item.id).offset, 3);
});
test('completion rejects wrong source hash and never exposes corrupt content as complete', async t => {
  const store = await storeFor(t); const item = await store.create({ name: 'x', size: 3, expectedSha256: createHash('sha256').update('abc').digest('hex') });
  await store.append(item.id, 0, Buffer.from('xyz'));
  await assert.rejects(store.finish(item.id), { status: 422 }); assert.equal(store.get(item.id).complete, false);
});
test('verified completion survives restart, while legacy uploads remain unverified', async t => {
  const store = await storeFor(t); const digest = createHash('sha256').update('abc').digest('hex');
  const item = await store.create({ name: 'x', size: 3, expectedSha256: digest });
  await store.append(item.id, 0, Buffer.from('abc'), digest); await store.finish(item.id);
  const restarted = await new Store(store.root).init(); assert.equal(restarted.get(item.id).integrityVerified, true);
  const legacy = await store.create({ name: 'old', size: 0 }); assert.equal((await store.finish(legacy.id)).integrityVerified, false);
  await assert.rejects(store.create({ name: 'bad', size: 1, expectedSha256: 'short' }), { status: 400 });
});
