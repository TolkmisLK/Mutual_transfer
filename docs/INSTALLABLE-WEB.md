# Installable Web client and offline boundaries

[中文说明](#zh)

The responsive client now advertises a same-origin Web App Manifest with a standalone window and a bundled SVG icon. On browsers that offer `beforeinstallprompt`, installation is available only after pressing the explicit install button. Other browsers may offer an install/add-to-home-screen menu. Browser support and OS installation UI differ: automated manifest checks are not proof that Android/iOS actually installed the app.

Use the same trusted HTTPS origin on each LAN device. Installation does not make an untrusted/self-signed certificate trusted, bypass a warning, discover servers automatically or keep the PC server running. Loopback HTTP is suitable only for local development. Non-loopback HTTP is not a secure context and the client explains why installation is unavailable.

The service worker handles **only** same-origin GET navigation to the exact root `/` without a query. It attempts the network and, when unavailable, returns a static 503 reconnection guide. It never uses Cache Storage, stores credentials, intercepts API/file/upload/download requests or saves a private file list. Normal authentication cookies remain managed by the browser and the existing one-hour server session, not by a new offline credential store. The offline page deliberately cannot list, preview or download server files.

Worker updates use the browser's normal lifecycle. They do not call `skipWaiting`, force an active page to reload, register background sync or claim reliable uploads after backgrounding, lock-screen, app closure or battery suspension. Keep the app in the foreground; after interruption, reconnect and reselect the original file to resume using its content hash and the server checkpoint. The source file is not kept in a worker cache. An installed window does not grant background-file access.

Uninstalling the Web app does not delete the PC's shared files and does not guarantee server logout. Use the existing logout and paired-session revocation controls as appropriate. A PWA is not an APK, native mobile client, signed desktop installer or consumer-device acceptance.

The CI scenario must demonstrate real worker registration/control, private offline navigation, unavailable APIs while offline, empty Cache Storage and resumption of a partially uploaded 9 MiB file without changing its transfer ID or final SHA-256. Desktop and mobile viewport results still do not establish actual OS installation, WiFi reliability or background operation. Refer to [VALIDATION.md](VALIDATION.md) for candidate results.

References: [MDN installable PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).

<a id="zh"></a>

## 中文：可安装网页客户端与离线边界

响应式客户端现已提供同源 Web App Manifest、独立窗口模式和随包 SVG 图标。支持 `beforeinstallprompt` 的浏览器只有在用户按下明确的安装按钮后才提供安装；其他浏览器可能在菜单里提供“安装”或“添加到主屏幕”。浏览器与操作系统界面各不相同；Manifest 自动检查不能证明 Android 或 iOS 上已经实际安装。

每台局域网设备都应使用同一个可信 HTTPS 来源。安装不会使不受信任或自签名证书自动可信，不会绕过警告、自动发现服务器或保持电脑服务常驻。Loopback HTTP 仅适合本机开发；非 loopback HTTP 不属于安全上下文，客户端会说明为何无法安装。

Service Worker **仅**处理同源、无查询参数、路径恰为 `/` 的 GET 页面导航。它优先访问网络；不可用时返回静态的 503 重连说明。它不使用 Cache Storage，不保存凭据，不拦截 API、文件、上传或下载请求，也不保存私有文件列表。正常认证 Cookie 仍由浏览器和原有的一小时服务器会话管理，没有新增离线凭据库。离线页无法列出、预览或下载服务器文件。

Worker 更新遵循浏览器正常生命周期；不会调用 `skipWaiting`、强制活动页面刷新、注册后台同步，也不保证应用退到后台、锁屏、关闭或电池限制后继续上传。请保持应用在前台。中断后先重新连接，再重新选择原文件，使用内容哈希和服务端检查点续传。源文件不会留在 Worker 缓存中；安装窗口也不授予后台文件访问能力。

卸载网页应用不会删除电脑共享文件，也不保证服务器会话登出。根据需要使用现有登出和配对会话撤销功能。PWA 不是 APK、原生移动客户端、带签名的桌面安装包，也不是消费级实体设备验收结果。

CI 场景须证明真实 Worker 注册与控制、私有离线导航、离线 API 不可用、Cache Storage 为空，以及一个部分上传的 9 MiB 文件续传后 ID 和最终 SHA-256 不变。桌面和手机视口测试仍不能证明实际操作系统安装、Wi-Fi 稳定性或后台运行。候选结果见 [VALIDATION.md](VALIDATION.md)。参考：[MDN PWA 安装](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)、[Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)。
