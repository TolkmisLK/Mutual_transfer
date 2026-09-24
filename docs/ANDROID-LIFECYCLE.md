# Android lifecycle acceptance

The Activity now removes its WebView from the parent before calling `destroy()`, on the UI thread, then clears its own reference. This follows the [Android WebView destruction contract](https://developer.android.com/reference/android/webkit/WebView#destroy()). It is a concrete lifecycle correction, not a diagnosis of the previously intermittent `IllegalStateException`.

The installed-app instrumentation case recreates an idle Activity twice and checks that each former parent no longer contains its old WebView. It does not call methods on the destroyed WebView. Each replacement must be a different Activity/WebView, start without a loaded URL, retain file/content/mixed-content restrictions and still reject plaintext connections. Check the latest Android workflow run for its emulator result.

This case does not establish transfer survival, destination cleanup during rotation, foreground/background behavior, process-death recovery, physical orientation changes, or behavior across OEM and cloud document providers. The app remains foreground-only and recreation has no resume guarantee. Queue-draining has a separate controlled JVM regression; neither case substitutes for real provider cancellation and process-death testing.
