# Android lifecycle acceptance

[中文说明](#zh)

The Activity now removes its WebView from the parent before calling `destroy()`, on the UI thread, then clears its own reference. This follows the [Android WebView destruction contract](https://developer.android.com/reference/android/webkit/WebView#destroy()). It is a concrete lifecycle correction, not a diagnosis of the previously intermittent `IllegalStateException`.

The installed-app instrumentation case recreates an idle Activity twice and checks that each former parent no longer contains its old WebView. It does not call methods on the destroyed WebView. Each replacement must be a different Activity/WebView, start without a loaded URL, retain file/content/mixed-content restrictions and still reject plaintext connections. Check the latest Android workflow run for its emulator result.

This case does not establish transfer survival, destination cleanup during rotation, foreground/background behavior, process-death recovery, physical orientation changes, or behavior across OEM and cloud document providers. The app remains foreground-only and recreation has no resume guarantee. Queue-draining has a separate controlled JVM regression; neither case substitutes for real provider cancellation and process-death testing.

<a id="zh"></a>

## 中文：Android 生命周期验收边界

Activity 现在会在 UI 线程上先把 WebView 从父容器移除，再调用 `destroy()`，最后清除 Activity 持有的引用。这符合 [Android WebView 销毁契约](https://developer.android.com/reference/android/webkit/WebView#destroy())。这是具体的生命周期修正，**不能据此认定此前偶发的 `IllegalStateException` 已定位根因**。

已安装应用的仪器测试会将空闲 Activity 重建两次，检查每次原父容器都不再包含旧 WebView。测试不会在已销毁的 WebView 上继续调用方法。每次替换都必须得到不同的 Activity/WebView，启动时不加载旧 URL，保留文件、content 与混合内容限制，并继续拒绝明文连接。当前模拟器结果须查看最新 Android 工作流。

该测试不证明传输在重建后持续、旋转时目标文件清理、前后台行为、进程终止恢复、实体设备旋转，或不同厂商及云端文档提供器的表现。应用仍只支持前台使用，重建不保证续传。队列排空另有受控 JVM 回归测试；两者都不能替代真实提供器取消与进程终止测试。
