import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createServer, serverOptions } from '../src/server.js';

export async function portableOptions(env = process.env, platform = process.platform) {
  let data = env.DATA_DIR;
  if (!data) {
    if (platform === 'win32' && (!env.LOCALAPPDATA || !path.win32.isAbsolute(env.LOCALAPPDATA))) throw new Error('LOCALAPPDATA is missing or invalid; set an absolute DATA_DIR');
    data = platform === 'win32' ? path.win32.join(env.LOCALAPPDATA, 'MutualTransfer', 'data') : path.join(homedir(), '.local', 'share', 'mutual-transfer', 'data');
  }
  return serverOptions({ ...env, DATA_DIR: data });
}

export async function launch() {
  const options = await portableOptions(); const { server } = await createServer(options);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(options.port, options.host, resolve); });
  const address = options.host.includes(':') ? '[' + options.host + ']' : options.host;
  const base = (options.tls ? 'https://' : 'http://') + address + ':' + options.port;
  console.log('Mutual Transfer portable server: ' + base);
  console.log('Files and resume checkpoints: ' + path.resolve(options.root));
  if (options.generatedKey) console.log('Workspace key (private, changes after restart): ' + options.key);
  console.log('Type stop and press Enter, or press Ctrl+C, to stop the server. Closing the browser does not stop it.');
  console.log('LAN access requires trusted TLS configuration. Do not bypass certificate or firewall protections.');
  let stopping = false; const input = createInterface({ input: process.stdin });
  function stop() {
    if (stopping) return; stopping = true; input.close();
    server.close(() => { console.log('Mutual Transfer stopped. Stored files are retained.'); });
    const timer = setTimeout(() => { server.closeAllConnections(); }, 5000); timer.unref();
  }
  input.on('line', line => { if (line.trim().toLowerCase() === 'stop') stop(); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
  // Only the fixed, loopback, non-TLS URL is opened automatically. A LAN TLS
  // deployment needs its operator-selected certificate-matching address.
  if (process.platform === 'win32' && process.env.MUTUAL_NO_OPEN !== '1' && !options.tls && ['127.0.0.1', 'localhost'].includes(options.host)) {
    const browser = spawn('explorer.exe', [base], { shell: false, detached: true, stdio: 'ignore' });
    browser.on('error', () => console.log('Open the address above in your browser.')); browser.unref();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  launch().catch(error => { console.error('Unable to start: ' + error.message); process.exitCode = 1; });
}
