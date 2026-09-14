# Validation — 2026-09-14 (Asia/Shanghai)

Development preview, not a native-app or physical-device release acceptance.

## Real HTTPS protocol acceptance — 2026-09-15 (Asia/Shanghai)

[PR #3 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34865814288), candidate `d17622be774b90b74620c487a34cdbc931ec8ae5`: Ubuntu and Windows 2022 each passed all 21 service/integrity/configuration tests. The four existing Chromium scenarios also passed (11.3 seconds).

The real HTTPS scenario passed in 546 ms on Ubuntu and 1,488 ms on Windows. Each generated a fresh one-day loopback certificate using OpenSSL; no system trust store was modified. Default certificate validation rejected the untrusted issuer and a mismatched hostname. Requests trusting only the fixture certificate negotiated TLS 1.2/1.3, authenticated with a Secure/HttpOnly/SameSite cookie, rejected an HTTP-origin mismatch and an unlisted HTTP Host, uploaded 65,537 random bytes with source/chunk SHA-256, verified full and Range downloads, and confirmed logout invalidated the original cookie.

The initial candidate failed because Node derived TLS servername from the deliberately unlisted HTTP Host before the service could apply its Host check. The corrected Host case explicitly retains the valid TLS name; the separate wrong-name TLS rejection remains intact. No certificate check or test gate was disabled.

The local execution environment was unavailable, so these are CI execution results, not local tests. No new browser screenshot inspection is claimed for this revision. This does not establish operator-issued certificate trust on physical phones or native pairing/installation. See [HTTPS.md](HTTPS.md) for deployment and trust boundaries.

## Real Linux disk-full recovery — 2026-09-15 (Asia/Shanghai)

[PR #4 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34866838925), candidate `e55354df3b5f43988e6877e0cc7d50994cb0c6e1`: the separate disk-full job, both 21-test platform jobs and all four browser scenarios passed.

The disk-full job mounted a new 16,777,216-byte tmpfs and obtained real kernel ENOSPC. A failed second chunk left the first 4 MiB checkpoint unchanged; failed creation released its in-memory reservation. Incomplete data could not be downloaded. After releasing fixture capacity and reconstructing the service, the upload resumed. Exhausting space again at the completion-metadata checkpoint did not mark the file complete. A final free-space/restart/finish/download cycle reproduced the source SHA-256 over 8 MiB of actual data. All five JSON evidence flags were true. The exit trap unmounted only the generated temporary fixture.

This covers real full-filesystem behavior on Linux tmpfs, not physical-media failure, power loss or Windows full-disk acceptance. See [DISK-FULL.md](DISK-FULL.md). There was no local runtime for this run; the kernel/service execution occurred in CI.

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

Physical PC↔PC and mobile↔PC transfers; Wi-Fi loss and reconnection; HTTPS trust/pairing UX; mobile foreground/background behavior; native packaging and clean-machine installation; Windows disk-full/physical-storage failure behavior and multi-device access permissions. Passing the above tests does not remove these gates.
