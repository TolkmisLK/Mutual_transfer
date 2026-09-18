// Ephemeral CI-only HTTPS fixture. No permanent CA enrollment or TLS bypass.
// The normal debug/release APK never includes this generated public certificate.
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer } from '../src/server.js';
const repo = fileURLToPath(new URL('../', import.meta.url));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'transfer-android-'));
await fs.chmod(root, 0o700);
const certPath = path.join(root, 'cert.pem'), keyPath = path.join(root, 'key.pem');
const publicCa = path.join(repo, 'android/app/src/acceptance/res/raw/test_ca.pem');
const configPath = path.join(repo, 'android/app/src/androidTestAcceptance/assets/connection.json');
const owned = []; let server;
async function cleanup() {
  if (server?.listening) await new Promise(resolve => server.close(resolve));
  for (const file of owned) await fs.rm(file, { force: true });
  await fs.rm(root, { recursive: true, force: true });
}
try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', keyPath, '-out', certPath,
    '-subj', '/CN=Mutual Transfer temporary CI', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'subjectAltName=IP:10.0.2.2'], { stdio: 'ignore', timeout: 30000 });
  await fs.chmod(keyPath, 0o600);
  await fs.mkdir(path.dirname(publicCa), { recursive: true }); await fs.mkdir(path.dirname(configPath), { recursive: true });
  const key = randomBytes(32).toString('hex');
  const fixture = await createServer({ root: path.join(root, 'data'), key, allowedHosts: ['10.0.2.2', 'localhost'], tls: { cert: await fs.readFile(certPath), key: await fs.readFile(keyPath) } });
  server = fixture.server;
  const bytes = Buffer.alloc(65537); for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  const hash = createHash('sha256').update(bytes).digest('hex');
  const item = await fixture.store.create({ name: 'server-fixture.bin', size: bytes.length, expectedSha256: hash });
  await fixture.store.append(item.id, 0, bytes, hash); await fixture.store.finish(item.id);
  // Corrupt only a newly created disposable fixture after its valid checkpoint.
  // The real server still serves the recorded digest; the native client must
  // reject altered bytes and remove its newly created destination document.
  const damaged = await fixture.store.create({ name: 'damaged-fixture.bin', size: bytes.length, expectedSha256: hash });
  await fixture.store.append(damaged.id, 0, bytes, hash); await fixture.store.finish(damaged.id);
  const altered = Buffer.from(bytes); altered[0] ^= 0xff;
  await fs.writeFile(fixture.store.file(damaged.id), altered);
  if (createHash('sha256').update(await fs.readFile(fixture.store.file(damaged.id))).digest('hex') === hash) throw new Error('Corrupt fixture was not changed');
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(10878, '127.0.0.1', resolve); });
  await fs.writeFile(publicCa, await fs.readFile(certPath), { flag: 'wx', mode: 0o600 }); owned.push(publicCa);
  await fs.writeFile(configPath, JSON.stringify({ origin: 'https://10.0.2.2:10878', key, download: '/api/transfers/' + item.id + '/download', damagedDownload: '/api/transfers/' + damaged.id + '/download', hash, bytes: bytes.length }), { flag: 'wx', mode: 0o600 }); owned.push(configPath);
  console.log('Android HTTPS fixture ready (credentials are not logged).');
} catch (error) { await cleanup(); throw error; }
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { cleanup().then(() => process.exit(0), () => process.exit(1)); });
