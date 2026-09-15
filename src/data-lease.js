import { createServer } from 'node:net';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

// Prevent cooperating service processes from opening the same store before
// recovery truncates uncommitted tails. No PID guessing, lock stealing or kill.
export async function acquireDataLease(root) {
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const canonical = await fs.realpath(root);
  const identity = process.platform === 'win32' ? canonical.toLowerCase() : canonical;
  const digest = createHash('sha256').update(identity).digest('hex');
  // Linux abstract sockets and Windows pipes disappear when the owner dies.
  // Other Unix platforms use a file socket and fail closed on crash leftovers.
  const address = process.platform === 'win32' ? '\\\\.\\pipe\\mutual-transfer-' + digest : process.platform === 'linux' ? '\0mutual-transfer-' + digest : path.join('/tmp', 'mutual-transfer-' + digest + '.sock');
  const guard = createServer(socket => socket.destroy()); guard.maxConnections = 16;
  try {
    await new Promise((resolve, reject) => {
      guard.once('error', reject); guard.listen({ path: address, exclusive: true, readableAll: false, writableAll: false }, resolve);
    });
  } catch (error) {
    guard.close();
    throw new Error('Data directory is already in use or its local ownership guard is unavailable. Do not start another instance on this directory.', { cause: error });
  }
  // The data service owns process lifetime; a startup failure must not leave an
  // otherwise idle process alive merely because its guard exists.
  guard.unref(); let released;
  return { root: canonical, release() { return released ||= new Promise(resolve => guard.close(resolve)); } };
}
