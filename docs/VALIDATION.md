# Validation — 2026-09-14 (Asia/Shanghai)

## Selective paired-session management — 2026-09-16 (Asia/Shanghai)

PR #11 candidate `fabcdcac0f013cc28548b70a19e8104f9edb80b1` passed [CI 35091510353](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35091510353): all five jobs succeeded, including Linux/Windows service tests, real disk-full recovery and Windows portable-package acceptance. Linux reports 33 passing tests. Chromium passed all 12 scenarios in 25.9 seconds; the new desktop and mobile-viewport scenarios each took 1.4 seconds.

Owner-only listing and individual revocation use independent management IDs, optional untrusted device names, explicit confirmation/retry and stale-dialog guards. Real HTTP/browser cases verify cancellation sends no DELETE, a failed request can be retried, only the chosen guest loses access, another guest retains byte-verified file access, and a late list response cannot reopen a closed dialog. The earlier browser teardown race was fixed by waiting for the held response before removing its route; production rate limits and assertions were not weakened.

Downloaded browser artifact `10443979543` and inspected the actual mobile-viewport paired-session dialog: the remaining device and individual revoke action fit, and the completion notice states that other sessions remain. This is Chromium viewport evidence, not a physical phone. Local real-service tests remain blocked by abstract Unix socket EPERM; the data ownership guard was retained. Device names are not verified identities, in-flight authorized requests may finish, and revocation cannot erase downloaded copies.

Development preview, not a native-app or physical-device release acceptance.

## Installable Web and private offline fallback — 2026-09-16 (Asia/Shanghai)

Added a root-scoped Web App Manifest, icon, explicit browser installation prompt and a network-only service worker. Three new pure tests and syntax checks pass locally. The worker does not cache or intercept APIs/files; it returns only static reconnection instructions for failed exact-root navigation.

