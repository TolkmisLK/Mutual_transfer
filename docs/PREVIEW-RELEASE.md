# 发布 Windows 预览包 / Publish Windows previews

## 中文

当前公开的 Windows 便携服务预览包为 [windows-v0.1.0-preview.1](https://github.com/TolkmisLK/Mutual_transfer/releases/tag/windows-v0.1.0-preview.1)。下载同页的 ZIP 与 `.sha256`，先比对 SHA-256，再完整解压；步骤见 [Windows 便携服务](WINDOWS-PORTABLE.md)。它不含 Android APK，Android 客户端仍从独立的成功 `main` 构建产物取得；这不是稳定版。

维护者先合并改动，等待该 **main 精确提交** 的 `Test transfer service` 五项任务全绿，再对当前 main 打与 package.json 基础版本一致的 `windows-v0.1.0-preview.N` 标签并推送。发布工作流核对 tag/main/SHA，要求对应的唯一 main push CI 及完整任务均成功，只选择 `mutual-transfer-windows-portable`，核对 ZIP 摘要、路径与打包运行验收记录，先建草稿再公开预览。未完成、失败、过期、旧提交和 PR 产物都会被拒绝；已有 Release 不覆盖。

这不会重新发布 Android APK，也不把云端进程验收当作真机或干净电脑验收。工作流失败后先检查具体步骤及草稿状态；不要移动已发布标签。

本次标签指向 `6a6a535fd459946969ed247d971e40b89202c671`。[服务 CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/38728276711) 与 [Android CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/38728276712) 均通过；[发布工作流](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/38729300825) 核对并公开了两个资产。小校验文件列出的 ZIP SHA-256 与 GitHub ZIP 资产摘要一致，均为 `158f223ee9d61727e0472d908a7e986ce543f23b64353e64d9b2ecb90849d792`；详见[验证记录](VALIDATION.zh-CN.md)。这些 CI 结果不等于实体手机、真实局域网或消费者全新电脑验收。

## English

The current public Windows portable server preview is [windows-v0.1.0-preview.1](https://github.com/TolkmisLK/Mutual_transfer/releases/tag/windows-v0.1.0-preview.1). Download its ZIP and `.sha256`, compare SHA-256, then extract the whole folder; see [portable service setup](WINDOWS-PORTABLE.md). It contains no Android APK. The Android client remains a separate successful `main` CI artifact. This is not a stable release.

Merge first, wait for all five service CI jobs at the **exact current main commit**, then push `windows-v0.1.0-preview.N` matching package.json's base version. The workflow requires tag/main/SHA agreement and one successful main-push CI with every expected job. It downloads only the portable artifact, verifies checksum, archive paths and packaged-process evidence, then publishes a prerelease through a draft. Old, incomplete, failed, expired and PR artifacts are rejected; existing releases are not replaced.

Android is not republished. CI does not establish physical LAN or consumer clean-machine acceptance. Inspect failed steps and draft state before retrying; never move a published tag.

This tag targets `6a6a535fd459946969ed247d971e40b89202c671`. [Service CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/38728276711) and [Android CI](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/38728276712) passed; the [publication workflow](https://github.com/TolkmisLK/Mutual_transfer/actions/runs/38729300825) verified and published two assets. The small checksum file names the same ZIP SHA-256 as GitHub's asset digest: `158f223ee9d61727e0472d908a7e986ce543f23b64353e64d9b2ecb90849d792`. See the [validation record](VALIDATION.md). CI does not establish physical-phone, real-LAN or consumer clean-machine acceptance.
