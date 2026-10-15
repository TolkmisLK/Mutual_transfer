# 发布 Windows 预览包 / Publish Windows previews

## 中文

Windows 预览包从 [Releases](https://github.com/TolkmisLK/Mutual_transfer/releases) 下载，识别 `windows-v` 开头的标签；Android 的 `android-v` 标签是独立客户端。使用说明见 [Windows 便携服务](WINDOWS-PORTABLE.md)。没有公开 Windows 标签时仍可使用成功 main CI 的临时产物。

维护者先合并改动，等待该 **main 精确提交** 的 `Test transfer service` 五项任务全绿，再对当前 main 打与 package.json 基础版本一致的 `windows-v0.1.0-preview.N` 标签并推送。发布工作流核对 tag/main/SHA，要求对应的唯一 main push CI 及完整任务均成功，只选择 `mutual-transfer-windows-portable`，核对 ZIP 摘要、路径与打包运行验收记录，先建草稿再公开预览。未完成、失败、过期、旧提交和 PR 产物都会被拒绝；已有 Release 不覆盖。

这不会重新发布 Android APK，也不把云端进程验收当作真机或干净电脑验收。工作流失败后先检查具体步骤及草稿状态；不要移动已发布标签。

## English

Find Windows bundles under `windows-v` tags on [Releases](https://github.com/TolkmisLK/Mutual_transfer/releases); `android-v` tags are separate clients. See [portable service setup](WINDOWS-PORTABLE.md). Before the first public Windows tag, successful main CI artifacts remain available during retention.

Merge first, wait for all five service CI jobs at the **exact current main commit**, then push `windows-v0.1.0-preview.N` matching package.json's base version. The workflow requires tag/main/SHA agreement and one successful main-push CI with every expected job. It downloads only the portable artifact, verifies checksum, archive paths and packaged-process evidence, then publishes a prerelease through a draft. Old, incomplete, failed, expired and PR artifacts are rejected; existing releases are not replaced.

Android is not republished. CI does not establish physical LAN or consumer clean-machine acceptance. Inspect failed steps and draft state before retrying; never move a published tag.
