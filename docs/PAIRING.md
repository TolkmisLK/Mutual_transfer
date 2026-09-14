# Temporary device pairing

Sign in on a trusted device with the workspace key, then select **配对新设备**. On the new device, open the same trusted HTTPS address and enter the displayed **临时配对码**. Codes have 20 hexadecimal characters grouped for manual entry; they expire after five minutes and can be redeemed once. A paired browser receives its own HttpOnly, SameSite=Strict, Secure (on HTTPS), one-hour cookie. Neither the workspace key nor the code is saved to browser storage or added to a URL.

Pairing does **not** establish certificate trust. Use a trusted certificate matching the server address on every device, following [HTTPS.md](HTTPS.md); never dismiss certificate warnings. Pairing endpoints reject non-loopback plaintext connections even if unsafe HTTP development mode is explicitly enabled. This is manual code entry, not QR discovery, native-device pairing or a claim of physical-phone acceptance.

## Scope and revocation

All admitted members can upload, read and delete **all files** in the shared space. This is not per-user isolation or a read-only invitation. Only sessions authenticated with the long-lived workspace key can create/revoke pairing codes; paired sessions cannot invite additional devices. A bearer workspace key must first create a login session to manage pairing.

Closing the pairing dialog revokes **all unused codes issued by that login session**. Logging out or expiring that issuer session also prevents unused codes from being redeemed. Already redeemed sessions remain valid until they log out, reach their one-hour expiry, or the server restarts. Revoking unused codes is not remote logout. Restart invalidates all sessions/codes but does not delete transferred files. Keep the workspace key private; rotating configuration and restarting is required if it is compromised. Device-by-device remote session revocation remains future work.

## Implementation and verification

Each code is generated from 10 cryptographically random bytes (80 bits); only its SHA-256 digest and issuer/expiry remain in bounded server memory. At most four outstanding codes per issuer and 64 overall are allowed. Expired entries are pruned, and redemption consumes a code synchronously before issuing the new cookie, so concurrent redemption grants one session. The existing login rate limiter is shared with pairing (12 attempts per source address per minute). These limits also permit a malicious same-network peer to temporarily deny login; no distributed attack protection is claimed.

Tests cover expiry at the exact boundary, quotas, revocation, malformed codes, inactive issuers, concurrent HTTP redemption, paired-session privileges, origin rejection and rate limiting. The HTTPS integration case checks a separately paired Secure cookie and verified-file download with real certificate validation. Browser cases cover a separate phone-sized context uploading to the owner's context, exact downloaded bytes, inability to delegate, and replay rejection. CI/browser evidence is recorded in [VALIDATION.md](VALIDATION.md); test source alone is not execution evidence.
