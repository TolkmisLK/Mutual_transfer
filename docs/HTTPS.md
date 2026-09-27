# HTTPS deployment and trust

[中文说明](#zh)

Mutual Transfer terminates TLS itself using Node.js HTTPS. HTTPS is required when binding outside loopback unless the operator explicitly enables insecure development mode. The server accepts TLS 1.2 or later; authentication and file bytes use the same encrypted origin. This is not a public multi-tenant service.

## Before exposing a LAN listener

1. Choose a stable DNS name or IP address. The server certificate's Subject Alternative Name must cover the exact address clients will open. A DNS-only certificate does not cover a numeric IP address.
2. Obtain a certificate from a CA already trusted by those clients, or have your administrator provision a dedicated private CA through the devices' supported trust-management settings. Verify the issuer and certificate fingerprint through a trusted channel. Do not bypass browser warnings or disable TLS verification.
3. Keep the private key on the server, outside the repository and download directory. Restrict its filesystem permissions. Never send the private key to receiving devices. Monitor certificate expiry and renew it before expiration.
4. Allow only the application port from intended LAN devices in the host firewall. Do not disable the firewall or expose this preview service through Internet port forwarding.

Example on Linux/macOS, using an already issued certificate and private key:

```sh
HOST=0.0.0.0 PORT=8787 \
TLS_CERT=/private/certs/transfer-fullchain.pem \
TLS_KEY=/private/certs/transfer-key.pem \
ALLOWED_HOSTS=transfer.example.internal \
DATA_DIR=/private/mutual-files npm start
```

Example in Windows PowerShell:

```powershell
$env:HOST='0.0.0.0'
$env:PORT='8787'
$env:TLS_CERT='C:\private\certs\transfer-fullchain.pem'
$env:TLS_KEY='C:\private\certs\transfer-key.pem'
$env:ALLOWED_HOSTS='transfer.example.internal'
$env:DATA_DIR='C:\private\mutual-files'
npm start
```

Open `https://transfer.example.internal:8787` on each intended device. The example name is a placeholder, not a provisioned service. `ALLOWED_HOSTS` contains comma-separated hostnames/IPs without schemes, ports, paths or wildcards; IPv6 entries use brackets. It is an HTTP Host allowlist, **not** a certificate trust setting or IP-based client access control. Custom allowlists replace the automatically detected local host list.

The console generates a new workspace key unless `MUTUAL_KEY` is supplied through the operator's environment. Share it only with intended members using a trusted channel, never in a URL. All members can read and delete the same workspace. Browser sessions are HttpOnly, SameSite=Strict and Secure over HTTPS; logout revokes the session and expires its cookie. Restart invalidates sessions, while file checkpoints remain on disk. The application does not encrypt stored files at rest.

A reverse proxy that terminates TLS and forwards plaintext is **not** an implemented trusted-proxy mode: the service does not trust forwarded headers or derive a secure origin from them. Use direct HTTPS as above; do not disable origin validation to make a proxy appear to work.

## Reproducible protocol checks

`npm test` includes a real HTTPS service test. It requires an OpenSSL executable (CI uses Linux OpenSSL or Git for Windows OpenSSL). It creates a fresh, one-day, loopback-only test certificate and private key in a new temporary directory, trusts that certificate only in the individual test requests, and deletes the fixture after closing the server. It never installs a CA into an OS/browser trust store, bypasses certificate validation, or uploads private keys as artifacts.

The test rejects an untrusted certificate and a mismatched server name; with explicit fixture trust, it checks negotiated TLS, secure login cookies, same-origin enforcement, verified upload, full/range download, logout and rejected reuse of the old session. Separate configuration tests reject insecure LAN defaults, half-configured TLS, invalid ports and ambiguous Host allowlists.

These are Node HTTPS protocol tests on CI hosts, not proof that real phones trust an operator's certificate. Physical PC/phone trust provisioning, Wi-Fi tests, pairing UX and native packaging remain separate gates. Execution evidence is recorded in [VALIDATION.md](VALIDATION.md).

Reference: [Node.js 24 HTTPS](https://nodejs.org/docs/latest-v24.x/api/https.html), [Node.js 24 TLS](https://nodejs.org/docs/latest-v24.x/api/tls.html).

<a id="zh"></a>

## 中文：HTTPS 部署与证书信任

Mutual Transfer 直接通过 Node.js HTTPS 终止 TLS。除非运维人员显式开启不安全开发模式，否则监听 loopback 以外的地址必须使用 HTTPS。服务接受 TLS 1.2 或更高版本；认证和文件字节使用同一个加密来源。这不是面向公网的多租户服务。

### 开放局域网监听前

1. 选择稳定的 DNS 名称或 IP。服务端证书的 Subject Alternative Name 必须覆盖客户端实际打开的地址；只有 DNS 名称的证书不能验证数字 IP。
2. 使用客户端已信任 CA 颁发的证书，或请管理员通过设备支持的信任设置安装专用私有 CA。通过可信渠道核对签发者和证书指纹。不得忽略浏览器警告或关闭 TLS 校验。
3. 私钥只留在服务器端，放在仓库和下载目录之外，并限制文件权限；不要发送给接收设备。监控证书有效期，过期前续期。
4. 主机防火墙只允许预期的局域网设备访问应用端口；不要关闭防火墙或通过互联网端口转发暴露此预览服务。

已有证书和私钥时，在 Linux/macOS 运行示例：

```sh
HOST=0.0.0.0 PORT=8787 \
TLS_CERT=/private/certs/transfer-fullchain.pem \
TLS_KEY=/private/certs/transfer-key.pem \
ALLOWED_HOSTS=transfer.example.internal \
DATA_DIR=/private/mutual-files npm start
```

Windows PowerShell 示例：

```powershell
$env:HOST='0.0.0.0'
$env:PORT='8787'
$env:TLS_CERT='C:\private\certs\transfer-fullchain.pem'
$env:TLS_KEY='C:\private\certs\transfer-key.pem'
$env:ALLOWED_HOSTS='transfer.example.internal'
$env:DATA_DIR='C:\private\mutual-files'
npm start
```

各设备打开 `https://transfer.example.internal:8787`。示例域名只是占位符，并非已开通的服务。`ALLOWED_HOSTS` 使用逗号分隔的不带协议、端口、路径或通配符的主机名/IP；IPv6 用方括号。它只是 HTTP Host 白名单，**不是**证书信任设置或按 IP 识别客户端的访问控制。自定义白名单会替换自动检测出的本地主机列表。

未设置 `MUTUAL_KEY` 时，控制台每次生成新的工作区密钥。只通过可信渠道分享给预期成员，不能放在 URL。所有成员都可以读取和删除同一工作区的文件。浏览器会话 Cookie 为 `HttpOnly`、`SameSite=Strict`，HTTPS 下还带 `Secure`；登出撤销会话并使 Cookie 过期。重启使会话失效，但磁盘上的文件检查点保留。应用不加密静态存储的文件。

由反向代理终止 TLS 后再向服务转发明文，**不是**已实现的可信代理模式：服务不信任转发 Header，也不会据此推导安全来源。请使用上面的直接 HTTPS 方式，不要关闭 Origin 校验来迁就代理。

### 可复现的协议检查

`npm test` 包含真实 HTTPS 服务测试，需要 OpenSSL 可执行文件（CI 使用 Linux OpenSSL 或 Git for Windows OpenSSL）。测试在新的临时目录中创建有效期一天、仅适用于 loopback 的证书和私钥，只在单个测试请求中信任该证书，并在服务关闭后清除夹具。它不把 CA 安装到操作系统或浏览器信任库，不绕过证书校验，也不把私钥作为产物上传。

测试会拒绝未信任证书和主机名不匹配的证书；显式信任测试证书后，检查协商的 TLS、安全登录 Cookie、同源校验、校验后的上传、完整与 Range 下载、登出以及旧会话不能复用。独立配置测试会拒绝不安全的局域网默认设置、不完整 TLS 配置、无效端口和含糊的 Host 白名单。

这些只是 CI 主机上的 Node HTTPS 协议测试，不能证明实体手机信任运维人员证书。电脑和手机上的实际信任配置、Wi-Fi、配对体验与原生打包仍有独立门禁。执行证据见 [VALIDATION.md](VALIDATION.md)。参考：[Node.js 24 HTTPS](https://nodejs.org/docs/latest-v24.x/api/https.html)、[Node.js 24 TLS](https://nodejs.org/docs/latest-v24.x/api/tls.html)。
