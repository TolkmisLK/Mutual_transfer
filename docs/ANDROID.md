# Android client development preview

The `android/` project packages the existing responsive file-space interface in an Android WebView with native document selection and a bounded, checksum-verified download path. It is a client for an already-running Mutual Transfer server, not an Android file server or background transfer service.

## Connect and transfer

Use Android 8.0 (API 26) or newer with an up-to-date system WebView. Enter the server HTTPS origin, for example `https://files.example.test:8787`, then connect and sign in with a workspace key or temporary pairing code. Plain HTTP, embedded credentials and address paths/query strings are rejected. The system must trust the certificate and its hostname; an explicitly installed user CA is supported for a private network. SSL errors cannot be bypassed.

Choose files through Android's document picker (up to 100 in one selection), then keep the application in the foreground. Downloads ask for a new document location and stream with a 64 KiB buffer, a 100 GiB bound, and exact SHA-256/length verification. Redirected downloads are rejected. Cancellation, disconnection, HTTP errors and checksum failures attempt to remove the incomplete destination; a failed removal asks the user to delete it manually. Uploads use the existing web chunk/resume protocol. Re-select the same source file to resume an interrupted upload. Downloads currently restart from the beginning.

**断开并清理** clears this application's web cookies/cache/storage and cancels its local pending work. It does not revoke already-issued server sessions on other devices. Use the server's paired-session controls for remote revocation. A process restart or activity recreation opens a fresh address-entry screen; no saved origin/key or background-resume guarantee is provided.

## Boundaries

Only INTERNET permission is declared; no broad filesystem, camera, microphone or gallery access is requested. Explicitly selected content URIs are checked before being passed to the WebView, and providers belonging to this app are refused. JavaScript supports the existing app, with no native JavaScript bridge. File/content URL access, mixed content, third-party cookies, popups and web permission prompts are disabled. Downloads use validated same-origin URLs and cookies, normal certificate verification and no automatic redirects.

The debug APK is signed with an ephemeral CI debug key. It is not a stable release, store distribution, a persistent signing identity or an update channel. Future builds may need uninstall/reinstall. Local services, downloaded files and browser sessions are separate from this app's installation.

## Build and evidence

Use JDK 17, Gradle 9.3.1, AGP 9.1.1 and Android SDK 36. Run `gradle --no-daemon -p android testDebugUnitTest lintDebug assembleDebug`. The Android workflow additionally runs the actual activity on an API 35 emulator, checks its restricted WebView settings and plaintext-address rejection, and captures the native screen.

Candidate `75a384b` passed Android CI `35222593464`: compilation, five JVM tests, lint (six warnings, no errors), an API 35 emulator activity/security test and debug APK creation. Its actual screenshot was downloaded and reviewed; the APK SHA-256 matched and ZIP integrity passed. The preceding failure was screenshot extraction after UTP removed app-scoped files; test-only shell capture now survives that cleanup. Follow-up changes add explicit cloud/device-transfer exclusions, an installed-resource regression, a launcher icon, legible status-bar icons and request-policy race protection; these changes still await their own CI. The JavaScript/user-CA lint warnings reflect intentional, documented client behavior, not a security certification.

The current local environment has a Java runtime but no javac, Gradle or Android SDK; no local Android build is claimed. Real trusted-LAN login, Android document-provider upload/download, Wi-Fi interruption, certificate enrollment, activity rotation, background/lock-screen behavior and physical-device installation remain separate unaccepted gates. Explicit backup exclusions cover this application's local state, not files the user saved through another document provider; that provider's backup policy is outside this app's control.

References: [AGP compatibility](https://developer.android.com/build/releases/agp-9-1-0-release-notes), [file chooser validation](https://developer.android.com/reference/android/webkit/WebChromeClient.FileChooserParams).

## Isolated HTTPS interoperability gate (pending)

The additional `acceptance` build type has a distinct application ID and trusts one generated, one-day CI certificate. Its public certificate exists only in that source set; its private key remains in a new private temporary server directory. Neither the acceptance APK nor test assets/credentials are uploaded. The ordinary debug APK is built and tested separately and checked not to contain the test certificate or connection asset. No CA is installed into the emulator/system and no trust manager or hostname verifier is replaced.

The planned emulator scenario loads the actual Node service through HTTPS, logs in through the shipped WebView page, invokes its upload handler with a generated 4 MiB + 65,537 byte File, and verifies a native HTTPS download through the production streaming checksum helper. A second address forwarded to the same server must fail TLS hostname verification. Disconnect must clear the client cookie. This is not an Android document picker/provider acceptance, a production-certificate enrollment test, physical Wi-Fi transfer, or a claim that the acceptance APK can be distributed. CI for this new gate is pending.
