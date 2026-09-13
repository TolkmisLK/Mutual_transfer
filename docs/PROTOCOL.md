# Protocol v0 — unstable development contract

All `/api` operations require a valid workspace session cookie or `Authorization: Bearer <workspace key>`, except session creation. Keys never belong in URLs. TLS is required outside an explicit trusted-network development test. A workspace is a single trust group, not a user account system.

| Method / path | Request | Result |
| --- | --- | --- |
| POST /api/session | JSON `{key}` | HttpOnly SameSite=Strict session, one hour |
| DELETE /api/session | Session cookie | Revoke current session |
| GET /api/transfers | — | Files, offsets and chunk size |
| POST /api/transfers | JSON `{name,size}` | New random ID; capacity reserved |
| GET /api/transfers/:id | — | Persisted offset / completion state |
| PUT /api/transfers/:id/chunk | Raw bytes, Content-Length, Upload-Offset | Persist new offset; maximum 4 MiB |
| POST /api/transfers/:id/finish | — | Complete only at expected length; streamed SHA-256 |
| GET /api/transfers/:id/download | Optional single Range | Attachment stream, 200 or 206 |
| GET /api/transfers/:id/preview | Optional single Range | Allowlisted magic bytes only; no HTML/SVG |
| GET /api/transfers/:id/text | — | Plain text inside JSON, maximum 64 KiB |
| DELETE /api/transfers/:id | — | Delete file and reservation |

On 409, re-read the persisted offset; do not blindly resend at a stale position. If a chunk response is lost, the server may already have committed it. Restart truncates uncommitted trailing bytes back to the saved offset. Completion is idempotent. Final hashing streams from disk; it does not load the complete file in memory.

The data directory is private application state. Run one server process against it; do not mount it into multiple writable servers. Metadata and data must be backed up together with the service stopped. Files are not encrypted at rest by this application; use host disk encryption where required.
