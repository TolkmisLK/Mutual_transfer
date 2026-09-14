# HTTPS deployment and trust

Mutual Transfer terminates TLS itself using Node.js HTTPS. HTTPS is required when binding outside loopback unless the operator explicitly enables insecure development mode. The server accepts TLS 1.2 or later; authentication and file bytes use the same encrypted origin. This is not a public multi-tenant service.

## Before exposing a LAN listener

1. Choose a stable DNS name or IP address. The server certificate's Subject Alternative Name must cover the exact address clients will open. A DNS-only certificate does not cover a numeric IP address.
2. Obtain a certificate from a CA already trusted by those clients, or have your administrator provision a dedicated private CA through the devices' supported trust-management settings. Verify the issuer and certificate fingerprint through a trusted channel. Do not bypass browser warnings or disable TLS verification.
3. Keep the private key on the server, outside the repository and download directory. Restrict its filesystem permissions. Never send the private key to receiving devices. Monitor certificate expiry and renew it before expiration.
4. Allow only the application port from intended LAN devices in the host firewall. Do not disable the firewall or expose this preview service through Internet port forwarding.

Example on Linux/macOS, using an already issued certificate and private key:

```sh
HOST=0.0.0.0 PORT=8787 \
TLS_CERT=/private/certs/transfer-fullchain.pem \
TLS_KEY=/private/certs/transfer-key.pem \
ALLOWED_HOSTS=transfer.example.internal \
DATA_DIR=/private/mutual-files npm start
```

Example in Windows PowerShell:

```powershell
$env:HOST='0.0.0.0'
$env:PORT='8787'
$env:TLS_CERT='C:\private\certs\transfer-fullchain.pem'
$env:TLS_KEY='C:\private\certs\transfer-key.pem'
$env:ALLOWED_HOSTS='transfer.example.internal'
$env:DATA_DIR='C:\private\mutual-files'
npm start
```

Open `https://transfer.example.internal:8787` on each intended device. The example name is a placeholder, not a provisioned service. `ALLOWED_HOSTS` contains comma-separated hostnames/IPs without schemes, ports, paths or wildcards; IPv6 entries use brackets. It is an HTTP Host allowlist, **not** a certificate trust setting or IP-based client access control. Custom allowlists replace the automatically detected local host list.

The console generates a new workspace key unless `MUTUAL_KEY` is supplied through the operator's environment. Share it only with intended members using a trusted channel, never in a URL. All members can read and delete the same workspace. Browser sessions are HttpOnly, SameSite=Strict and Secure over HTTPS; logout revokes the session and expires its cookie. Restart invalidates sessions, while file checkpoints remain on disk. The application does not encrypt stored files at rest.

A reverse proxy that terminates TLS and forwards plaintext is **not** an implemented trusted-proxy mode: the service does not trust forwarded headers or derive a secure origin from them. Use direct HTTPS as above; do not disable origin validation to make a proxy appear to work.

## Reproducible protocol checks

`npm test` includes a real HTTPS service test. It requires an OpenSSL executable (CI uses Linux OpenSSL or Git for Windows OpenSSL). It creates a fresh, one-day, loopback-only test certificate and private key in a new temporary directory, trusts that certificate only in the individual test requests, and deletes the fixture after closing the server. It never installs a CA into an OS/browser trust store, bypasses certificate validation, or uploads private keys as artifacts.

The test rejects an untrusted certificate and a mismatched server name; with explicit fixture trust, it checks negotiated TLS, secure login cookies, same-origin enforcement, verified upload, full/range download, logout and rejected reuse of the old session. Separate configuration tests reject insecure LAN defaults, half-configured TLS, invalid ports and ambiguous Host allowlists.

These are Node HTTPS protocol tests on CI hosts, not proof that real phones trust an operator's certificate. Physical PC/phone trust provisioning, Wi-Fi tests, pairing UX and native packaging remain separate gates. Execution evidence is recorded in [VALIDATION.md](VALIDATION.md).

Reference: [Node.js 24 HTTPS](https://nodejs.org/docs/latest-v24.x/api/https.html), [Node.js 24 TLS](https://nodejs.org/docs/latest-v24.x/api/tls.html).
