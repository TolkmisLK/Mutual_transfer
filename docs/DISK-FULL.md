# Disk-full recovery acceptance

[中文说明](#zh)

The opt-in Linux integration check in `tool/disk-full.js` exercises actual kernel `ENOSPC`, not a mocked filesystem exception. CI creates a new 16 MiB tmpfs mount under its temporary directory, runs the service against it, and unmounts only that generated mountpoint in an exit trap. The script refuses a non-Linux, non-tmpfs, non-empty or out-of-range-capacity directory. Never point it at real files or mount over an existing data directory.

The scenario uploads one 4 MiB chunk, fills the remaining fixture capacity until the kernel rejects a write, and attempts another chunk. It checks that the API reports failure, preserves the committed offset, refuses download of the incomplete file, and releases a failed new-file reservation. After freeing fixture capacity and rebuilding the service, it resumes the original upload. It fills capacity again before the final metadata commit, checks the file is still not marked complete, then frees capacity, restarts and completes with exact source/download SHA-256. All payloads are generated fixture bytes.

This tests application recovery on a real full Linux filesystem. It does not simulate physical-disk failure, abrupt power loss, Windows disk-full behavior or Wi-Fi interruption. Ordinary `npm test` remains safe without mounting/filling a filesystem; the new scenario is a separate CI job with a five-minute limit. The dedicated job passed in PR #4 CI 34866838925, alongside both platform unit suites and the browser suite. Local execution remained unavailable; evidence is from the CI kernel and service. See [VALIDATION.md](VALIDATION.md).

<a id="zh"></a>

## 中文：磁盘写满恢复验收

可选的 Linux 集成脚本 `tool/disk-full.js` 会触发真实内核 `ENOSPC`，而非模拟文件系统异常。CI 会在自己的临时目录下新建 16 MiB 的 tmpfs 挂载，让服务在其中运行，并通过退出处理仅卸载该测试挂载点。脚本会拒绝非 Linux、非 tmpfs、非空或容量超出范围的目录。**不要指向真实文件，也不要覆盖现有数据目录挂载。**

测试先上传一个 4 MiB 分块，再填满测试目录剩余空间，直到内核拒绝写入，然后尝试下一分块。它验证 API 报错、已提交偏移保留、未完成文件不可下载、新文件失败后的预留容量释放。释放测试空间并重建服务后，恢复原上传；在最终元数据提交前再次填满空间，确认文件仍未标记完成；最后释放空间、重启并完成传输，精确比较源文件与下载文件的 SHA-256。全部载荷均为生成的测试数据。

这只验证真实 Linux 文件系统写满时的应用恢复，不模拟物理磁盘故障、突然断电、Windows 磁盘写满或 Wi-Fi 中断。普通 `npm test` 不会挂载或填满文件系统；此场景是另设的 CI 任务，超时上限五分钟。专用任务在 PR #4 的 CI 运行 `34866838925` 通过，同时两个平台的单元测试和浏览器测试也通过。本地未能执行该场景；证据来自 CI 的内核与服务。详见 [VALIDATION.md](VALIDATION.md)。
