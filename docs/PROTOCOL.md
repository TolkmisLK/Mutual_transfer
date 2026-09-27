# Protocol v0 — unstable development contract

[中文说明](#zh)

All `/api` operations require a valid workspace session cookie or `Authorization: Bearer <workspace key>`, except session creation. Keys never belong in URLs. TLS is required outside an explicit trusted-network development test. A workspace is a single trust group, not a user account system.

| Method / path | Request | Result |
| --- | --- | --- |
| POST /api/session | JSON `{key}` | HttpOnly SameSite=Strict session, one hour |
| DELETE /api/session | Session cookie | Revoke current session |
| GET /api/transfers | — | Files, offsets and chunk size |
| POST /api/transfers | JSON `{name,size,expectedSha256?}` | New random ID; capacity reserved; new UI always supplies source SHA-256 |
| GET /api/transfers/:id | — | Persisted offset / completion state |
| PUT /api/transfers/:id/chunk | Raw bytes, Content-Length, Upload-Offset, optional Upload-Checksum (hex SHA-256) | Reject a wrong chunk hash with 422 before writing; maximum 4 MiB |
| POST /api/transfers/:id/finish | — | Complete only at expected length and matching source SHA-256; 422 leaves a mismatch incomplete |
| GET /api/transfers/:id/download | Optional single Range | Attachment stream, 200 or 206 |
| GET /api/transfers/:id/preview | Optional single Range | Allowlisted magic bytes only; no HTML/SVG |
| GET /api/transfers/:id/text | — | Plain text inside JSON, maximum 64 KiB |
| DELETE /api/transfers/:id | — | Delete file and reservation |

On 409, re-read the persisted offset; do not blindly resend at a stale position. If a chunk response is lost, the server may already have committed it. Restart truncates uncommitted trailing bytes back to the saved offset. Completion is idempotent. Final hashing streams from disk; it does not load the complete file in memory.

The data directory is private application state. Run one server process against it; do not mount it into multiple writable servers. Metadata and data must be backed up together with the service stopped. Files are not encrypted at rest by this application; use host disk encryption where required.

Source hashes are lowercase 64-character SHA-256. For backward compatibility an omitted source hash is accepted, but completion then sets `integrityVerified: false`; it must never be displayed as source-verified. The new browser UI hashes the source incrementally, keys local resumptions by that content digest, sends per-chunk digests and verifies the final server result. Older filename/size-only local resumptions are not reused.

<a id="zh"></a>

## 中文：v0 协议（开发阶段，可能变更）

除创建会话外，所有 `/api` 操作都需要有效的工作区会话 Cookie，或 `Authorization: Bearer <工作区密钥>`。密钥不得放入 URL。除明确的可信网络开发测试外，必须使用 TLS。一个工作区是一组共享信任的成员，不是多用户账号系统。

| 方法与路径 | 请求 | 结果与限制 |
| --- | --- | --- |
| `POST /api/session` | JSON `{key}` | 签发有效期一小时、`HttpOnly`、`SameSite=Strict` 的会话 |
| `DELETE /api/session` | 会话 Cookie | 撤销当前会话 |
| `GET /api/transfers` | 无 | 返回文件、偏移和分块大小 |
| `POST /api/transfers` | JSON `{name,size,expectedSha256?}` | 创建随机 ID 并预留容量；新版界面始终提供源文件 SHA-256 |
| `GET /api/transfers/:id` | 无 | 返回已持久化偏移与完成状态 |
| `PUT /api/transfers/:id/chunk` | 原始字节、`Content-Length`、`Upload-Offset`、可选 `Upload-Checksum`（十六进制 SHA-256） | 分块上限 4 MiB；哈希错误在写入前返回 422 |
| `POST /api/transfers/:id/finish` | 无 | 仅在长度和源文件 SHA-256 均匹配时完成；不匹配返回 422 且保持未完成 |
| `GET /api/transfers/:id/download` | 可选的单段 `Range` | 附件流，返回 200 或 206 |
| `GET /api/transfers/:id/preview` | 可选的单段 `Range` | 仅允许经过魔数校验的格式，不提供 HTML/SVG 预览 |
| `GET /api/transfers/:id/text` | 无 | JSON 中的纯文本，最多 64 KiB |
| `DELETE /api/transfers/:id` | 无 | 删除文件并释放预留容量 |

收到 409 后应重新读取服务端保存的偏移，不得按过期偏移盲目重发。分块响应丢失时，服务端可能已经提交该块。重启恢复会把未提交的尾部字节截断到已保存偏移。完成操作是幂等的；最终哈希从磁盘流式计算，不把整个文件载入内存。

数据目录是应用的私有状态，只能由一个服务进程使用，不可同时挂载给多个可写服务。备份元数据和文件时应先停服务，再一起备份。应用不加密磁盘上的文件，需要时使用主机磁盘加密。

源文件哈希采用 64 个小写十六进制字符的 SHA-256。为兼容旧客户端，仍接受缺省源哈希，但完成后 `integrityVerified` 为 `false`，不得展示为“已与源文件核对”。新版浏览器界面增量计算源哈希，以内容摘要关联本地续传，发送每块摘要并核查服务端最终结果；不复用旧版仅按文件名和大小记录的续传信息。
