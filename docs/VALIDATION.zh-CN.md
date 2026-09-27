# 验证记录（历史条目始于 2026-09-14，Asia/Shanghai）

[English](VALIDATION.md) · 本页按英文原记录的日期、候选提交和运行编号翻译；各条“通过”只代表当时列明的环境和门禁，不表示此刻最新构建或实体设备已经验收。

## Android 排队保存清理 — 2026-09-19（Asia/Shanghai）

PR #16 候选 `68da3dd9349fb1ab6335caccb8b18afdd9fa03f5` 通过了 [Android CI 35381670016](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35381670016) 和全部五项[服务 CI 35381669970](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35381669970)。新增的受控 JVM 回归使用真实 Executor：保持首个任务运行、第二个任务排队，令两者失效并关闭两次，拒绝新任务，断言两条已接收的清理路径各执行恰好一次且不会启动另一项传输。Activity 销毁时现会排空队列，而非丢弃已经接收且拥有新建文档的任务。既有 Lint/构建、Debug 与 Acceptance 模拟器场景均通过。产物 `10562586858` 已下载，成功的队列回归报告已审查；没有本地 Java/Android 执行结论。

这修复了一项独立的源码审查发现，**不等于**此前偶发的仪器测试崩溃已经解释。Main 运行 `35352777102` 报告 Java `IllegalStateException`，但没有应用栈帧；隐私过滤诊断现在会在再次发生时保留白名单内的框架栈帧。随后两次候选 Android 运行 `35381520810`、`35381670016` 通过，仍不能确定崩溃根因。受控队列测试不提供进程终止、提供器无限阻塞、旋转或后台运行保证。

## Android 失败文档清理 — 2026-09-18（Asia/Shanghai）

PR #14 候选 `0e79fe5933cc9032657374185a6b9364fb495b46` 通过 [Android CI 35304958761](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35304958761) 与全部五项[服务 CI 35304958737](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35304958737)。六项 JVM 测试、Lint/构建、两项 Debug 和三项 Acceptance 仪器测试通过。真实 HTTPS/DocumentsUI 场景耗时 14.327 秒：仅修改一个可丢弃的已完成测试文件，使其字节与原摘要不符；应用显示失败并移除新建目标文档，独立核对之前成功的文档字节未改变。产物 `10531403184` 已下载，真实原生失败状态截图已审查。这不是实体存储故障、权限撤销或进程终止测试。

合并后，[main Android CI 35305358209](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35305358209) 因仪器测试进程崩溃失败，且没有留存失败产物；main 服务 CI `35305358190` 通过。原因仍未确定。后续修改增加严格过滤的异常与源码栈帧诊断，仍保留失败退出码；上述候选通过不能说明 main Android 验收稳定。

审查还发现，目标写入 flush/close 期间发生取消后，可能继续显示成功。候选修复在 flush 后以及关闭提供器流后重新检查取消状态；JVM 回归会在 flush 期间注入取消，即使源字节已经全部写入。它是受控时序测试，不保证后台或进程终止行为。

## Android 系统文档交接 — 2026-09-18（Asia/Shanghai）

PR #13 候选 `9cb040131b4b1551b65c3c4e144375e63809cc03` 通过 [Android CI 35283340505](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35283340505) 和全部五项[服务 CI 35283340386](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35283340386)。真实 API 35 HTTPS 场景耗时 11.576 秒：创建独特的 Downloads 提供器测试文件，经真实 DocumentsUI 选择，用生产文件回调上传 65,537 字节，再经真实“新建文档”界面保存服务端下载。它断言原生 SHA 校验完成，独立比较目标字节，随后只删除生成的源/目标文件。没有桩替代 Activity 结果。

产物 `10523856973` 已下载，真实 HTTPS 截图已审查：画面能看到提供器上传完成、原生校验保存状态和服务端文件控件。之前的合成 4,259,841 字节上传、直接原生 HTTPS 辅助函数、错误主机名拒绝和断开后 Cookie 清理也在此次运行。这只验证模拟器的 Downloads 提供器，不代表任意云端提供器、实体 Wi-Fi、证书安装、取消/旋转或后台验收。

