# Acceptance roadmap

[中文说明](#zh)

## 1. Recoverable transport — implemented, development preview

Persistent chunk offsets, bounded buffering, unique on-disk names, quota reservation, restart recovery, sender-side streaming hashes, chunk checksums, verified completion, authenticated HTTP operations and browser clients. Nineteen local tests pass; remote CI and browser results must be checked separately.

## 2. Usable cross-device application — next

- Browser interaction tests at phone and desktop widths passed; extend coverage for session expiry, cancellation and preview formats.
- Cancellation and cleanup of abandoned uploads, progress speed/ETA, expired-session recovery and clear error translations.
- Per-device acceptance/permissions (sender-side streaming hash verification is implemented).
- TLS setup helper and pairing via an expiring invitation/QR code, without weakening the current host/origin checks.
- Package a desktop host; create a mobile client supporting share sheets and a documented foreground/background lifecycle.

## 3. Release gates

- Windows/macOS/Linux desktop build and Android package CI; iOS signing/device testing requires an authorized Apple environment.
- PC → PC, Android → PC, PC → Android; iOS browser/native support must be recorded separately.
- Local HTTP 5 GiB + 17 byte transfer, hash comparison and service reinitialization passed (see VALIDATION.md); still perform cross-device transfer and interrupted Wi-Fi acceptance.
- Disk-full, quota-full, filename collision, duplicate chunk, authentication expiry, hostile Origin/Host, malicious filename and unsupported preview tests.
- Verify clean-machine install, uninstall, TLS trust and first-run pairing documentation.
- Publish signed/verified artifacts only when their actual platform gates pass. No paid hosting, account purchase or signing identity invention.

## Later

Direct peer transfers, discovery with explicit consent, offline queues, folder transfers, workspace permissions and richer safe previews. Preserve arbitrary-file support; preview support does not determine which files may be transferred.

<a id="zh"></a>

## 中文：验收路线图

### 1. 可恢复传输：已实现，仍为开发预览版

已实现持久化分块偏移、有界缓冲、磁盘文件名唯一化、容量预留、重启恢复、发送端流式计算源文件哈希、分块校验和、完成时校验、需要认证的 HTTP 操作和浏览器客户端。本地 19 项测试通过；远端 CI 和浏览器测试的结果需要分别核查。

### 2. 可用的跨设备应用：下一阶段

- 手机和桌面宽度的浏览器交互测试已通过；仍需扩展会话过期、取消和预览格式的覆盖。
- 补齐取消和废弃上传清理、进度速度与预计剩余时间、过期会话恢复、清晰的错误译文。
- 增加逐设备的接收确认和权限；发送端流式哈希校验已经实现。
- 提供 TLS 设置辅助和带有效期的邀请码或二维码配对，同时保留现有 Host 与 Origin 检查。
- 打包桌面主机，并开发支持系统分享及明确前后台生命周期的移动客户端。

### 3. 发布门禁

- 完成 Windows、macOS、Linux 桌面构建和 Android 包的 CI；iOS 签名与设备测试需要获授权的 Apple 环境。
- 分别验收电脑到电脑、Android 到电脑、电脑到 Android；iOS 浏览器和原生支持须单独记录。
- 本地 HTTP 下的 5 GiB + 17 字节传输、哈希比较和服务重新初始化已通过（见 [验证记录](VALIDATION.md)）；仍需跨设备传输和 Wi-Fi 中断验收。
- 检查磁盘满、配额满、文件名冲突、重复分块、认证过期、恶意 Origin/Host、恶意文件名及不支持的预览格式。
- 验证全新机器的安装、卸载、TLS 信任和首次配对说明。
- 仅在相应平台真实门禁通过后发布已签名或已验证的产物；不购买付费托管、账号，也不虚构签名身份。

### 后续方向

考虑设备直连、经明确同意的发现机制、离线队列、文件夹传输、工作区权限和更丰富的安全预览。继续支持任意类型文件；能否预览不决定能否传输。
