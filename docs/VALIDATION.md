# Validation — 2026-09-14 (Asia/Shanghai)

Development preview, not a native-app or physical-device release acceptance.

## HTTPS candidate — CI pending

Added real TLS trust/hostname rejection, authenticated upload/download, secure-cookie logout and fail-closed configuration checks. They have not yet run for this candidate. The local execution environment was unavailable; do not treat remote source inspection as a passing local test. The prior HTTP and browser evidence below remains distinct. See [HTTPS.md](HTTPS.md) for deployment and trust boundaries.

## Automated service and browser checks

[PR #2 candidate CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34779873509), commit `0dcce5a8dad1be21ff328ae0e98a2f7d65a64aa0`:

- Ubuntu and Windows 2022: syntax checks and 19 service/integrity tests passed.
- Real Chromium: all 4 browser cases passed in 12 seconds, at 1280×900 desktop and 390×844 mobile viewports.
- Cases cover upload with source verification, literal (non-executable) text preview, byte-for-byte downloaded content, and aborting the second 4 MiB chunk followed by resuming the same upload ID without duplication.
- Downloaded browser artifact `10323644878`; inspected both actual `verified-workspace.png` captures. Chinese labels and content render, hash wraps at phone width, and actions remain visible. Native file picker text follows the browser locale. These are Chromium screenshots, not Android/iOS screenshots.

Reproduce on a clean checkout:

```sh
npm ci --ignore-scripts
npm run check
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

Browser fixtures use `.browser-test-data` and a test-only workspace key. For repeat local runs, remove only that fixture directory after the test server stops, or use a fresh checkout. Never point tests at your real `data` directory.

## Real large-file loopback acceptance

`node tool/large-transfer.js` passed locally on Linux x64 / Node v24.19.0. It writes and downloads actual bytes, not sparse-file metadata, and removes only its newly created temporary fixture afterward.

| Measurement | Actual result |
| --- | --- |
| Uploaded and downloaded bytes | 5,368,709,137 (5 GiB + 17 bytes) |
| Server reinitialized at persisted offset | 2,688,548,864 bytes |
| Source, server and streamed-download SHA-256 | `23c5cb586af09322602788f9ea37e8b6e955ad4eb91a63bb87e5e5b66a253190` |
| Elapsed, including hashing and download | 49.5 seconds |
| Sampled peak combined client/server RSS | 159 MiB; assertion below 768 MiB passed |
| Range past 4 GiB | Exact final 17 bytes verified |

This is one local-loopback measurement, not a LAN speed claim. The service is closed and reconstructed in the same Node process halfway through; this tests persisted state recovery, not an OS power failure. The generated chunks include their distinct offsets so reordering is detectable. Sampling is every 20 ms and is not a proof of memory usage under all workloads.

The opt-in command needs file size plus 1 GiB of free disk. It is not run in ordinary CI. `LARGE_TEST_BYTES` can select a smaller smoke fixture, but only a run with at least 5 GiB counts toward this gate.

## Remaining gates

Physical PC↔PC and mobile↔PC transfers; Wi-Fi loss and reconnection; HTTPS trust/pairing UX; mobile foreground/background behavior; native packaging and clean-machine installation; disk-full behavior and multi-device access permissions. Passing the above tests does not remove these gates.
