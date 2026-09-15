# Windows portable server preview

The portable ZIP bundles a pinned official Windows x64 Node runtime, application files and the browser hashing modules/licenses. You do not need to install Node or run npm on the destination computer. It is a **console-managed server with a browser UI**, not an Electron/Flutter native desktop client or a signed installer. Windows/Android/iOS native clients and physical-device acceptance are still separate launch gates.

1. Obtain the ZIP and matching `.sha256` from the same successful CI artifact. In PowerShell use `Get-FileHash path-to.zip -Algorithm SHA256` and compare the result to the checksum before extracting.
2. Extract the **whole folder**, not only `node.exe`. Open `START-WINDOWS.cmd` without administrator rights. The launcher clears inherited Node injection variables for its own process, does not change your system PATH and does not install a service.
3. A console prints the loopback URL and a private, freshly generated workspace key. Enter that key in the browser; the launcher opens the default browser only for a loopback HTTP configuration. Do not screenshot or share the console key broadly. Browser closure does not stop the server: type `stop` and Enter in the console or press Ctrl+C.
4. Files/resume checkpoints default to `%LOCALAPPDATA%\MutualTransfer\data`, outside the extracted program folder. Replacing the ZIP or restarting does not delete them. Back up this directory separately and stop the service before moving it. For complete removal, stop the service, remove the program folder, and delete the data directory **only if you intend to delete all stored files**.

The default listens on `127.0.0.1:8787`, so it is not yet reachable by phones. LAN use still requires operator-owned, trusted TLS certificates and a matching address on every client. Configure the existing `HOST`, `PORT`, `TLS_CERT`, `TLS_KEY`, `ALLOWED_HOSTS`, `MUTUAL_KEY` and optional `DATA_DIR` environment variables in the terminal before launching; see [HTTPS.md](HTTPS.md). No firewall or certificate trust settings are changed automatically. A port conflict is an error, not a reason to terminate another program. The portable launcher respects explicit data-directory configuration.

## Reproducible packaging and boundaries

On Windows with PowerShell 7 and locked npm dependencies installed:

```powershell
npm ci --ignore-scripts
pwsh -File tool/build-windows-portable.ps1
```

The script downloads [Node.js 24.21.0 LTS](https://nodejs.org/en/blog/release/v24.21.0) and verifies its Windows x64 ZIP against the checksum pinned from that official release. It does not claim independent PGP validation or application signing. The package retains Node and noble-hashes licenses, includes a per-file SHA-256 manifest and emits a separate ZIP checksum. Only allowlisted source/runtime files are copied: no workspace data, test identities, TLS keys, local settings or dev dependencies are packaged. The output is reproducibly assembled from pinned inputs, but ZIP timestamps mean archives are not claimed to be bit-for-bit reproducible.

The extracted-process Windows CI harness passed in [PR #6](https://github.com/TolkmisLK/Mutual_transfer/pull/6). Download the successful workflow's `mutual-transfer-windows-portable` artifact while retained; this is not a stable release download. [VALIDATION.md](VALIDATION.md) records the exact build/run, 23-file manifest verification, real packaged runtime upload/normal-stop/restart/resume/download and 4,259,841-byte integrity evidence. Consumer clean-machine startup, .cmd double-click/browser association, physical LAN transfer and OS security prompts still need real-machine acceptance; do not bypass SmartScreen or certificate warnings.
