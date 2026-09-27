# One process per local data directory

[中文说明](#zh)

Startup recovery truncates uncommitted tails to the last durable checkpoint. Running two service processes on one directory could otherwise truncate a live upload or overwrite metadata, even when they use different HTTP ports. `createServer` now acquires a local OS ownership guard **before** initializing the store. Symlink/junction aliases resolve to the same canonical directory; Windows paths are also case-normalized. Failure to acquire the guard stops startup rather than recovering or deleting anything in that store.

The guard uses a Windows named pipe or a Linux abstract Unix socket, identified by the SHA-256 of the canonical path. It transports no files, keys or control commands; incoming connections are immediately closed. The OS removes these endpoints after process exit, including forced termination. Graceful shutdown waits for HTTP request handlers and pending store writes before releasing the guard. A closed service object cannot be restarted: create a new instance so ownership is reacquired. Initialization failures release the guard.

On other Unix platforms a filesystem Unix socket under `/tmp` is used. A crash can leave that socket behind and future startup will fail closed. The application never guesses a PID, kills another process or automatically deletes a potentially live socket. Recovery there requires an operator to establish that no instance uses the directory before removing the exact stale socket. macOS crash recovery is not claimed as validated.

This is a same-machine, cooperating-process guard, not a distributed lock or hostile-local-user security boundary. **Do not share DATA_DIR across machines, containers with separate IPC namespaces, network filesystems, old unguarded service versions or external programs that write the files.** OS/disk protection and independent backups are still required. A local process can intentionally occupy an endpoint to deny startup; denial is safer than concurrently modifying a store. If an environment prohibits the required local IPC operation, startup reports failure instead of silently dropping the guard.

The regression harness starts real child service processes: a competitor must be rejected before touching a modeled uncommitted tail; after forcibly terminating only the fixture owner, a new process must acquire ownership and truncate that tail to the committed checkpoint. This verifies process-exit cleanup and restart semantics, not power-loss durability or interruption during a particular kernel write. See [VALIDATION.md](VALIDATION.md) for actual execution results.

Primary platform reference: [Node.js IPC paths and lifecycle](https://nodejs.org/api/net.html#ipc-support).

<a id="zh"></a>

## 中文：本地数据目录只能由一个进程使用

启动恢复会把未提交的尾部数据截断到最后一个持久化检查点。如果两个服务进程共用同一目录，即使监听不同 HTTP 端口，也可能截断仍在进行的上传或覆盖元数据。`createServer` 会在初始化存储前取得本机操作系统所有权保护。符号链接和 Windows junction 别名会解析到同一个规范目录，Windows 路径还会统一大小写。保护取得失败时，启动会停止，不会恢复或删除该目录中的内容。

Windows 使用命名管道，Linux 使用抽象 Unix socket；端点标识来自规范路径的 SHA-256。它不传输文件、密钥或控制命令；收到连接会立即关闭。进程退出（包括强制终止）后，操作系统会清除这些端点。正常关闭会等待 HTTP 请求处理器和待完成的存储写入，再释放保护。已关闭的服务对象不能重启；应创建新实例以重新取得所有权。初始化失败也会释放保护。

其他 Unix 平台在 `/tmp` 下使用文件系统 Unix socket。崩溃可能留下旧 socket，使后续启动安全地拒绝运行。应用不会猜测 PID、终止其他进程或自动删除可能仍在使用的 socket。运维人员应先确认没有实例使用数据目录，再移除准确的过期 socket。**macOS 崩溃恢复尚未验证。**

这是一项针对同机、协作进程的保护，不是分布式锁，也不能防御恶意本地用户。**不要跨机器、跨独立 IPC 命名空间的容器、网络文件系统、旧版无保护服务或外部写入程序共享 `DATA_DIR`。** 仍需操作系统与磁盘保护，以及独立备份。本地进程可以故意占用端点导致启动失败；拒绝启动比并发修改同一存储安全。环境不允许所需本地 IPC 时，启动会报错，而不会默默放弃保护。

回归测试会启动真实子服务进程：竞争者必须在触碰模拟的未提交尾部数据前被拒绝；仅强制终止测试夹具中的原持有者后，新进程必须取得所有权，并把尾部截断到已提交检查点。这证明进程退出清理和重启语义，不证明断电持久性或某次内核写入中断的结果。实际执行记录见 [VALIDATION.md](VALIDATION.md)。平台依据为 [Node.js IPC 路径与生命周期](https://nodejs.org/api/net.html#ipc-support)。
