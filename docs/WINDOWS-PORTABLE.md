# Windows portable server preview

Windows 便携服务公开预览包：[windows-v0.1.0-preview.1](https://github.com/TolkmisLK/Mutual_transfer/releases/tag/windows-v0.1.0-preview.1)；[发布与校验说明](PREVIEW-RELEASE.md)。 / Public Windows portable server preview and its checksum: [windows-v0.1.0-preview.1](https://github.com/TolkmisLK/Mutual_transfer/releases/tag/windows-v0.1.0-preview.1).

[中文说明](#zh)

The packaged command entry is exercised by Windows CI, including space-containing paths, normal stop and failure exit codes. This does not yet establish Explorer double-click behavior or the user's default browser association; see [VALIDATION.md](VALIDATION.md).

The portable ZIP bundles a pinned official Windows x64 Node runtime, application files and the browser hashing modules/licenses. You do not need to install Node or run npm on the destination computer. It is a **console-managed server with a browser UI**, not an Electron/Flutter native desktop client or a signed installer. An Android preview client exists separately; physical-device acceptance and stable native releases remain separate launch gates.

1. Open the [public Windows preview release](https://github.com/TolkmisLK/Mutual_transfer/releases/tag/windows-v0.1.0-preview.1) and download both `mutual-transfer-0.1.0-preview-windows-x64.zip` and its `.sha256` file. In PowerShell use `Get-FileHash path-to.zip -Algorithm SHA256` and compare its output with the first 64 characters of the `.sha256` file before extracting. This release contains no Android APK and does not update it; the separate [android-v0.1.1-preview prerelease](https://github.com/TolkmisLK/Mutual_transfer/releases/tag/android-v0.1.1-preview) remains available. For an APK matching a newer source commit, use a successful [Android main CI](https://github.com/TolkmisLK/Mutual_transfer/actions/workflows/android.yml) artifact.
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

The historical extracted-process Windows CI harness passed in [PR #6](https://github.com/TolkmisLK/Mutual_transfer/pull/6). [VALIDATION.md](VALIDATION.md) records that 23-file build and the current preview's 42-file manifest, 15 Markdown files, 77 resolved local links and packaged runtime checks. The current [release workflow](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/38729300825) published the checked ZIP and checksum. Consumer clean-machine startup, .cmd double-click/browser association, physical LAN transfer and OS security prompts still need real-machine acceptance; do not bypass SmartScreen or certificate warnings.

<a id="zh"></a>

## 中文：Windows 便携服务预览版

Windows CI 已测试打包后的命令入口，包括带空格的路径、正常停止和失败退出码；尚不能据此认定资源管理器双击行为或用户默认浏览器关联已通过，详见 [VALIDATION.md](VALIDATION.md)。

便携 ZIP 内含固定版本的官方 Windows x64 Node 运行时、应用文件，以及浏览器哈希模块与许可证。目标电脑无需安装 Node 或运行 npm。它是**通过控制台管理、浏览器提供界面的服务端**，不是 Electron/Flutter 原生桌面客户端或签名安装程序。Android 预览客户端已另行实现；实体设备验收和稳定原生版发布仍有独立门禁。

1. 打开[公开的 Windows 预览版](https://github.com/TolkmisLK/Mutual_transfer/releases/tag/windows-v0.1.0-preview.1)，同时下载 `mutual-transfer-0.1.0-preview-windows-x64.zip` 与对应 `.sha256`。在 PowerShell 执行 `Get-FileHash path-to.zip -Algorithm SHA256`，与 `.sha256` 文件开头 64 个字符比对，确认后再解压。本轮发布既不包含也不更新 Android APK；另有[公开的 android-v0.1.1-preview 预览版](https://github.com/TolkmisLK/Mutual_transfer/releases/tag/android-v0.1.1-preview)。如需与较新源码提交对应的候选 APK，再从成功的 [Android main CI](https://github.com/TolkmisLK/Mutual_transfer/actions/workflows/android.yml) 获取 Artifact。
2. 解压**整个文件夹**，不能只取 `node.exe`。无需管理员权限即可打开 `START-WINDOWS.cmd`。启动器只为自身进程清除继承的 Node 注入环境变量，不修改系统 PATH，也不安装系统服务。
3. 控制台会显示 loopback 地址和新生成的私有工作区密钥。浏览器中输入该密钥；只有 loopback HTTP 配置下，启动器才会自动打开默认浏览器。不要大范围截图或分享控制台密钥。关闭浏览器不会停止服务；需在控制台输入 `stop` 后按 Enter，或按 Ctrl+C。
4. 文件和续传检查点默认存于 `%LOCALAPPDATA%\MutualTransfer\data`，位于解压程序目录之外。替换 ZIP 或重启不会删除它们。请单独备份该目录，移动前先停服务。完全移除时，先停服务，再删除程序目录；**只有确实要删除全部已存文件时**才删除数据目录。

默认监听 `127.0.0.1:8787`，手机无法直接访问。局域网使用仍要求运维方自有、可信的 TLS 证书，并且每个客户端访问地址都与证书匹配。启动前在终端设置已有的 `HOST`、`PORT`、`TLS_CERT`、`TLS_KEY`、`ALLOWED_HOSTS`、`MUTUAL_KEY` 和可选 `DATA_DIR` 环境变量；见 [HTTPS.md](HTTPS.md)。程序不会自动修改防火墙或证书信任设置。端口冲突应作为错误处理，不能因此终止别的程序。便携启动器会尊重显式配置的数据目录。

如果设置 `HOST=0.0.0.0` 或 `HOST=::`，控制台显示的是监听范围，不是可供手机输入的 URL。手机应输入证书覆盖、系统信任的服务主机名或 IP 及配置的端口；证书不匹配时先修复地址或证书，不能跳过警告。便携启动器在局域网模式下不会自动打开浏览器。

### 可复现打包与范围

在安装 PowerShell 7 和锁定 npm 依赖的 Windows 环境中运行：

```powershell
npm ci --ignore-scripts
pwsh -File tool/build-windows-portable.ps1
```

脚本下载 [Node.js 24.21.0 LTS](https://nodejs.org/en/blog/release/v24.21.0)，按该官方版本固定的校验和验证 Windows x64 ZIP；没有声明独立完成 PGP 验证或应用签名。包中保留 Node 与 noble-hashes 许可证、逐文件 SHA-256 清单，并另行输出 ZIP 校验和。只复制白名单内的源码和运行时文件；不打包工作区数据、测试身份、TLS 密钥、本地设置或开发依赖。可由固定输入重复组装，但 ZIP 时间戳意味着不保证归档逐字节相同。

历史上的解压进程 Windows CI 测试在 [PR #6](https://github.com/TolkmisLK/Mutual_transfer/pull/6) 通过。[VALIDATION.md](VALIDATION.md) 分别记录当时 23 个文件的构建，以及本次预览版 42 个清单文件、15 份 Markdown、77 处相对链接和打包进程检查。当前[发布工作流](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/38729300825)已公开校验过的 ZIP 与摘要文件。消费级全新电脑启动、`.cmd` 双击及浏览器关联、真实局域网传输和操作系统安全提示仍需实体机器验收；不得绕过 SmartScreen 或证书警告。
