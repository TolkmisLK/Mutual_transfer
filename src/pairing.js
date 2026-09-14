import { createHash, randomBytes } from 'node:crypto';
import { TransferError } from './store.js';

// One-time, 80-bit capabilities. Only hashes remain in server memory; nothing
// is written to disk or placed in a URL. Restart invalidates unredeemed codes.
export class Pairings {
  constructor(now = Date.now) { this.now = now; this.entries = new Map(); }
  prune() { for (const [key, value] of this.entries) if (value.expiresAt <= this.now()) this.entries.delete(key); }
  digest(code) {
    if (typeof code !== 'string' || code.length > 32) return null;
    const normalized = code.replace(/[- ]/g, '').toLowerCase();
    return /^[a-f0-9]{20}$/.test(normalized) ? createHash('sha256').update(normalized).digest('hex') : null;
  }
  create(issuer) {
    this.prune();
    if (this.entries.size >= 64 || [...this.entries.values()].filter(e => e.issuer === issuer).length >= 4) throw new TransferError(429, 'Revoke unused pairing codes or wait for expiry');
    const raw = randomBytes(10).toString('hex'); const expiresAt = this.now() + 5 * 60000;
    this.entries.set(this.digest(raw), { issuer, expiresAt });
    return { code: raw.toUpperCase().match(/.{5}/g).join('-'), expiresAt };
  }
  consume(code, issuerActive) {
    this.prune(); const digest = this.digest(code); const entry = this.entries.get(digest);
    if (!entry || !issuerActive(entry.issuer)) throw new TransferError(401, 'Pairing code is invalid, expired or already used');
    this.entries.delete(digest); return entry.issuer;
  }
  revoke(issuer) { for (const [key, value] of this.entries) if (value.issuer === issuer) this.entries.delete(key); }
}
