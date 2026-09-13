import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export class TransferError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const CHUNK = 4 * 1024 * 1024;
export class Store {
  constructor(root, { quota = 100 * 1024 ** 3, maxFiles = 1000 } = {}) {
    this.root = path.resolve(root); this.quota = quota; this.maxFiles = maxFiles;
    this.items = new Map(); this.busy = new Set();
  }
  async init() {
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
    for (const name of await fs.readdir(this.root)) {
      if (!/^[a-f0-9-]{36}\.json$/.test(name)) continue;
      const item = JSON.parse(await fs.readFile(path.join(this.root, name), 'utf8'));
      if (!/^[a-f0-9-]{36}$/.test(item.id) || `${item.id}.json` !== name ||
          !Number.isSafeInteger(item.size) || item.size < 0 ||
          !Number.isSafeInteger(item.offset) || item.offset < 0 || item.offset > item.size) {
        throw new Error('Invalid transfer metadata; restore the data directory from backup.');
      }
      const stat = await fs.stat(this.file(item.id));
      if (stat.size < item.offset) throw new Error('Transfer data is shorter than its checkpoint.');
      if (!item.complete && stat.size !== item.offset) await fs.truncate(this.file(item.id), item.offset);
      this.items.set(item.id, item);
    }
    return this;
  }
  file(id) { return path.join(this.root, `${id}.data`); }
  get(id) { const item = this.items.get(id); if (!item) throw new TransferError(404, 'Transfer not found'); return item; }
  async save(item) {
    const dest = path.join(this.root, `${item.id}.json`);
    const temp = `${dest}.tmp`;
    const handle = await fs.open(temp, 'w', 0o600);
    try { await handle.writeFile(JSON.stringify(item)); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temp, dest);
  }
  async create({ name, size, expectedSha256 }) {
    if (typeof name !== 'string' || !name.trim() || Buffer.byteLength(name) > 240 || /[\\/\x00-\x1f\x7f]/.test(name))
      throw new TransferError(400, 'Invalid filename');
    if (!Number.isSafeInteger(size) || size < 0) throw new TransferError(400, 'Invalid file size');
    if (expectedSha256 !== undefined && !/^[a-f0-9]{64}$/.test(expectedSha256)) throw new TransferError(400, 'Invalid SHA-256');
    const reserved = [...this.items.values()].reduce((sum, i) => sum + i.size, 0);
    if (this.items.size >= this.maxFiles || size > this.quota - reserved) throw new TransferError(507, 'Workspace quota exceeded');
    const item = { id: randomUUID(), name, size, expectedSha256, offset: 0, complete: false, createdAt: new Date().toISOString() };
    // Reserve synchronously before I/O so concurrent creates cannot exceed the quota.
    this.items.set(item.id, item);
    try { await fs.writeFile(this.file(item.id), '', { flag: 'wx', mode: 0o600 }); await this.save(item); }
    catch (e) { this.items.delete(item.id); await fs.rm(this.file(item.id), { force: true }); throw e; }
    return item;
  }
  async append(id, offset, bytes, checksum) {
    const item = this.get(id);
    if (this.busy.has(id)) throw new TransferError(409, 'Transfer is busy; retry');
    if (item.complete || offset !== item.offset) throw new TransferError(409, 'Offset changed; refresh before resuming');
    if (!bytes.length || bytes.length > CHUNK || bytes.length > item.size - item.offset) throw new TransferError(400, 'Invalid chunk length');
    if (checksum !== undefined && (!/^[a-f0-9]{64}$/.test(checksum) || createHash('sha256').update(bytes).digest('hex') !== checksum)) throw new TransferError(422, 'Chunk checksum mismatch');
    this.busy.add(id);
    try {
      const next = { ...item, offset: item.offset + bytes.length };
      const handle = await fs.open(this.file(id), 'r+');
      try {
        await handle.truncate(offset);
        let written = 0;
        while (written < bytes.length) written += (await handle.write(bytes, written, bytes.length - written, offset + written)).bytesWritten;
        await handle.sync();
      } finally { await handle.close(); }
      await this.save(next); this.items.set(id, next); return next;
    } finally { this.busy.delete(id); }
  }
  async finish(id) {
    const item = this.get(id);
    if (item.complete) return item;
    if (this.busy.has(id) || item.offset !== item.size) throw new TransferError(409, 'Upload is incomplete or busy');
    this.busy.add(id);
    try {
      const hash = createHash('sha256');
      for await (const part of createReadStream(this.file(id))) hash.update(part);
      const sha256 = hash.digest('hex');
      if (item.expectedSha256 && item.expectedSha256 !== sha256) throw new TransferError(422, 'File checksum mismatch; delete this transfer and upload the original file again');
      const next = { ...item, complete: true, sha256, integrityVerified: Boolean(item.expectedSha256) };
      await this.save(next); this.items.set(id, next); return next;
    } finally { this.busy.delete(id); }
  }
  async remove(id) {
    this.get(id);
    if (this.busy.has(id)) throw new TransferError(409, 'Transfer is busy');
    this.busy.add(id);
    try {
      await fs.rm(path.join(this.root, `${id}.json`));
      this.items.delete(id);
      await fs.rm(this.file(id), { force: true });
    } finally { this.busy.delete(id); }
  }
}