## Android 客户端预览 — 2026-09-18（Asia/Shanghai）

PR #12 候选 `a81fb65c4df2960279d5f6d695a48615ccf94de6` 通过 [Android CI 35224143633](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35224143633) 和全部五项[服务 CI 35224143810](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35224143810)。五项 JVM 测试、Lint、Debug APK、两项普通 API 35 模拟器测试和三项隔离 Acceptance 类型测试均通过。原生设置与已安装备份排除资源经过检查。真实 HTTPS 测试在 WebView 内登录实际 Node 服务，用随包处理器上传生成的 4,259,841 字节 File，原生 HTTPS/校验代码下载并验证 65,537 字节，拒绝证书主机名错误的连接，且断开时清除 Cookie。

仅 Acceptance 类型使用的临时 CA 和连接测试文件不在可分发的 Debug APK 内；Acceptance APK、私钥及连接资产都未上传。产物 `10498221979` 已下载，真实原生 HTTPS 截图已审查（只拍到上部工作区控件，未拍到折叠下方的文件行）。APK SHA-256 `892c4e8eba63fd9932a831104d5609393086afa9a188ed63466e2fa23c07e415` 一致，ZIP 完整性通过。这**不等于**系统文档选择器/提供器上传下载、实体 Wi-Fi、生产 CA 安装、OEM 备份行为、后台/旋转或签名发布验收。没有本地 Android 工具链执行结论。见 [ANDROID.md](ANDROID.md)。
## 选择性配对会话管理 — 2026-09-16（Asia/Shanghai）

PR #11 候选 `fabcdcac0f013cc28548b70a19e8104f9edb80b1` 通过 [CI 35091510353](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35091510353)：五项任务全部成功，包括 Linux/Windows 服务测试、真实磁盘写满恢复和 Windows 便携包验收。Linux 报告 33 项测试通过。Chromium 的 12 个场景在 25.9 秒内通过；新增桌面与手机视口场景各耗时 1.4 秒。

仅持有者可列出和单独撤销会话；管理使用独立 ID、可选且不可信的设备名称、明确确认/重试和防过期弹窗保护。真实 HTTP/浏览器场景验证取消不发送 DELETE、失败后可重试、只有所选访客失去权限、另一个访客仍可访问经过字节校验的文件，以及迟到列表响应不能重新打开已关闭弹窗。先前的浏览器清理竞态通过等待被保持的响应后再移除路由来修复；生产限流和断言没有削弱。

已下载浏览器产物 `10443979543`，审查了真实手机宽度的配对会话弹窗：剩余设备和单独撤销操作均能放下，完成提示说明其他会话保留。这是 Chromium 视口证据，不是实体手机。本地真实服务测试仍被抽象 Unix socket `EPERM` 阻断；独占数据目录保护没有移除。设备名不是经过验证的身份，已经授权的请求仍可能完成，撤销不能清除已下载副本。此项仍属开发预览，不是原生应用或实体设备发布验收。

## 可安装网页与私有离线回退 — 2026-09-16（Asia/Shanghai）

新增根路径范围 Web App Manifest、图标、明确的浏览器安装提示，以及只访问网络的 Service Worker。本地三项新增纯逻辑测试和语法检查通过。Worker 不缓存或拦截 API/文件；只有访问精确根路径失败时才返回静态重连说明。

