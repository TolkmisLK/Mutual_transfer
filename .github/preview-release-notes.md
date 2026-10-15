## 中文

Windows x64 便携服务预览包，内含 Node.js 运行时。核对 `.sha256` 后完整解压，打开 `START-WINDOWS.cmd`；浏览器输入终端显示的空间密钥即可使用。详细步骤见包内 `docs/WINDOWS-PORTABLE.md` 与 `docs/QUICKSTART.md`。

此版本支持暂停续传、取消并清理未完成上传，以及最终文件校验失败后的恢复。关闭浏览器不会停止服务，请在控制台输入 `stop`。默认仅本机访问，手机连接需要配置受信任的 HTTPS。程序包没有签名、自动更新或后台系统服务；真实跨设备网络、干净电脑和资源管理器双击/默认浏览器关联尚未验收。Android 客户端另行下载，本发布不包含 APK。

## English

Windows x64 portable server preview with a bundled Node.js runtime. Compare the `.sha256`, extract the entire folder, and open `START-WINDOWS.cmd`. Enter the private workspace key printed in its console. The package includes `docs/WINDOWS-PORTABLE.md` and the illustrated `docs/QUICKSTART.md`.

Supports paused-upload recovery, explicit cancellation/cleanup, and recovery after final integrity failure. Closing the browser does not stop the server; enter `stop` in its console. Loopback is the default; phone access needs trusted HTTPS. There is no signing, auto-update or background system service. Physical LAN, consumer clean-machine, Explorer double-click and default-browser acceptance remain separate. Android is a separate download; this release contains no APK.
