import http from 'node:http';
import https from 'node:https';
import { promises as fs, createReadStream } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Store, TransferError, CHUNK } from './store.js';

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
function localHosts() {
  const hosts = ['localhost', '127.0.0.1', '[::1]'];
  try { hosts.push(...Object.values(networkInterfaces()).flat().filter(Boolean).map(i => i.address.includes(':') ? `[${i.address}]` : i.address)); }
  catch { /* Restricted hosts may deny interface enumeration; loopback remains usable. */ }
  return hosts;
}
const equal = (a, b) => { const x = Buffer.from(a || ''); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };
async function body(req, limit) {
  const length = Number(req.headers['content-length']);
  if (!Number.isSafeInteger(length) || length < 0 || length > limit) throw new TransferError(413, 'Request length missing or too large');
  const parts = []; let size = 0;
  for await (const part of req) { size += part.length; if (size > limit) throw new TransferError(413, 'Request too large'); parts.push(part); }
  if (size !== length) throw new TransferError(400, 'Incomplete request');
  return Buffer.concat(parts);
}
async function input(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) throw new TransferError(415, 'JSON required');
  try {
    const value = JSON.parse((await body(req, 2048)).toString());
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new TransferError(400, 'JSON object required');
    return value;
  }
  catch (e) { if (e instanceof TransferError) throw e; throw new TransferError(400, 'Invalid JSON'); }
}
export function byteRange(header, size) {
  if (!header) return { start: 0, end: size - 1, partial: false };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2]) || !size) throw new TransferError(416, 'Invalid range');
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] ? (m[2] ? Math.min(Number(m[2]), size - 1) : size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) throw new TransferError(416, 'Invalid range');
  return { start, end, partial: true };
}
async function previewType(file) {
  const h = await fs.open(file, 'r'); const b = Buffer.alloc(16);
  try { await h.read(b, 0, 16, 0); } finally { await h.close(); }
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (/^GIF8[79]a/.test(b.toString('ascii'))) return 'image/gif';
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b.toString('ascii', 4, 8) === 'ftyp') return 'video/mp4';
  if (b.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) return 'video/webm';
  return null;
}
export async function createServer({ root, key, quota, tls, allowedHosts } = {}) {
  if (typeof key !== 'string' || key.length < 24) throw new Error('Workspace key must have at least 24 characters');
  const store = await new Store(root, { quota }).init();
  const sessions = new Map(); const attempts = new Map(); let activeBodies = 0;
  const hosts = new Set(allowedHosts || localHosts());
  async function handle(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const origin = `${tls ? 'https' : 'http'}://${req.headers.host}`;
      const url = new URL(req.url, origin);
      if (!hosts.has(new URL(origin).hostname)) throw new TransferError(403, 'Host not allowed');
      if (req.headers.origin && req.headers.origin !== origin) throw new TransferError(403, 'Cross-origin request rejected');
      const route = url.pathname;
      if (req.method === 'GET' && ['/', '/app.js', '/style.css'].includes(route)) {
        const file = route === '/' ? 'index.html' : route.slice(1);
        res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
        res.end(await fs.readFile(path.join(publicRoot, file))); return;
      }
      if (req.method === 'POST' && route === '/api/session') {
        const now = Date.now();
        for (const [ip, v] of attempts) if (now - v.start > 60000) attempts.delete(ip);
        const ip = req.socket.remoteAddress;
        const attempt = attempts.get(ip) || { start: now, count: 0 };
        if (attempts.size >= 1000 || ++attempt.count > 12) throw new TransferError(429, 'Please wait before trying again');
        attempts.set(ip, attempt);
        const value = await input(req);
        if (!value || typeof value.key !== 'string' || !equal(value.key, key)) throw new TransferError(401, 'Incorrect workspace key');
        for (const [id, expiry] of sessions) if (expiry <= now) sessions.delete(id);
        if (sessions.size >= 128) throw new TransferError(429, 'Workspace session limit reached');
        const id = randomBytes(32).toString('hex'); sessions.set(id, now + 3600000);
        res.setHeader('Set-Cookie', `mutual_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600${tls ? '; Secure' : ''}`);
        json(res, 200, { ok: true }); return;
      }
      const cookie = /(?:^|;\s*)mutual_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '')?.[1];
      const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
      if (!(cookie && (sessions.get(cookie) || 0) > Date.now()) && !equal(bearer, key)) throw new TransferError(401, 'Join the workspace first');
      if (req.method === 'DELETE' && route === '/api/session') {
        sessions.delete(cookie); res.setHeader('Set-Cookie', 'mutual_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); json(res, 200, { ok: true }); return;
      }
      if (req.method === 'GET' && route === '/api/transfers') { json(res, 200, { chunkSize: CHUNK, files: [...store.items.values()] }); return; }
      if (req.method === 'POST' && route === '/api/transfers') { json(res, 201, await store.create(await input(req))); return; }
      const match = /^\/api\/transfers\/([a-f0-9-]{36})(?:\/(chunk|finish|download|preview|text))?$/.exec(route);
      if (!match) throw new TransferError(404, 'Not found');
      const [, id, action] = match; const item = store.get(id);
      if (req.method === 'GET' && !action) { json(res, 200, item); return; }
      if (req.method === 'DELETE' && !action) { await store.remove(id); json(res, 200, { ok: true }); return; }
      if (req.method === 'PUT' && action === 'chunk') {
        if (activeBodies >= 8) throw new TransferError(429, 'Too many simultaneous chunks');
        if (!/^\d+$/.test(req.headers['upload-offset'] || '')) throw new TransferError(400, 'Upload-Offset required');
        activeBodies++;
        try { json(res, 200, await store.append(id, Number(req.headers['upload-offset']), await body(req, CHUNK))); }
        finally { activeBodies--; } return;
      }
      if (req.method === 'POST' && action === 'finish') { json(res, 200, await store.finish(id)); return; }
      if (req.method === 'GET' && ['download', 'preview', 'text'].includes(action)) {
        if (!item.complete) throw new TransferError(409, 'File is not complete');
        const file = store.file(id);
        if (action === 'text') {
          const handle = await fs.open(file, 'r'); const buf = Buffer.alloc(Math.min(item.size, 65536));
          try { await handle.read(buf, 0, buf.length, 0); } finally { await handle.close(); }
          if (buf.includes(0)) throw new TransferError(415, 'Binary file; download to open');
          json(res, 200, { text: buf.toString('utf8'), truncated: item.size > buf.length }); return;
        }
        const type = action === 'preview' ? await previewType(file) : 'application/octet-stream';
        if (!type) throw new TransferError(415, 'Preview unavailable for this format');
        const range = byteRange(req.headers.range, item.size);
        res.setHeader('Accept-Ranges', 'bytes'); res.setHeader('ETag', `"${item.sha256}"`);
        res.setHeader('Content-Type', type);
        res.setHeader('Content-Disposition', `${action === 'preview' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(item.name).replace(/'/g, '%27')}`);
        res.setHeader('Content-Length', range.end - range.start + 1);
        if (range.partial) res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${item.size}`);
        res.statusCode = range.partial ? 206 : 200;
        if (!item.size) { res.end(); return; }
        await pipeline(createReadStream(file, { start: range.start, end: range.end }), res); return;
      }
      throw new TransferError(405, 'Method not allowed');
    } catch (e) {
      if (res.headersSent || res.destroyed) { res.destroy(); return; }
      json(res, e instanceof TransferError ? e.status : 500, { error: e instanceof TransferError ? e.message : 'Storage operation failed; check available disk space' });
    }
  }
  const server = tls ? https.createServer(tls, handle) : http.createServer(handle);
  server.requestTimeout = 60000; server.headersTimeout = 15000; server.maxConnections = 64;
  return { server, store };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const key = process.env.MUTUAL_KEY || randomBytes(24).toString('base64url');
  const host = process.env.HOST || '127.0.0.1'; const port = Number(process.env.PORT || 8787);
  const cert = process.env.TLS_CERT; const privateKey = process.env.TLS_KEY;
  if (!!cert !== !!privateKey) throw new Error('TLS_CERT and TLS_KEY must be supplied together');
  const tls = cert ? { cert: await fs.readFile(cert), key: await fs.readFile(privateKey) } : undefined;
  if (!tls && !['localhost', '127.0.0.1', '::1'].includes(host) && process.env.MUTUAL_ALLOW_HTTP !== '1') throw new Error('LAN mode requires TLS, or explicitly set MUTUAL_ALLOW_HTTP=1 for a trusted-network development test');
  const { server } = await createServer({ root: process.env.DATA_DIR || './data', key, tls, allowedHosts: process.env.ALLOWED_HOSTS?.split(',').map(h => h.trim()) });
  server.listen(port, host, () => {
    console.log(`Mutual Transfer listening on ${host}:${port}`);
    if (!process.env.MUTUAL_KEY) console.log(`Workspace key (share only with intended devices): ${key}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); setTimeout(() => process.exit(0), 5000).unref(); });
}