[PR #10 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35029120732), candidate `550859c99726005d789314d98b97afb90262e745`: all five jobs passed, including 32 tests on each platform, ten real Chromium scenarios in 22.5 seconds, real ENOSPC recovery and the Windows portable harness. The new desktop/mobile-viewport cases took 4.2/4.1 seconds: after worker control they interrupted a 9 MiB upload at 4 MiB, went offline, verified that the fallback contains no filename/credential and CacheStorage remains empty, then reconnected and resumed the original transfer ID to the exact final SHA-256. Offline API access failed rather than using cached private data.

The Windows package verified 32 manifest files and served the four new public assets, while retaining the real CMD launcher and 4,259,841-byte restart/resume checks. Browser artifact `10420503327` was downloaded; the actual mobile-viewport private fallback and post-reconnection installation-guide screenshots were inspected. Main CI `35029389650` also passed after merge. These are browser viewport tests, not Android/iOS OS installation, physical Wi-Fi or background-transfer acceptance. See [INSTALLABLE-WEB.md](INSTALLABLE-WEB.md).

## Windows command launcher — 2026-09-15 (Asia/Shanghai)

[PR #9 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34926656324), candidate `b5b50e7e9e9f775d97a37df31564cfe0dce3a464`: all five jobs passed. The Windows portable harness invoked the packaged START-WINDOWS.cmd through the real system command interpreter from a different working directory, with the bundle in a path containing spaces. It verified preserved file access, removal of inherited Node startup options, normal stdin stop and a deliberately invalid PORT returning exit code 1 through the batch pause. JSON flags commandLauncherTested, inheritedNodeOptionsCleared and commandFailureExitPreserved were all true; the existing 4,259,841-byte restart/resume and 28-file manifest checks also passed. Browser association and Explorer double-click remain separate consumer-machine checks; this was CI command execution, not a desktop click.

## Paired-session revocation — 2026-09-15 (Asia/Shanghai)

[PR #8 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34925825285), candidate `083799329e1fb25815fa0f08dad58191cf51556e`: all five jobs passed. Ubuntu and Windows each passed 29 tests; eight browser cases passed in 13.9 seconds, with the two new revocation scenarios taking 892/894 ms. Existing portable-package and real ENOSPC gates also passed. The HTTP regression checks two independent owner/guest pairs, guest/bearer/origin denial, preserved owner sessions/files, idempotence and re-pairing. Browser cases cover cancellation without a request, confirmation, rejected guest refresh, retained uploaded content and a new invitation.

The initial browser suite shared one service and exhausted the legitimate per-IP login budget across unrelated scenarios. Each scenario now creates its own real server and data directory; production rate limits and replay assertions remain unchanged. Artifact `10380102181` was downloaded and the actual owner mobile-viewport revocation screenshot inspected: controls wrap, retained file/checksum remain visible and the confirmation count is shown. Local syntax checks pass; local service execution still cannot bind this sandbox's required IPC guard. See [PAIRING.md](PAIRING.md) for already-authorized request and retained-copy limits.

## Exclusive data ownership — 2026-09-15 (Asia/Shanghai)

[PR #7 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34922254993), candidate `00adfa3d07a2a1c789b140b847ea3511ffab8ab9`: all five jobs passed. Ubuntu and Windows each passed 28 tests, including actual OS ownership, path aliases, failed initialization cleanup and real child-process contention/forced-exit recovery (423/460 ms). The competing process was rejected before truncating a modeled live tail; killing only the fixture owner freed the guard, and a new process recovered the committed checkpoint. This is process-exit acceptance, not power-loss durability.

Six browser scenarios passed (12.1 seconds), as did real ENOSPC recovery and the actual Windows portable-process harness. The new bundle's 28 manifest files verified; its 4,259,841-byte restart/resume/download check still passed. No new screenshot inspection or physical-device result is claimed. Syntax checks pass locally, but this sandbox rejects Linux abstract-socket binding with EPERM, so local service execution with the guard remains unavailable; no bypass was used. See [DATA-OWNERSHIP.md](DATA-OWNERSHIP.md).

## Windows portable server — 2026-09-15 (Asia/Shanghai)

[PR #6 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34898643333), candidate `bbe2fe618bab9d2781953af14f0572c611222928`: all five jobs passed, including the new actual Windows package/process harness, 25 tests on each platform, six browser scenarios and disk-full regression. Local 25 tests and syntax checks also passed.

The Windows x64 bundle pins Node 24.21.0 with its official published ZIP checksum. The job verified the produced ZIP, extracted to a path containing spaces, checked 23 manifest files and no extra payload, and confirmed the executed runtime's absolute path/version/architecture. The real packaged process logged in, uploaded a 4 MiB first block, exited normally on stdin `stop`, restarted with a new workspace key and invalidated the old cookie, resumed 65,537 remaining bytes and downloaded all 4,259,841 bytes with an identical SHA-256. Data lived under an isolated LOCALAPPDATA fixture, outside the bundle; an unrelated marker stayed unchanged. No system Node executable was used for the service child process.

Artifact `10370215703` contains the portable ZIP, its SHA-256 and `windows-portable-validation.json`. The JSON explicitly marks browser auto-open, clean-machine and physical-LAN checks false. This is a console-managed server with browser UI, not a native desktop/mobile GUI or signed release. The .cmd double-click/browser association still requires consumer-machine acceptance. See [WINDOWS-PORTABLE.md](WINDOWS-PORTABLE.md).

## Temporary pairing — 2026-09-15 (Asia/Shanghai)

[PR #5 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34897925521), candidate `214f3660ba174c91d3ef5a93b1ed1b5a59616f8f`: all four jobs passed, with 24 tests on each of Ubuntu and Windows, six browser scenarios (14.3 seconds) and the real ENOSPC regression. Local 24 tests and syntax checks also passed. Tests include hashed one-time capability expiry/limits, concurrent HTTP redemption, restricted invitation privileges, issuer logout/revocation and rate limiting. The real TLS case pairs a separate Secure-cookie session and downloads the verified file with certificate validation enabled.

The new browser scenario passed in both projects (863/916 ms): an independent 390-pixel context joins with a single-use code, uploads bytes that the owner downloads exactly, cannot create another invitation through either UI or API, and cannot replay the original code after logout. The initial browser attempt exposed a test race reading the code before the API response, plus a cleanup wait on a hidden input. Explicit response-visible waiting and non-interactive cleanup fixed both without weakening protocol assertions. Browser tracing is now disabled to avoid authentication material in artifacts.

Artifact `10369477132` was downloaded and the actual paired and owner phone-viewport screenshots were inspected. The paired page lacks invitation controls; the owner toolbar, file checksums and actions fit the narrow viewport. These are real Chromium renders, not physical-phone or trusted-LAN certificate acceptance. See [PAIRING.md](PAIRING.md).

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

Browser fixtures now create an independent real server, ephemeral loopback port and temporary data directory for each scenario, using a test-only workspace key. Teardown closes that server and removes only its generated directory. Authentication rate limits are unchanged; scenarios cannot consume each other's login budgets. Never point tests at your real `data` directory.

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
