import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Pairings } from '../src/pairing.js';
import { createServer } from '../src/server.js';

test('pairing codes are one-time, hashed, bounded and expire at five minutes', () => {
  let now = 1000; const codes = new Pairings(() => now); const first = codes.create('owner');
  assert.match(first.code, /^[A-F0-9]{5}(?:-[A-F0-9]{5}){3}$/);
  assert.equal(first.expiresAt, 301000); assert.equal(codes.entries.has(first.code), false);
  assert.equal(codes.consume(first.code.toLowerCase(), owner => owner === 'owner'), 'owner');
  assert.throws(() => codes.consume(first.code, () => true), { status: 401 });
  const expired = codes.create('owner'); now = expired.expiresAt;
  assert.throws(() => codes.consume(expired.code, () => true), { status: 401 });
  const revoked = codes.create('owner'); codes.revoke('owner');
  assert.throws(() => codes.consume(revoked.code, () => true), { status: 401 });
  const inactive = codes.create('owner'); assert.throws(() => codes.consume(inactive.code, () => false), { status: 401 });
  codes.revoke('owner');
  for (let i = 0; i < 4; i++) codes.create('owner');
  assert.throws(() => codes.create('owner'), { status: 429 });
  for (let i = 0; i < 60; i++) codes.create('other-' + i);
  assert.throws(() => codes.create('new'), { status: 429 });
  now += 300000; assert.doesNotThrow(() => codes.create('new'));
  for (const invalid of [null, {}, 'Z'.repeat(20), '0'.repeat(33)]) assert.throws(() => codes.consume(invalid, () => true), { status: 401 });
});

test('real HTTP pairing admits exactly one session and enforces issuer privileges and logout revocation', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-pairing-'));
  const key = 'generated-fixture-workspace-key-only'; const { server } = await createServer({ root, key });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = (route, method = 'GET', cookie, value, extra = {}) => fetch(base + route, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(value ? { 'Content-Type': 'application/json' } : {}), ...extra }, ...(value ? { body: JSON.stringify(value) } : {}) });
  assert.equal((await call('/api/pairings', 'POST')).status, 401);
  const login = await call('/api/session', 'POST', null, { key }); const owner = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await login.json()).canPair, true);
  const offered = await call('/api/pairings', 'POST', owner); assert.equal(offered.status, 201);
  assert.equal(offered.headers.get('cache-control'), 'no-store'); const { code } = await offered.json();
  assert.equal((await call('/api/pair', 'POST', null, { code }, { Origin: 'https://evil.example' })).status, 403);
  const race = await Promise.all([call('/api/pair', 'POST', null, { code }), call('/api/pair', 'POST', null, { code })]);
  assert.deepEqual(race.map(r => r.status).sort(), [200, 401]);
  const paired = race.find(r => r.status === 200); const guest = paired.headers.get('set-cookie').split(';')[0];
  assert.equal((await paired.json()).canPair, false);
  assert.equal((await call('/api/transfers', 'GET', guest)).status, 200);
  assert.equal((await call('/api/pairings', 'POST', guest)).status, 403);
  assert.equal((await call('/api/pairings', 'DELETE', guest)).status, 403);
  const unused = await (await call('/api/pairings', 'POST', owner)).json();
  await call('/api/pairings', 'DELETE', owner);
  assert.equal((await call('/api/pair', 'POST', null, { code: unused.code })).status, 401);
  const beforeLogout = await (await call('/api/pairings', 'POST', owner)).json();
  await call('/api/session', 'DELETE', owner);
  assert.equal((await call('/api/pair', 'POST', null, { code: beforeLogout.code })).status, 401);
  // Revoking unused codes is not an undocumented global logout operation.
  assert.equal((await call('/api/transfers', 'GET', guest)).status, 200);
  await call('/api/session', 'DELETE', guest);
  assert.equal((await call('/api/transfers', 'GET', guest)).status, 401);
});

test('pairing guesses share the bounded login rate limit', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-pair-rate-'));
  const { server } = await createServer({ root, key: 'test-workspace-key-for-rate-limit' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + server.address().port;
  for (let i = 0; i < 13; i++) {
    const result = await fetch(base + '/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: '0'.repeat(20) }) });
    assert.equal(result.status, i < 12 ? 401 : 429);
  }
});
