import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, serverOptions } from '../src/server.js';

test('production configuration fails closed on insecure LAN, incomplete TLS and ambiguous settings', async () => {
  const defaults = await serverOptions({});
  assert.equal(defaults.host, '127.0.0.1'); assert.equal(defaults.port, 8787);
  assert.equal(defaults.generatedKey, true); assert.ok(defaults.key.length >= 24);
  assert.notEqual((await serverOptions({})).key, defaults.key);
  for (const host of ['0.0.0.0', '::', '192.168.1.10', 'lan.example']) {
    await assert.rejects(serverOptions({ HOST: host }), /LAN mode requires TLS/);
  }
  assert.equal((await serverOptions({ HOST: '0.0.0.0', MUTUAL_ALLOW_HTTP: '1' })).host, '0.0.0.0');
  for (const env of [{ TLS_CERT: 'missing' }, { TLS_KEY: 'missing' }]) await assert.rejects(serverOptions(env), /supplied together/);
  for (const PORT of ['0', '65536', '-1', '1.5', '', '8787x', 'Infinity']) await assert.rejects(serverOptions({ PORT }), /PORT must/);
  for (const MUTUAL_KEY of ['', 'short', 'x'.repeat(1025)]) await assert.rejects(serverOptions({ MUTUAL_KEY }), /MUTUAL_KEY must/);
  for (const ALLOWED_HOSTS of ['', '*', 'https://example.test', 'example.test:443', 'example.test/path', 'user@example.test', 'example.test,']) {
    await assert.rejects(serverOptions({ ALLOWED_HOSTS }), /ALLOWED_HOSTS/);
  }
  assert.deepEqual((await serverOptions({ ALLOWED_HOSTS: 'LOCALHOST, [::1], 127.0.0.1' })).allowedHosts, ['localhost', '[::1]', '127.0.0.1']);
});

function request(port, route, { ca, method = 'GET', headers = {}, body, servername, ...extra } = {}) {
  const bytes = body === undefined ? undefined : Buffer.isBuffer(body) ? body : Buffer.from(body);
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: '127.0.0.1', port, path: route, ca, method, servername,
      agent: false, rejectUnauthorized: true, ...extra,
      headers: { ...headers, ...(bytes ? { 'Content-Length': bytes.length } : {}) } }, res => {
      const protocol = res.socket.getProtocol(); const parts = [];
      res.on('data', part => parts.push(part)); res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(parts), protocol }));
    });
    req.setTimeout(10000, () => req.destroy(new Error('HTTPS fixture request timed out')));
    req.on('error', reject); req.end(bytes);
  });
}

test('real HTTPS validates trust and hostname, then encrypts upload, range download and session revocation', { timeout: 60000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-tls-'));
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await fs.rm(root, { recursive: true, force: true });
  });
  // Fresh one-day loopback test certificate. Never install it in a system trust
  // store, publish its private key, or reuse it for a real LAN deployment.
  const gitOpenSSL = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'usr', 'bin', 'openssl.exe');
  const openssl = process.platform === 'win32' && existsSync(gitOpenSSL) ? gitOpenSSL : 'openssl';
  const certPath = path.join(root, 'cert.pem'); const keyPath = path.join(root, 'key.pem');
  execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyPath, '-out', certPath,
    '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
    '-addext', 'basicConstraints=critical,CA:TRUE'], { timeout: 20000, stdio: 'ignore', windowsHide: true });
  const key = randomBytes(32).toString('base64url');
  const options = await serverOptions({ MUTUAL_KEY: key, TLS_CERT: certPath, TLS_KEY: keyPath,
    DATA_DIR: path.join(root, 'files'), ALLOWED_HOSTS: 'localhost,127.0.0.1' });
  ({ server } = await createServer(options));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port; const ca = await fs.readFile(certPath);
  await assert.rejects(request(port, '/'), error => ['DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN'].includes(error.code));
  await assert.rejects(request(port, '/', { ca, servername: 'wrong-host.example' }), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
  const front = await request(port, '/', { ca });
  assert.equal(front.status, 200); assert.match(front.protocol, /^TLSv1\.[23]$/);
  const origin = 'https://127.0.0.1:' + port;
  const login = await request(port, '/api/session', { ca, method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ key }) });
  assert.equal(login.status, 200);
  const setCookie = login.headers['set-cookie'][0];
  for (const attribute of ['HttpOnly', 'SameSite=Strict', 'Secure', 'Path=/']) assert.ok(setCookie.includes(attribute));
  const cookie = setCookie.split(';')[0];
  const call = (route, options = {}) => request(port, route, { ca, ...options, headers: { Cookie: cookie, ...options.headers } });
  const invite = await call('/api/pairings', { method: 'POST', headers: { Origin: origin } });
  assert.equal(invite.status, 201); const pairing = JSON.parse(invite.bytes);
  const paired = await request(port, '/api/pair', { ca, method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ code: pairing.code }) });
  assert.equal(paired.status, 200); assert.equal(JSON.parse(paired.bytes).canPair, false);
  for (const attribute of ['HttpOnly', 'SameSite=Strict', 'Secure']) assert.ok(paired.headers['set-cookie'][0].includes(attribute));
  const guestCookie = paired.headers['set-cookie'][0].split(';')[0];
  assert.equal((await call('/api/transfers', { headers: { Origin: 'http://127.0.0.1:' + port } })).status, 403);
  assert.equal((await call('/api/transfers', { servername: 'localhost', headers: { Host: 'unlisted.example' } })).status, 403);
  const bytes = randomBytes(65537); const digest = createHash('sha256').update(bytes).digest('hex');
  const created = await call('/api/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ name: 'tls-工作.bin', size: bytes.length, expectedSha256: digest }) });
  assert.equal(created.status, 201); const id = JSON.parse(created.bytes).id; const route = '/api/transfers/' + id;
  assert.equal((await call(route + '/chunk', { method: 'PUT',
    headers: { 'Upload-Offset': '0', 'Upload-Checksum': digest, Origin: origin }, body: bytes })).status, 200);
  const finished = await call(route + '/finish', { method: 'POST', headers: { Origin: origin } });
  assert.equal(finished.status, 200); assert.equal(JSON.parse(finished.bytes).integrityVerified, true);
  const downloaded = await call(route + '/download');
  assert.equal(downloaded.status, 200); assert.deepEqual(downloaded.bytes, bytes);
  assert.equal(createHash('sha256').update(downloaded.bytes).digest('hex'), digest);
  const guestDownload = await request(port, route + '/download', { ca, headers: { Cookie: guestCookie } });
  assert.equal(guestDownload.status, 200); assert.deepEqual(guestDownload.bytes, bytes);
  assert.equal((await request(port, '/api/pairings', { ca, method: 'POST', headers: { Cookie: guestCookie } })).status, 403);
  const tail = await call(route + '/download', { headers: { Range: 'bytes=65530-' } });
  assert.equal(tail.status, 206); assert.deepEqual(tail.bytes, bytes.subarray(65530));
  const logout = await call('/api/session', { method: 'DELETE', headers: { Origin: origin } });
  assert.equal(logout.status, 200); assert.match(logout.headers['set-cookie'][0], /Max-Age=0; Secure/);
  assert.equal((await call('/api/transfers')).status, 401);
});
