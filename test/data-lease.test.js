import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { acquireDataLease } from '../src/data-lease.js';
import { createServer } from '../src/server.js';
import { Store } from '../src/store.js';

async function temp(t) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-lease-')); t.after(() => fs.rm(root, { recursive: true, force: true })); return root; }
test('a data lease excludes aliases and other owners until normal close', async t => {
  const root = await temp(t); const lease = await acquireDataLease(root);
  try {
    await assert.rejects(acquireDataLease(path.join(root, '.', 'unused', '..')), /already in use/);
    const alias = path.join(root, 'alias'); await fs.symlink(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(acquireDataLease(alias), /already in use/);
    if (process.platform === 'win32') await assert.rejects(acquireDataLease(root.toUpperCase()), /already in use/);
  } finally { await lease.release(); await lease.release(); }
  const next = await acquireDataLease(root); await next.release();
});
test('failed store initialization and HTTPS setup release ownership', async t => {
  const root = await temp(t); const broken = path.join(root, '00000000-0000-0000-0000-000000000000.json');
  await fs.writeFile(broken, '{}');
  await assert.rejects(createServer({ root, key: 'fixture-key-only-for-data-lease-tests' }), /metadata/);
  await fs.rm(broken);
  await assert.rejects(createServer({ root, key: 'fixture-key-only-for-data-lease-tests', tls: { cert: 'invalid', key: 'invalid' } }));
  const lease = await acquireDataLease(root); await lease.release();
});
test('a real second process cannot truncate an active store; forced owner exit frees the OS guard', { timeout: 20000, skip: !['linux', 'win32'].includes(process.platform) }, async t => {
  const root = await temp(t); const store = await new Store(root).init();
  const item = await store.create({ name: 'in-flight.bin', size: 8 }); await store.append(item.id, 0, Buffer.from('done'));
  const children = new Set(); t.after(async () => { for (const child of children) { child.kill(); await child.finished; } });
  function child() {
    const process = fork(fileURLToPath(new URL('../tool/lease-fixture.js', import.meta.url)), [root], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    children.add(process); process.finished = once(process, 'exit').then(([code, signal]) => { children.delete(process); return { code, signal }; });
    process.firstMessage = once(process, 'message').then(([value]) => value); return process;
  }
  const owner = child(); assert.equal((await owner.firstMessage).ready, true);
  // Model an uncommitted data tail while its owner remains alive. A competing
  // startup must be rejected before Store.init() can truncate that tail.
  await fs.appendFile(store.file(item.id), 'tail');
  const competing = child(); assert.equal((await competing.firstMessage).rejected, true); assert.equal((await competing.finished).code, 2);
  assert.equal(await fs.readFile(store.file(item.id), 'utf8'), 'donetail');
  owner.kill('SIGKILL'); await owner.finished;
  const recovered = child(); assert.equal((await recovered.firstMessage).ready, true);
  assert.equal(await fs.readFile(store.file(item.id), 'utf8'), 'done');
  recovered.send('stop'); assert.equal((await recovered.finished).code, 0);
  const final = await acquireDataLease(root); await final.release();
});
