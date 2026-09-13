# Acceptance roadmap

## 1. Recoverable transport — implemented, development preview

Persistent chunk offsets, bounded buffering, unique on-disk names, quota reservation, restart recovery, completion hashing, authenticated HTTP operations and browser clients. Ten local tests pass; remote CI result must be checked separately.

## 2. Usable cross-device application — next

- Browser interaction tests at phone and desktop widths, including interruption/resume and original/downloaded hash comparison.
- Cancellation and cleanup of abandoned uploads, progress speed/ETA, expired-session recovery and clear error translations.
- Sender-side streaming hash verification and per-device acceptance/permissions.
- TLS setup helper and pairing via an expiring invitation/QR code, without weakening the current host/origin checks.
- Package a desktop host; create a mobile client supporting share sheets and a documented foreground/background lifecycle.

## 3. Release gates

- Windows/macOS/Linux desktop build and Android package CI; iOS signing/device testing requires an authorized Apple environment.
- PC → PC, Android → PC, PC → Android; iOS browser/native support must be recorded separately.
- Transfer at least 5 GiB, compare hashes, measure bounded memory, stop/restart server and interrupt Wi-Fi during transfer.
- Disk-full, quota-full, filename collision, duplicate chunk, authentication expiry, hostile Origin/Host, malicious filename and unsupported preview tests.
- Verify clean-machine install, uninstall, TLS trust and first-run pairing documentation.
- Publish signed/verified artifacts only when their actual platform gates pass. No paid hosting, account purchase or signing identity invention.

## Later

Direct peer transfers, discovery with explicit consent, offline queues, folder transfers, workspace permissions and richer safe previews. Preserve arbitrary-file support; preview support does not determine which files may be transferred.