[PR #10 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/35029120732) 候选 `550859c99726005d789314d98b97afb90262e745` 的五项任务全部通过，包括双平台各 32 项测试、22.5 秒内完成的十个真实 Chromium 场景、真实 `ENOSPC` 恢复和 Windows 便携测试。新增桌面/手机视口场景分别耗时 4.2/4.1 秒：Worker 开始控制页面后，在 9 MiB 上传的 4 MiB 处中断，切到离线，确认回退页不含文件名/凭据且 Cache Storage 为空，重连后以原传输 ID 续传，最终 SHA-256 完全一致。离线 API 访问失败，没有从缓存读取私有数据。

Windows 包验证了 32 个清单文件并提供四项新增公开资源，同时保留真实 CMD 启动器和 4,259,841 字节重启续传检查。浏览器产物 `10420503327` 已下载；真实手机视口的私有离线回退及重连后安装指南截图已经审阅。合并后 main CI `35029389650` 也通过。这是浏览器视口测试，不是 Android/iOS 操作系统安装、实体 Wi-Fi 或后台传输验收。见 [INSTALLABLE-WEB.md](INSTALLABLE-WEB.md)。

## Windows 命令启动器 — 2026-09-15（Asia/Shanghai）

[PR #9 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34926656324) 候选 `b5b50e7e9e9f775d97a37df31564cfe0dce3a464` 的五项任务全部通过。Windows 便携测试从不同工作目录、带空格的包路径，通过真实系统命令解释器调用打包后的 `START-WINDOWS.cmd`。它验证文件访问保持、继承的 Node 启动选项被清除、stdin 正常停止、故意设置错误 `PORT` 时通过批处理暂停仍返回退出码 1。JSON 标志 `commandLauncherTested`、`inheritedNodeOptionsCleared`、`commandFailureExitPreserved` 均为 true；既有 4,259,841 字节重启续传和 28 文件清单检查也通过。浏览器关联及资源管理器双击仍需在消费级电脑单独检查；此处是 CI 命令执行，而非桌面点击。

## 配对会话撤销 — 2026-09-15（Asia/Shanghai）

[PR #8 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34925825285) 候选 `083799329e1fb25815fa0f08dad58191cf51556e` 的五项任务全部通过。Ubuntu、Windows 各有 29 项测试通过；八项浏览器测试耗时 13.9 秒，其中两项新增撤销场景分别耗时 892/894 毫秒。既有便携包和真实 `ENOSPC` 门禁也通过。HTTP 回归检查两组独立持有者/访客、访客/Bearer/Origin 拒绝、持有者会话和文件保留、幂等性与重新配对；浏览器场景覆盖取消不发送请求、确认、已撤销访客刷新、上传内容保留和新邀请。

最初浏览器套件共用一个服务，导致无关场景累计耗尽合法的每 IP 登录配额。现每个场景建立自己的真实服务和数据目录；生产限流及重放断言保持不变。产物 `10380102181` 已下载，实际持有者手机视口撤销截图已审阅：控件可换行，保留文件及其校验和仍可见，并显示确认数量。本地语法检查通过；本地服务仍无法绑定沙箱要求的 IPC 保护端点，因此没有绕过保护来运行。已授权请求与保留副本的限制见 [PAIRING.md](PAIRING.md)。
## 独占数据所有权 — 2026-09-15（Asia/Shanghai）

[PR #7 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34922254993) 候选 00adfa3d07a2a1c789b140b847ea3511ffab8ab9 的五项任务全部通过。Ubuntu 和 Windows 各通过 28 项测试，包括真实操作系统所有权、路径别名、初始化失败清理，以及真实子进程竞争/强制退出恢复（分别耗时 423/460 毫秒）。竞争进程在截断模拟的活动尾部之前被拒绝；仅终止测试夹具的原持有者后，新进程取得保护并恢复已提交检查点。这是进程退出验收，不是断电持久性验证。

六项浏览器场景通过（12.1 秒），真实 ENOSPC 恢复和真实 Windows 便携进程测试也通过。新包的 28 个清单文件验证通过，4,259,841 字节重启续传下载检查仍通过。未声称有新截图审查或实体设备结果。本地语法检查通过，但该沙箱以 EPERM 拒绝 Linux 抽象 socket 绑定，因此本地无法在保留保护的情况下执行服务；没有绕过保护。见 [DATA-OWNERSHIP.md](DATA-OWNERSHIP.md)。

## Windows 便携服务 — 2026-09-15（Asia/Shanghai）

[PR #6 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34898643333) 候选 bbe2fe618bab9d2781953af14f0572c611222928 的五项任务全部通过，包括新增的真实 Windows 打包/进程测试、双平台各 25 项测试、六项浏览器场景和磁盘写满回归。本地 25 项测试与语法检查也通过。

Windows x64 包固定 Node 24.21.0 和对应官方公开 ZIP 校验和。CI 验证生成的 ZIP，将其解压到带空格的路径，核对 23 个清单文件、没有额外载荷，以及实际执行运行时的绝对路径、版本和架构。真实打包进程登录、上传首个 4 MiB 分块、通过 stdin 输入 stop 正常退出，以新工作区密钥重启并使旧 Cookie 失效，续传余下 65,537 字节，随后下载全部 4,259,841 字节，SHA-256 一致。数据位于包外、独立的 LOCALAPPDATA 测试目录；无关标记文件未改变。服务子进程没有使用系统 Node。

产物 10370215703 包含便携 ZIP、其 SHA-256 和 windows-portable-validation.json。JSON 明确将浏览器自动打开、全新机器、实体局域网检查标为 false。这是浏览器界面的控制台服务，不是原生桌面/移动 GUI 或签名发布。CMD 双击和浏览器关联仍需消费级电脑验收。见 [WINDOWS-PORTABLE.md](WINDOWS-PORTABLE.md)。

## 临时配对 — 2026-09-15（Asia/Shanghai）

[PR #5 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34897925521) 候选 214f3660ba174c91d3ef5a93b1ed1b5a59616f8f 的四项任务全部通过：Ubuntu 和 Windows 各 24 项测试、六项浏览器场景（14.3 秒）及真实 ENOSPC 回归。本地 24 项测试和语法检查也通过。测试涵盖哈希化的一次性凭证过期/配额、并发 HTTP 兑换、受限邀请权限、签发者登出/撤销和限流。真实 TLS 场景用独立 Secure Cookie 会话配对，并在开启证书校验时下载已验证文件。

新浏览器场景在两个项目均通过（863/916 毫秒）：独立的 390 像素宽上下文用一次性码加入、上传精确供持有者下载的字节，不能通过界面或 API 再创建邀请，登出后也不能重放原配对码。最初尝试暴露了 API 响应前读取配对码的测试竞态，以及隐藏输入框造成的清理等待。显式等待响应可见、改用非交互式清理修复了两者，没有削弱协议断言。为避免认证材料进入产物，浏览器 Trace 现已禁用。

产物 10369477132 已下载，真实配对与持有者手机视口截图已审阅。配对页面没有邀请控件；持有者工具栏、文件校验和及操作能放在窄视口。这是真实 Chromium 渲染，不是实体手机或可信局域网证书验收。见 [PAIRING.md](PAIRING.md)。

## 真实 HTTPS 协议验收 — 2026-09-15（Asia/Shanghai）

[PR #3 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34865814288) 候选 d17622be774b90b74620c487a34cdbc931ec8ae5 在 Ubuntu 与 Windows 2022 上均通过全部 21 项服务、完整性和配置测试，原有四项 Chromium 场景也通过（11.3 秒）。

真实 HTTPS 场景在 Ubuntu 耗时 546 毫秒，Windows 耗时 1,488 毫秒。各自用 OpenSSL 生成新的、有效期一天的 loopback 证书，不修改系统信任库。默认验证拒绝不可信签发者和错误主机名；仅信任测试证书的请求协商 TLS 1.2/1.3，以 Secure/HttpOnly/SameSite Cookie 登录，拒绝 HTTP Origin 不匹配和不在列表内的 HTTP Host，上传带源哈希与分块 SHA-256 的 65,537 随机字节，验证完整和 Range 下载，并确认登出使原 Cookie 失效。

最初候选失败，是因为 Node 在服务执行 Host 检查前从故意未列入名单的 HTTP Host 推导 TLS servername。修正后的 Host 场景显式保留正确 TLS 名称；独立的错误名称 TLS 拒绝仍有效。没有关闭证书校验或测试门禁。

当时本地执行环境不可用，所以这些是 CI 运行结果，不是本地测试。此修订未声称有新的浏览器截图审查。这不证明实体手机信任运维颁发证书，也不证明原生配对或安装。部署与信任边界见 [HTTPS.md](HTTPS.md)。

## 真实 Linux 磁盘写满恢复 — 2026-09-15（Asia/Shanghai）

[PR #4 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34866838925) 候选 e55354df3b5f43988e6877e0cc7d50994cb0c6e1 的独立磁盘写满任务、两个 21 项测试的平台任务和全部四项浏览器场景通过。

该任务挂载新的 16,777,216 字节 tmpfs，触发真实内核 ENOSPC。第二分块失败后，首个 4 MiB 检查点不变；创建失败会释放内存中的预留容量，未完成数据不可下载。释放测试空间并重建服务后继续上传。在完成元数据检查点再次耗尽空间时，文件仍未被标记完成。最后释放空间、重启、完成和下载，复现了 8 MiB 真实数据的源文件 SHA-256。五项 JSON 证据标志均为 true；退出处理只卸载生成的临时挂载。

这覆盖 Linux tmpfs 上真实文件系统写满，不覆盖物理介质故障、断电或 Windows 磁盘写满验收。见 [DISK-FULL.md](DISK-FULL.md)。此次没有本地运行环境；内核和服务执行发生在 CI 中。
## 自动化服务与浏览器检查

[PR #2 候选 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/34779873509)，提交 0dcce5a8dad1be21ff328ae0e98a2f7d65a64aa0：

- Ubuntu 与 Windows 2022 的语法检查和 19 项服务/完整性测试通过。
- 真实 Chromium 在 1280×900 桌面和 390×844 手机视口运行的四项浏览器场景均通过，总耗时 12 秒。
- 场景覆盖有源文件校验的上传、按字面显示且不执行的文本预览、逐字节一致的下载，以及第二个 4 MiB 分块被中止后以同一上传 ID 续传且不重复数据。
- 浏览器产物 10323644878 已下载；两张真实 verified-workspace.png 截图已审阅。中文标签和内容能够渲染，手机宽度下哈希可换行，操作仍可见。原生文件选择器文字取决于浏览器语言。这是 Chromium 截图，不是 Android/iOS 截图。

在干净检出目录复现：

```sh
npm ci --ignore-scripts
npm run check
npm test
npx playwright install --with-deps chromium
npm run test:browser
```

浏览器测试夹具现在为每个场景建立独立真实服务、临时 loopback 端口和临时数据目录，使用仅供测试的工作区密钥。清理时关闭对应服务，只删除该场景生成的目录。认证限流不变；各场景不会互相消耗登录配额。**不要将测试指向真实 data 目录。**

## 真实大文件 loopback 验收

在 Linux x64 / Node v24.19.0 本地运行 node tool/large-transfer.js 通过。它实际写入和下载字节，而非只创建稀疏文件元数据；结束后只删除新建的临时测试夹具。

| 测量项 | 当时的实际结果 |
| --- | --- |
| 上传与下载字节数 | 5,368,709,137（5 GiB + 17 字节） |
| 服务在持久化偏移处重新初始化 | 2,688,548,864 字节 |
| 源文件、服务端与流式下载 SHA-256 | 23c5cb586af09322602788f9ea37e8b6e955ad4eb91a63bb87e5e5b66a253190 |
| 总耗时（含哈希与下载） | 49.5 秒 |
| 采样到的客户端/服务端合计 RSS 峰值 | 159 MiB；低于 768 MiB 的断言通过 |
| 超过 4 GiB 的 Range | 最末 17 字节精确一致 |

这只是一次本机 loopback 测量，不是局域网速度声明。服务在同一 Node 进程中传输过半时关闭并重建，检查的是持久化状态恢复，不是操作系统断电。生成分块包含各自不同的偏移，以便发现乱序。每 20 毫秒采样一次内存，不能证明所有负载下的内存占用。

该可选命令需要“文件大小 + 1 GiB”的可用磁盘空间，不属于普通 CI。LARGE_TEST_BYTES 可选择更小的冒烟测试夹具，但只有达到至少 5 GiB 的运行才满足本门禁。

## 尚未完成的门禁

仍需实体电脑之间以及移动设备与电脑之间的传输、Wi-Fi 断开重连、HTTPS 信任和配对体验、移动端前后台行为、原生打包与干净机器安装、Windows 磁盘写满及实体存储故障行为，以及多设备访问权限验收。上述历史测试通过不取消这些门禁。
