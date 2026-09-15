// No caches, background upload, credentials or file interception.
// New versions wait for existing clients to close; never force reload an upload.
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || url.origin !== self.location.origin || url.pathname !== '/' || url.search) return;
  event.respondWith(fetch(request).catch(() => new Response(
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mutual Transfer · 连接中断</title><style>body{max-width:36rem;margin:12vh auto;padding:24px;font:18px/1.8 system-ui;background:#f4f8fb;color:#203745}a{color:#185e8f}</style><h1>暂时无法连接文件空间</h1><p>请连接到原局域网，并确认服务电脑仍在运行。此页面没有缓存文件、文件列表、访问密钥或配对码。</p><p>恢复连接后重新打开文件空间。如上传中断，重新选择原文件即可按服务器保存的进度续传。请保持应用在前台。</p><a href="/">重新连接</a></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'", 'X-Content-Type-Options': 'nosniff' } },
  )));
});
