# Installable Web client and offline boundaries

The responsive client now advertises a same-origin Web App Manifest with a standalone window and a bundled SVG icon. On browsers that offer `beforeinstallprompt`, installation is available only after pressing the explicit install button. Other browsers may offer an install/add-to-home-screen menu. Browser support and OS installation UI differ: automated manifest checks are not proof that Android/iOS actually installed the app.

Use the same trusted HTTPS origin on each LAN device. Installation does not make an untrusted/self-signed certificate trusted, bypass a warning, discover servers automatically or keep the PC server running. Loopback HTTP is suitable only for local development. Non-loopback HTTP is not a secure context and the client explains why installation is unavailable.

The service worker handles **only** same-origin GET navigation to the exact root `/` without a query. It attempts the network and, when unavailable, returns a static 503 reconnection guide. It never uses Cache Storage, stores credentials, intercepts API/file/upload/download requests or saves a private file list. Normal authentication cookies remain managed by the browser and the existing one-hour server session, not by a new offline credential store. The offline page deliberately cannot list, preview or download server files.

Worker updates use the browser's normal lifecycle. They do not call `skipWaiting`, force an active page to reload, register background sync or claim reliable uploads after backgrounding, lock-screen, app closure or battery suspension. Keep the app in the foreground; after interruption, reconnect and reselect the original file to resume using its content hash and the server checkpoint. The source file is not kept in a worker cache. An installed window does not grant background-file access.

Uninstalling the Web app does not delete the PC's shared files and does not guarantee server logout. Use the existing logout and paired-session revocation controls as appropriate. A PWA is not an APK, native mobile client, signed desktop installer or consumer-device acceptance.

The CI scenario must demonstrate real worker registration/control, private offline navigation, unavailable APIs while offline, empty Cache Storage and resumption of a partially uploaded 9 MiB file without changing its transfer ID or final SHA-256. Desktop and mobile viewport results still do not establish actual OS installation, WiFi reliability or background operation. Refer to [VALIDATION.md](VALIDATION.md) for candidate results.

References: [MDN installable PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable), [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API).
