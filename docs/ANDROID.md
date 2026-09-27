# Android client development preview

[中文使用步骤](#zh-steps) · [中文实现与验收边界](#zh)

<a id="zh-steps"></a>

Android 预览版 `0.1.1-preview` 的使用步骤：

1. 在 Android 8.0 或更新设备上安装项目提供的预览 APK，并确认系统 WebView 已更新。
2. 在另一台设备启动 Mutual Transfer HTTPS 服务，确保手机信任其证书，且地址中的主机名与证书一致。
3. 在应用顶部输入服务地址（如 `https://files.example.test:8787`），点击「连接」，再用共享密钥或配对码登录。
4. 上传时点击页面的文件选择按钮，通过系统文件选择器选取文件，等待显示校验完成。
5. 下载时点击文件行的下载链接，在系统界面选保存位置，等待应用显示 SHA-256 校验完成。

传输期间请保持应用在前台。

「取消下载」会停止当前保存。下载先暂存在应用私有缓存中，完整校验后才写入所选位置；校验失败时会尝试删除系统选择器创建的空文件。若写入目标文件已开始后发生错误或取消，应用会提示手动删除可能不完整的文件，避免在系统文件提供器尚未完成关闭回调时立即删除。「断开并清理」会清除本应用网页会话；若系统保存界面已打开，返回的旧保存结果也会尝试清理新建的空文件。重新连接后可正常发起新的保存；上传中断可重新选择相同源文件续传，下载中断需从头开始。此版本仍是预览版；独立实体设备、后台传输和系统进程终止后的清理尚未验证或支持。

Normal Activity destruction invalidates active and queued saves, disconnects active HTTPS and drains accepted tasks so each can attempt removal of its own incomplete document. It does not discard queued saves with `shutdownNow`. This is not a guarantee after OS process death or for a provider that blocks indefinitely; no background transfer service is added. The queue-ordering regression passed as a controlled JVM test in CI, alongside existing real Android HTTPS/document-provider cases; full rotation/background acceptance remains outstanding.

The `android/` project packages the existing responsive file-space interface in an Android WebView with native document selection and a bounded, checksum-verified download path. It is a client for an already-running Mutual Transfer server, not an Android file server or background transfer service.

## Connect and transfer

Use Android 8.0 (API 26) or newer with an up-to-date system WebView. Enter the server HTTPS origin, for example `https://files.example.test:8787`, then connect and sign in with a workspace key or temporary pairing code. Plain HTTP, embedded credentials and address paths/query strings are rejected. The system must trust the certificate and its hostname; an explicitly installed user CA is supported for a private network. SSL errors cannot be bypassed.

Choose files through Android's document picker (up to 100 in one selection), then keep the application in the foreground. Downloads ask for a new document location and stream with a 64 KiB buffer, a 100 GiB bound, and exact SHA-256/length verification through a private temporary file. Redirected downloads are rejected. Failures before destination writing attempt to remove the empty document; failures after writing starts leave the possibly incomplete document for manual deletion. Uploads use the existing web chunk/resume protocol. Re-select the same source file to resume an interrupted upload. Downloads currently restart from the beginning.

**断开并清理** clears this application's web cookies/cache/storage and cancels its local pending work. It does not revoke already-issued server sessions on other devices. Use the server's paired-session controls for remote revocation. A process restart or activity recreation opens a fresh address-entry screen; no saved origin/key or background-resume guarantee is provided.

## Boundaries

Only INTERNET permission is declared; no broad filesystem, camera, microphone or gallery access is requested. Explicitly selected content URIs are checked before being passed to the WebView, and providers belonging to this app are refused. JavaScript supports the existing app, with no native JavaScript bridge. File/content URL access, mixed content, third-party cookies, popups and web permission prompts are disabled. Downloads use validated same-origin URLs and cookies, normal certificate verification and no automatic redirects.

The debug APK is signed with an ephemeral CI debug key. It is not a stable release, store distribution, a persistent signing identity or an update channel. Future builds may need uninstall/reinstall. Local services, downloaded files and browser sessions are separate from this app's installation.

## Build and evidence

The Android reliability gate runs `node tool/android-repeat.js`: exactly three complete instrumentation rounds on one API 35 emulator. Each round forces Gradle tasks to execute, and starts and cleans up a fresh HTTPS fixture with new credentials and certificate. The first failure stops the gate with its nonzero exit status; a later pass cannot replace it. Logs identify the round without adding credentials or raw crash messages. Successful build artifacts contain the final round's reports/screenshots; all round outcomes remain in the CI log. Check the latest Android workflow run for the current result. Three rounds on one emulator do not establish behavior on independent devices or prove the cause of the earlier intermittent instrumentation crash.

Use JDK 17, Gradle 9.3.1, AGP 9.1.1 and Android SDK 36. Run `gradle --no-daemon -p android testDebugUnitTest lintDebug assembleDebug`. The Android workflow additionally runs the actual activity on an API 35 emulator, checks its restricted WebView settings and plaintext-address rejection, and captures the native screen.

Candidate `75a384b` passed Android CI `35222593464`: compilation, five JVM tests, lint (six warnings, no errors), an API 35 emulator activity/security test and debug APK creation. Its actual screenshot was downloaded and reviewed; the APK SHA-256 matched and ZIP integrity passed. The preceding failure was screenshot extraction after UTP removed app-scoped files; test-only shell capture now survives that cleanup. Follow-up changes added explicit cloud/device-transfer exclusions, an installed-resource regression, a launcher icon, legible status-bar icons and request-policy race protection; these passed with `a81fb65c` in CI `35224143633`. The JavaScript/user-CA lint warnings reflect intentional, documented client behavior, not a security certification.

The current local environment has a Java runtime but no javac, Gradle or Android SDK; no local Android build is claimed. Real trusted-LAN login, Android document-provider upload/download, Wi-Fi interruption, certificate enrollment, activity rotation, background/lock-screen behavior and physical-device installation remain separate unaccepted gates. Explicit backup exclusions cover this application's local state, not files the user saved through another document provider; that provider's backup policy is outside this app's control.

References: [AGP compatibility](https://developer.android.com/build/releases/agp-9-1-0-release-notes), [file chooser validation](https://developer.android.com/reference/android/webkit/WebChromeClient.FileChooserParams).

## Isolated HTTPS interoperability gate

The additional `acceptance` build type has a distinct application ID and trusts one generated, one-day CI certificate. Its public certificate exists only in that source set; its private key remains in a new private temporary server directory. Neither the acceptance APK nor test assets/credentials are uploaded. The ordinary debug APK is built and tested separately and checked not to contain the test certificate or connection asset. No CA is installed into the emulator/system and no trust manager or hostname verifier is replaced.

Candidate `a81fb65c` passed Android CI `35224143633`: the emulator loaded the actual Node service through HTTPS, logged in through the shipped WebView page, invoked its upload handler with a generated 4 MiB + 65,537 byte File, and verified a native HTTPS download through the production streaming checksum helper. A second address forwarded to the same server failed TLS hostname verification. Disconnect cleared the client cookie. This is not an Android document picker/provider acceptance, a production-certificate enrollment test, physical Wi-Fi transfer, or a claim that the acceptance APK can be distributed. Exact evidence and remaining gates are in [VALIDATION.md](VALIDATION.md).

PR #13 candidate `9cb04013` additionally passed actual DocumentsUI/Downloads-provider selection and native create-document saving in Android CI `35283340505` (11.576 seconds). A unique 65,537-byte provider fixture was uploaded; the production Activity's verified-save status and independently read destination bytes matched. Only generated source/destination files were cleaned up. The actual native screenshot was reviewed. This closes the emulator Downloads-provider gate, not other/cloud providers, permission revocation, cancellation, rotation, physical Wi-Fi or production certificate enrollment.

<a id="zh"></a>

## 中文：客户端实现与验收边界

Activity 正常销毁时，会使正在进行及排队中的保存失效、断开活动 HTTPS 请求，并排空已经接收的任务，让每个任务尝试删除自己的不完整文档；不会以 `shutdownNow` 直接丢弃排队保存。这不保证操作系统终止进程后仍能清理，也不能处理无限阻塞的文档提供器；没有增加后台传输服务。队列顺序回归在 CI 中作为受控 JVM 测试通过，同期已有真实 Android HTTPS/文档提供器场景；完整旋转与后台验收仍未完成。

`android/` 项目把现有响应式文件空间界面装入 Android WebView，增加原生文档选择和有界、带校验和验证的下载流程。它是连接已有 Mutual Transfer 服务的客户端，不是 Android 文件服务器或后台传输服务。

### 连接与传输

要求 Android 8.0（API 26）或更新版本，系统 WebView 应保持更新。输入 HTTPS 服务来源（如 `https://files.example.test:8787`），点击连接，再用工作区密钥或临时配对码登录。应用拒绝明文 HTTP、嵌入凭据，以及带路径或查询参数的地址。系统必须信任证书和对应主机名；私有网络可显式安装用户 CA。不能绕过 SSL 错误。

通过 Android 系统文档选择器选文件，一次最多 100 个；传输时保持应用在前台。下载时选择新建文档位置，应用使用 64 KiB 缓冲、100 GiB 上限和私有临时文件，精确校验长度与 SHA-256 后再保存。重定向下载会被拒绝。开始写入目标前出错时，应用会尝试移除空文档；写入后出错时，可能留下不完整文档，需要手动删除。上传沿用网页分块续传协议；中断后重新选择同一源文件即可续传。下载中断后目前从头开始。

**断开并清理** 会清理本应用网页 Cookie、缓存与存储，并取消本地待处理工作；不会撤销其他设备已取得的服务器会话。远程撤销应使用服务端的配对会话管理。进程重启或 Activity 重建后会回到新的地址输入界面；不会保存来源/密钥，也不保证后台续传。

### 安全边界

应用只声明 `INTERNET` 权限，不请求宽泛文件系统、相机、麦克风或相册权限。显式选择的 content URI 在交给 WebView 前经过校验，并拒绝属于本应用提供器的 URI。JavaScript 仅用于现有网页应用，没有原生 JavaScript Bridge。文件/content URL 访问、混合内容、第三方 Cookie、弹窗和网页权限提示均被禁用。下载只使用校验过的同源 URL 与 Cookie、正常证书验证，并禁止自动重定向。

Debug APK 使用临时 CI 调试密钥签名，不是稳定 Release、应用商店版本、长期签名身份或更新渠道。未来构建可能需要卸载重装。本地服务、下载文件和浏览器会话与 APK 安装各自独立。

### 构建与证据

Android 可靠性门禁运行 `node tool/android-repeat.js`：在同一台 API 35 模拟器上严格执行三轮完整仪器测试。每轮强制 Gradle 任务实际执行，并以新凭据和新证书启动、清理独立 HTTPS 测试服务。首轮失败即以非零状态停止，后续通过不能覆盖它。日志标明轮次，不额外打印凭据或原始崩溃消息。成功构建产物包含最后一轮的报告和截图，所有轮次结果保留在 CI 日志。当前结果应查看最新 Android 工作流。单台模拟器上的三轮测试既不证明独立实体设备表现，也不能证明先前偶发仪器崩溃的根因。

使用 JDK 17、Gradle 9.3.1、AGP 9.1.1 和 Android SDK 36。构建命令为 `gradle --no-daemon -p android testDebugUnitTest lintDebug assembleDebug`。Android 工作流还在 API 35 模拟器上实际启动 Activity，检查受限 WebView 设置和明文地址拒绝，并采集原生画面。

候选提交 `75a384b` 在 Android CI `35222593464` 通过：编译、五项 JVM 测试、Lint（六项警告、无错误）、API 35 模拟器 Activity/安全测试及 Debug APK 构建。真实截图已下载审阅；APK SHA-256 一致且 ZIP 完整性通过。前一次失败发生在 UTP 删除应用作用域文件后的截图提取；仅调整测试截图采集后可保留该文件。随后添加了明确的云端/设备传输排除说明、已安装资源回归、启动图标、可读的状态栏图标及请求策略竞争保护；`a81fb65c` 在 CI `35224143633` 通过。JavaScript 和用户 CA 的 Lint 警告对应明确记录的客户端行为，**不是安全认证**。

当时本地环境有 Java 运行时，但没有 javac、Gradle 或 Android SDK，因此没有声称本地 Android 构建。可信局域网登录、Android 文档提供器上传/下载、Wi-Fi 中断、证书安装、Activity 旋转、后台/锁屏及实体设备安装仍属独立、尚未接受的门禁。明确的备份排除只覆盖本应用本地状态；通过其他文档提供器保存的文件由该提供器自身备份政策决定。参考：[AGP 兼容性](https://developer.android.com/build/releases/agp-9-1-0-release-notes)、[文件选择器校验](https://developer.android.com/reference/android/webkit/WebChromeClient.FileChooserParams)。

### 隔离 HTTPS 互通门禁

额外的 `acceptance` 构建类型具有独立应用 ID，只信任 CI 生成的一张有效期一天的证书。公开证书仅在该源码集里；私钥留在新的私有临时服务器目录。Acceptance APK、测试资产和凭据均不上传。普通 Debug APK 分别构建与测试，并检查其不含测试证书或连接资产。模拟器/系统不安装 CA，也不替换 Trust Manager 或主机名验证器。

候选 `a81fb65c` 在 Android CI `35224143633` 通过：模拟器经 HTTPS 加载真实 Node 服务、在随包 WebView 页面登录、用生成的 4 MiB + 65,537 字节 File 调用上传处理器，并通过生产流式校验辅助函数验证原生 HTTPS 下载。另一个转发到同一服务的地址因 TLS 主机名校验而失败。断开连接会清除客户端 Cookie。这**不等于** Android 系统文档选择器/提供器验收、生产证书安装、实体 Wi-Fi 传输，也不意味着 Acceptance APK 可以分发。准确证据与剩余门禁见 [VALIDATION.md](VALIDATION.md)。

PR #13 候选 `9cb04013` 还在 Android CI `35283340505`（11.576 秒）通过真实 DocumentsUI/Downloads 提供器选择与原生新建文档保存：上传独特的 65,537 字节提供器测试文件，生产 Activity 显示的校验成功状态与独立读取的目标字节一致。仅清理生成的源/目标文件，真实原生截图已经审阅。这关闭的是**模拟器 Downloads 提供器**门禁，不涵盖其他或云端提供器、权限撤销、取消、旋转、实体 Wi-Fi 或生产证书安装。
