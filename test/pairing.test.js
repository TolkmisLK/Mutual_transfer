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

test('owner revokes all paired sessions and unused codes while preserving owner logins and files', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-revoke-guests-'));
  const key = 'generated-revocation-fixture-key-only'; const { server } = await createServer({ root, key });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = (route, method = 'GET', cookie, value, extra = {}) => fetch(base + route, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(value ? { 'Content-Type': 'application/json' } : {}), ...extra }, ...(value ? { body: JSON.stringify(value) } : {}) });
  const login = async () => (await call('/api/session', 'POST', null, { key })).headers.get('set-cookie').split(';')[0];
  const offer = async owner => (await (await call('/api/pairings', 'POST', owner)).json()).code;
  const pair = async code => (await call('/api/pair', 'POST', null, { code })).headers.get('set-cookie').split(';')[0];
  const owners = [await login(), await login()]; const guests = [await pair(await offer(owners[0])), await pair(await offer(owners[1]))];
  const unused = [await offer(owners[0]), await offer(owners[1])];
  const file = await (await call('/api/transfers', 'POST', guests[0], { name: 'kept-empty.txt', size: 0 })).json();
  assert.equal((await call(`/api/transfers/${file.id}/finish`, 'POST', guests[0])).status, 200);
  assert.equal((await call('/api/paired-sessions', 'DELETE')).status, 401);
  assert.equal((await call('/api/paired-sessions', 'DELETE', guests[0])).status, 403);
  assert.equal((await call('/api/paired-sessions', 'DELETE', null, null, { Authorization: 'Bearer ' + key })).status, 403);
  assert.equal((await call('/api/paired-sessions', 'DELETE', owners[0], null, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await call('/api/paired-sessions', 'GET', owners[0])).status, 200);
  assert.equal((await call('/api/transfers', 'GET', guests[0])).status, 200);
  const revoked = await call('/api/paired-sessions', 'DELETE', owners[0]);
  assert.deepEqual(await revoked.json(), { revoked: 2, unusedPairingsRevoked: true });
  assert.equal(revoked.headers.get('cache-control'), 'no-store');
  for (const guest of guests) {
    for (const [route, method] of [['/api/session', 'GET'], ['/api/transfers', 'POST'], [`/api/transfers/${file.id}/download`, 'GET'], [`/api/transfers/${file.id}`, 'DELETE']]) assert.equal((await call(route, method, guest)).status, 401);
  }
  for (const code of unused) assert.equal((await call('/api/pair', 'POST', null, { code })).status, 401);
  for (const owner of owners) assert.equal((await call(`/api/transfers/${file.id}/download`, 'GET', owner)).status, 200);
  assert.deepEqual(await (await call('/api/paired-sessions', 'DELETE', owners[1])).json(), { revoked: 0, unusedPairingsRevoked: true });
  const renewed = await pair(await offer(owners[1]));
  assert.equal((await call(`/api/transfers/${file.id}/download`, 'GET', renewed)).status, 200);
});

test('individual paired-session management exposes no bearer secrets and preserves other sessions and unused codes', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-one-guest-'));
  const key = 'generated-selective-revocation-fixture-key'; const { server } = await createServer({ root, key });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await fs.rm(root, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = (route, method = 'GET', cookie, value, extra = {}) => fetch(base + route, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(value ? { 'Content-Type': 'application/json' } : {}), ...extra }, ...(value ? { body: JSON.stringify(value) } : {}) });
  const login = async () => (await call('/api/session', 'POST', null, { key })).headers.get('set-cookie').split(';')[0];
  const offer = async owner => (await (await call('/api/pairings', 'POST', owner)).json()).code;
  const owner = await login(); const otherOwner = await login(); const code = await offer(owner);
  for (const name of [42, 'x'.repeat(41), 'bad\nname']) assert.equal((await call('/api/pair', 'POST', null, { code, name })).status, 400);
  const pair = async (code, name) => {
    const result = await call('/api/pair', 'POST', null, { code, name }); assert.equal(result.status, 200);
    return { cookie: result.headers.get('set-cookie').split(';')[0], info: await result.json() };
  };
  const first = await pair(code, '<script>literal</script>'); const second = await pair(await offer(otherOwner), 'Other phone'); const unused = await offer(owner);
  const list = await call('/api/paired-sessions', 'GET', owner); assert.equal(list.headers.get('cache-control'), 'no-store');
  const listed = await list.json(); assert.equal(listed.sessions.length, 2);
  for (const entry of listed.sessions) {
    assert.deepEqual(Object.keys(entry).sort(), ['createdAt', 'expiresAt', 'managementId', 'name']);
    assert.match(entry.managementId, /^[a-f0-9]{32}$/); assert.equal(entry.expiresAt - entry.createdAt, 3600000);
    assert.equal((await call('/api/transfers', 'GET', 'mutual_session=' + entry.managementId)).status, 401);
  }
  for (const secret of [key, first.cookie.split('=')[1], second.cookie.split('=')[1], unused]) assert.equal(JSON.stringify(listed).includes(secret), false);
  assert.equal(listed.sessions[0].name, '<script>literal</script>');
  const target = '/api/paired-sessions/' + first.info.managementId;
  for (const [route, method] of [['/api/paired-sessions', 'GET'], [target, 'DELETE']]) {
    assert.equal((await call(route, method)).status, 401);
    assert.equal((await call(route, method, first.cookie)).status, 403);
    assert.equal((await call(route, method, null, null, { Authorization: 'Bearer ' + key })).status, 403);
    assert.equal((await call(route, method, owner, null, { Origin: 'https://evil.example' })).status, 403);
  }
  assert.equal((await call('/api/paired-sessions/not-an-id', 'DELETE', owner)).status, 400);
  assert.equal((await call(target, 'POST', owner)).status, 405);
  const file = await (await call('/api/transfers', 'POST', first.cookie, { name: 'retained.txt', size: 0 })).json();
  assert.equal((await call(`/api/transfers/${file.id}/finish`, 'POST', first.cookie)).status, 200);
  assert.deepEqual(await (await call(target, 'DELETE', otherOwner)).json(), { revoked: true });
  assert.deepEqual(await (await call(target, 'DELETE', owner)).json(), { revoked: false });
  for (const [route, method] of [['/api/transfers', 'GET'], ['/api/transfers', 'POST'], [`/api/transfers/${file.id}/download`, 'GET'], [`/api/transfers/${file.id}`, 'DELETE']]) assert.equal((await call(route, method, first.cookie)).status, 401);
  for (const cookie of [owner, otherOwner, second.cookie]) assert.equal((await call(`/api/transfers/${file.id}/download`, 'GET', cookie)).status, 200);
  assert.equal((await call('/api/paired-sessions', 'GET', owner).then(r => r.json())).sessions.length, 1);
  await pair(unused, 'Still invited');
  await call('/api/session', 'DELETE', second.cookie);
  const remaining = (await (await call('/api/paired-sessions', 'GET', owner)).json()).sessions;
  assert.deepEqual(remaining.map(entry => entry.name), ['Still invited']);
});
