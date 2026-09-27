# Temporary device pairing

[中文说明](#zh)

Sign in on a trusted device with the workspace key, then select **配对新设备**. On the new device, open the same trusted HTTPS address and enter the displayed **临时配对码**. Codes have 20 hexadecimal characters grouped for manual entry; they expire after five minutes and can be redeemed once. A paired browser receives its own HttpOnly, SameSite=Strict, Secure (on HTTPS), one-hour cookie. Neither the workspace key nor the code is saved to browser storage or added to a URL.

Pairing does **not** establish certificate trust. Use a trusted certificate matching the server address on every device, following [HTTPS.md](HTTPS.md); never dismiss certificate warnings. Pairing endpoints reject non-loopback plaintext connections even if unsafe HTTP development mode is explicitly enabled. This is manual code entry, not QR discovery, native-device pairing or a claim of physical-phone acceptance.

## Scope and revocation

All admitted members can upload, read and delete **all files** in the shared space. This is not per-user isolation or a read-only invitation. Only sessions authenticated with the long-lived workspace key can create/revoke pairing codes; paired sessions cannot invite additional devices. A bearer workspace key must first create a login session to manage pairing.

Closing the pairing dialog revokes **all unused codes issued by that login session**. Logging out or expiring that issuer session also prevents unused codes from being redeemed. This alone does not log out already paired devices.

For remote removal, a workspace-key login can select **撤销配对设备** and confirm. This revokes **all paired sessions across the workspace**, including invitations issued by other owner logins, and **all unused pairing codes**. Owner logins and stored files remain intact. Affected guests receive 401 on their next request and need a newly generated invitation; a refresh returns the browser to the join form. Bulk revocation returns only the revoked count. Session lists contain only an independent random management ID, the user-supplied name, creation time and expiry; they never expose authentication cookies or invitation secrets. A management ID is not a login credential. A cancelled confirmation sends no revocation request. The separate **管理配对设备** dialog lists active paired browser sessions and can revoke one selected session after confirmation. The optional name is supplied by the joining browser and is not a verified device identity; compare the short session number shown on that browser. A physical device may hold several sessions. Single-session revocation preserves other guests, owner logins, files and unused invitation codes. Refresh the list after an uncertain network result before retrying.

Revocation rejects requests authenticated afterward. A request already authorized, including an active download or chunk being committed, may finish; it cannot erase files already downloaded or previews already held in memory. Subsequent chunks and requests fail. There is no push notification or claim of immediate remote screen clearing. Sessions also end on logout, one-hour expiry or server restart. Restart invalidates all sessions/codes but does not delete transferred files. Keep the workspace key private; rotating configuration and restarting is required if it is compromised, since revoking guests does not revoke the master key or owner logins.

## Implementation and verification

Each code is generated from 10 cryptographically random bytes (80 bits); only its SHA-256 digest and issuer/expiry remain in bounded server memory. At most four outstanding codes per issuer and 64 overall are allowed. Expired entries are pruned, and redemption consumes a code synchronously before issuing the new cookie, so concurrent redemption grants one session. The existing login rate limiter is shared with pairing (12 attempts per source address per minute). These limits also permit a malicious same-network peer to temporarily deny login; no distributed attack protection is claimed.

Tests cover expiry at the exact boundary, quotas, revocation, malformed codes, inactive issuers, concurrent HTTP redemption, paired-session privileges, origin rejection and rate limiting. The HTTPS integration case checks a separately paired Secure cookie and verified-file download with real certificate validation. Browser cases cover a separate phone-sized context uploading to the owner's context, exact downloaded bytes, inability to delegate, and replay rejection. CI/browser evidence is recorded in [VALIDATION.md](VALIDATION.md); test source alone is not execution evidence.

The new selective-management HTTP and browser scenarios cover owner-only access, cross-origin rejection, secret exclusion, invalid names before code consumption, idempotent revocation, retained files/other guests/unused codes, literal device-name rendering, cancel, failed-request retry and closing a dialog during a pending list request. Their CI execution is pending; see VALIDATION.md.

<a id="zh"></a>

## 中文：临时设备配对

先在可信设备上用工作区密钥登录，选择 **配对新设备**。新设备打开同一个可信 HTTPS 地址，输入页面显示的 **临时配对码**。配对码由 20 个十六进制字符组成，分组方便手动输入；五分钟后过期且只能使用一次。配对成功的浏览器获得独立的一小时会话 Cookie；它为 `HttpOnly`、`SameSite=Strict`，在 HTTPS 下还有 `Secure`。工作区密钥和配对码都不会保存到浏览器存储，也不会放进 URL。

配对**不负责建立证书信任**。每台设备都要按 [HTTPS 说明](HTTPS.md)信任与服务器地址匹配的证书，不能忽略证书警告。即使显式开启不安全 HTTP 开发模式，配对接口也会拒绝非 loopback 的明文连接。目前仅支持手动输入配对码，不是二维码发现、原生设备配对，也没有实体手机验收结论。

### 权限范围与撤销

所有加入的成员都能上传、读取和删除共享空间里的**全部文件**；这里没有逐用户隔离或只读邀请。只有以长期工作区密钥登录的会话才能创建或撤销配对码；配对会话不能邀请其他设备。使用 Bearer 工作区密钥的调用方需先建立登录会话，才能管理配对。

关闭配对弹窗会撤销**该登录会话签发的所有未使用配对码**。签发者登出或会话过期后，其未使用配对码也不能兑换；这些操作不会登出已经配对的设备。

需要远程移除设备时，工作区密钥登录者可选择 **撤销配对设备** 并确认。这会撤销**整个工作区所有已配对会话**，包括其他持有者登录签发的邀请，以及**全部未使用配对码**。持有者登录和已存文件不受影响。受影响访客的下一次请求返回 401，需要新的邀请；刷新后浏览器会回到加入表单。批量撤销只返回数量。会话列表只显示独立随机管理 ID、用户填写的名称、创建时间和过期时间，不显示认证 Cookie 或邀请码。管理 ID 不是登录凭据；取消确认不会发送撤销请求。

另一个 **管理配对设备** 弹窗会列出当前有效的配对浏览器会话，确认后可只撤销所选会话。可选设备名称由加入者填写，**不是经过验证的设备身份**；应与该浏览器显示的短会话编号核对。一台实体设备可能持有多个会话。单会话撤销不影响其他访客、持有者登录、文件或未使用邀请码。网络结果不确定时，先刷新列表再决定是否重试。

撤销会阻止此后才认证的请求；已获授权的请求，包括正在下载或正在提交的分块，仍可能完成。撤销也不能清除已下载文件或内存中的预览。后续分块和请求会失败。没有推送通知，也不保证远端画面立即清空。登出、一小时过期或服务器重启也会结束会话。重启会使全部会话和配对码失效，但不删除已传文件。工作区密钥若泄露，需轮换配置并重启；仅撤销访客不会撤销主密钥或持有者登录。

### 实现与验证

每个配对码来自 10 个密码学随机字节（80 bit）；服务端有界内存中仅保存其 SHA-256 摘要、签发者和过期时间。每个签发者最多四个、全局最多 64 个未使用码。过期项会清理；兑换操作在签发新 Cookie 前同步消耗配对码，因此并发兑换只能成功一次。配对与现有登录共用每来源地址每分钟 12 次的限流。这也可能让恶意同网设备短暂阻断合法登录；未声称具备分布式攻击防护。

测试覆盖精确过期边界、配额、撤销、格式错误的码、无效签发者、并发 HTTP 兑换、配对会话权限、Origin 拒绝与限流。HTTPS 集成测试用真实证书验证另一个配对得到的 Secure Cookie 和已验证文件下载。浏览器测试在独立的手机宽度上下文上传给持有者，核对下载字节，并验证不能转发邀请及不能重复兑换。CI/浏览器执行证据记录在 [VALIDATION.md](VALIDATION.md)；有测试源码不等于已经执行。

新增的选择性管理 HTTP 与浏览器场景覆盖仅持有者访问、跨源拒绝、密钥不外泄、兑换前拒绝无效名称、幂等撤销、文件及其他访客和未使用码保留、按原文显示设备名称、取消、失败请求后重试，以及列表请求未完成时关闭弹窗。**原文所述这些场景的 CI 执行仍待确认**；见 [VALIDATION.md](VALIDATION.md)。
