import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import path from 'node:path';
import os from 'node:os';

// Called on a freshly extracted ZIP, not on a checkout or a production store.
if (process.platform !== 'win32' || !process.argv[2]) throw new Error('Requires Windows and an extracted portable bundle directory');
const bundle = await fs.realpath(process.argv[2]);
const runtime = path.join(bundle, 'runtime', 'node.exe');
const manifest = JSON.parse((await fs.readFile(path.join(bundle, 'FILES.sha256.json'), 'utf8')).replace(/^\uFEFF/, ''));
async function filesAt(dir, prefix = '') {
  const files = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    assert.equal(entry.isSymbolicLink(), false);
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await filesAt(path.join(dir, entry.name), name + '/'));
    else files.push(name);
  }
  return files;
}
assert.deepEqual((await filesAt(bundle)).sort(), [...Object.keys(manifest), 'FILES.sha256.json'].sort(), 'no unmanifested packaged files');
for (const [relative, expected] of Object.entries(manifest)) {
  assert.ok(!relative.includes('..') && !path.isAbsolute(relative));
  const actual = createHash('sha256').update(await fs.readFile(path.join(bundle, relative))).digest('hex');
  assert.equal(actual, expected, 'Packaged file digest: ' + relative);
}
for (const required of ['runtime/node.exe', 'runtime/NODE-LICENSE.txt', 'START-WINDOWS.cmd', 'src/server.js', 'src/pairing.js', 'public/app.js', 'tool/portable-launch.js', 'node_modules/@noble/hashes/sha2.js', 'node_modules/@noble/hashes/LICENSE', 'LICENSE']) assert.ok(manifest[required]);
assert.equal(Object.keys(manifest).some(p => /(?:^|\/)(?:data|test|e2e)\//.test(p) || /\.(?:pem|key)$/.test(p)), false);
const identity = JSON.parse(execFileSync(runtime, ['-p', 'JSON.stringify({version:process.version,arch:process.arch,execPath:process.execPath})'], { encoding: 'utf8', timeout: 10000 }));
assert.equal(identity.version, 'v24.21.0'); assert.equal(identity.arch, 'x64'); assert.equal(path.resolve(identity.execPath).toLowerCase(), runtime.toLowerCase());
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-portable-acceptance-'));
let child; let exit; let output = ''; let code; let base;
const marker = path.join(fixture, 'operator-file.txt'); await fs.writeFile(marker, 'must not change');
const signal = () => AbortSignal.timeout(15000);
const command = path.join(process.env.SystemRoot, 'System32', 'cmd.exe');
const commandArgs = ['/d', '/s', '/c', '""' + path.join(bundle, 'START-WINDOWS.cmd') + '""'];
function terminateFixture(childProcess) {
  // Only the exact process tree created by this harness, never image-name kill.
  try { execFileSync(path.join(process.env.SystemRoot, 'System32', 'taskkill.exe'), ['/PID', String(childProcess.pid), '/T', '/F'], { stdio: 'ignore', timeout: 10000 }); }
  catch { childProcess.kill(); }
}
async function start(viaCommand = false) {
  const reserve = createServer(); await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
  const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
  output = ''; code = undefined; base = 'http://127.0.0.1:' + port;
  const env = { ...process.env, NODE_OPTIONS: '', NODE_PATH: '', LOCALAPPDATA: fixture, HOST: '127.0.0.1', PORT: String(port), MUTUAL_NO_OPEN: '1' };
  for (const name of ['DATA_DIR', 'MUTUAL_KEY', 'TLS_CERT', 'TLS_KEY', 'ALLOWED_HOSTS', 'MUTUAL_ALLOW_HTTP']) delete env[name];
  if (viaCommand) { env.NODE_OPTIONS = '--require "' + path.join(fixture, 'nonexistent-preload.cjs') + '"'; env.NODE_PATH = path.join(fixture, 'nonexistent-modules'); }
  child = spawn(viaCommand ? command : runtime, viaCommand ? commandArgs : [path.join(bundle, 'tool', 'portable-launch.js')], { cwd: fixture, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, windowsVerbatimArguments: viaCommand });
  exit = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (value, terminatedBy) => { code = value; resolve({ code: value, terminatedBy }); }); });
  // Never print captured stdout: it includes the generated fixture access key.
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => { output += bytes; if (output.length > 65536) terminateFixture(child); });
  const deadline = Date.now() + 20000;
  while (!output.includes('Type stop') && code === undefined && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  assert.ok(output.includes('Type stop'), 'packaged process reached ready state');
  const key = /Workspace key \(private, changes after restart\): ([A-Za-z0-9_-]+)/.exec(output)?.[1]; assert.ok(key);
  const response = await fetch(base + '/api/session', { method: 'POST', signal: signal(), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) });
  assert.equal(response.status, 200); return { key, cookie: response.headers.get('set-cookie').split(';')[0] };
}
async function stop() {
  if (!child) return; const old = child; child = null; old.stdin.end('stop\n');
  const timer = setTimeout(() => terminateFixture(old), 10000);
  try { const result = await exit; assert.equal(result.code, 0); assert.equal(result.terminatedBy, null); }
  finally { clearTimeout(timer); }
}
try {
  const first = await start();
  let cookie = first.cookie;
  const call = (route, options = {}) => fetch(base + route, { ...options, signal: signal(), headers: { Cookie: cookie, ...options.headers } });
  const front = await call('/'); assert.equal(front.status, 200); assert.match(await front.text(), /Mutual Transfer/);
  const webManifest = await call('/manifest.webmanifest'); assert.equal(webManifest.status, 200); assert.equal((await webManifest.json()).display, 'standalone');
  for (const asset of ['/service-worker.js', '/install.js', '/app-icon.svg']) assert.equal((await call(asset)).status, 200);
  for (const name of ['sha2.js', '_md.js', '_u64.js', 'utils.js']) assert.equal((await call('/vendor/' + name)).status, 200);
  const bytes = randomBytes(4 * 1024 * 1024 + 65537); const sha = b => createHash('sha256').update(b).digest('hex');
  const created = await call('/api/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'packaged-resume.bin', size: bytes.length, expectedSha256: sha(bytes) }) });
  assert.equal(created.status, 201); const item = await created.json(); const route = '/api/transfers/' + item.id;
  const chunk = (offset, part) => call(route + '/chunk', { method: 'PUT', headers: { 'Upload-Offset': String(offset), 'Upload-Checksum': sha(part) }, body: part });
  assert.equal((await chunk(0, bytes.subarray(0, 4 * 1024 * 1024))).status, 200);
  await stop(); const second = await start(); assert.ok(second.key !== first.key, 'restart generates a new private workspace key');
  assert.equal((await call('/api/transfers')).status, 401); cookie = second.cookie;
  const resumed = await (await call(route)).json(); assert.equal(resumed.offset, 4 * 1024 * 1024);
  assert.equal((await chunk(resumed.offset, bytes.subarray(resumed.offset))).status, 200);
  const finished = await (await call(route + '/finish', { method: 'POST' })).json(); assert.equal(finished.integrityVerified, true); assert.equal(finished.sha256, sha(bytes));
  const downloaded = await call(route + '/download'); assert.equal(downloaded.status, 200); assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
  await stop();
  const commandLogin = await start(true); cookie = commandLogin.cookie;
  assert.deepEqual(Buffer.from(await (await call(route + '/download')).arrayBuffer()), bytes);
  await stop();
  const failure = spawn(command, commandArgs, { cwd: fixture, env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '', LOCALAPPDATA: fixture, PORT: '0', MUTUAL_NO_OPEN: '1' }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, windowsVerbatimArguments: true });
  let failureOutput = ''; for (const stream of [failure.stdout, failure.stderr]) stream.on('data', bytes => { failureOutput += bytes; });
  failure.stdin.end('\n'); // Acknowledge pause without changing a consumer setting.
  const timer = setTimeout(() => terminateFixture(failure), 15000);
  try {
    const failureExit = await new Promise((resolve, reject) => { failure.once('error', reject); failure.once('exit', (code, signal) => resolve({ code, signal })); });
    assert.equal(failureExit.signal, null); assert.equal(failureExit.code, 1); assert.match(failureOutput, /PORT must be/);
  } finally { clearTimeout(timer); }
  assert.equal(await fs.readFile(marker, 'utf8'), 'must not change');
  assert.equal((await fs.stat(path.join(fixture, 'MutualTransfer', 'data', item.id + '.data'))).size, bytes.length);
  await assert.rejects(fs.stat(path.join(bundle, 'data')), { code: 'ENOENT' });
  console.log(JSON.stringify({ platform: process.platform, runtimeVersion: identity.version, runtimeArch: identity.arch, manifestFilesVerified: Object.keys(manifest).length,
    actualPackagedProcess: true, defaultUserDataIsolated: true, bytes: bytes.length, restartedResumeAndHashMatch: true, previousSessionInvalidated: true, normalStdinExit: true,
    commandLauncherTested: true, inheritedNodeOptionsCleared: true, commandFailureExitPreserved: true,
    browserAutoOpenTested: false, cleanMachineTested: false, physicalLanTested: false }));
} finally {
  if (child) { terminateFixture(child); await exit.catch(() => {}); }
  await fs.rm(fixture, { recursive: true, force: true });
}
