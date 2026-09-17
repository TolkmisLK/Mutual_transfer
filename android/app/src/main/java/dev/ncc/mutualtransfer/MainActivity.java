package dev.ncc.mutualtransfer;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ProviderInfo;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.os.Process;
import android.provider.DocumentsContract;
import android.view.View;
import android.view.WindowManager;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.HttpsURLConnection;

public final class MainActivity extends Activity {
    private static final int PICK = 10, SAVE = 11;
    private WebView web; private TextView status; private EditText address;
    private volatile OriginPolicy origin; private ValueCallback<Uri[]> picker;
    private String pendingDownload; private String pendingCookie;
    private final ExecutorService downloads = Executors.newSingleThreadExecutor();
    private final AtomicBoolean cancelled = new AtomicBoolean(); private volatile HttpsURLConnection connection;
    private boolean saving; private volatile int generation;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(16,16,16,8);
        root.setOnApplyWindowInsetsListener((view, insets) -> { view.setPadding(16 + insets.getSystemWindowInsetLeft(), 16 + insets.getSystemWindowInsetTop(), 16 + insets.getSystemWindowInsetRight(), 8 + insets.getSystemWindowInsetBottom()); return insets; });
        address = new EditText(this); address.setHint("https://电脑地址:8787"); address.setSingleLine(true); address.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI); root.addView(address);
        LinearLayout controls = new LinearLayout(this);
        Button open = new Button(this); open.setText("连接"); controls.addView(open);
        Button clear = new Button(this); clear.setText("断开并清理"); controls.addView(clear);
        Button cancel = new Button(this); cancel.setText("取消下载"); controls.addView(cancel); root.addView(controls);
        status = new TextView(this); status.setText("开发预览：仅受信任 HTTPS；上传需保持前台。无需存储或相册权限。"); root.addView(status);
        web = new WebView(this); root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1)); setContentView(root);
        WebSettings settings = web.getSettings(); settings.setJavaScriptEnabled(true); settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false); settings.setAllowContentAccess(false); settings.setAllowFileAccessFromFileURLs(false); settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); settings.setJavaScriptCanOpenWindowsAutomatically(false); settings.setSupportMultipleWindows(false);
        settings.setSafeBrowsingEnabled(true); WebView.setWebContentsDebuggingEnabled(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { OriginPolicy current = origin; return current == null || !current.allows(request.getUrl().toString()); }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                OriginPolicy current = origin;
                if (current != null && current.allows(request.getUrl().toString())) return null;
                return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) { handler.cancel(); show("证书验证失败。请由设备管理员配置可信 CA，不能跳过证书错误。"); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (origin == null || !origin.allows(view.getUrl()) || (params.getMode() != FileChooserParams.MODE_OPEN && params.getMode() != FileChooserParams.MODE_OPEN_MULTIPLE) || picker != null) { callback.onReceiveValue(null); return true; }
                picker = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(intent, PICK); } catch (Exception error) { picker = null; callback.onReceiveValue(null); show("无法打开系统文件选择器。"); }
                return true;
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, length) -> {
            if (saving || origin == null || !origin.isDownload(url)) { show("仅允许当前服务器的文件下载，且一次保存一个文件。"); return; }
            pendingDownload = url; pendingCookie = CookieManager.getInstance().getCookie(url); saving = true;
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/octet-stream").putExtra(Intent.EXTRA_TITLE, URLUtil.guessFileName(url, disposition, mime));
            try { startActivityForResult(intent, SAVE); } catch (Exception error) { clearDownload(); show("无法打开系统保存位置。"); }
        });
        open.setOnClickListener(view -> {
            if (saving || picker != null) { show("请先完成或取消文件选择与下载。"); return; }
            try { OriginPolicy next = new OriginPolicy(address.getText().toString()); disconnect(() -> { origin = next; web.loadUrl(next.address()); show("请在页面输入共享密钥或配对码。切到后台可能中断传输。"); }); }
            catch (IllegalArgumentException error) { show("请输入仅含地址和端口的 HTTPS 网址，不要附带密码、路径或查询参数。"); }
        });
        clear.setOnClickListener(view -> disconnect(() -> show("已清理此应用的网页会话；如需使其他设备失效，请在服务端撤销。")));
        cancel.setOnClickListener(view -> { cancelled.set(true); if (connection != null) connection.disconnect(); });
    }
    private void show(String message) { runOnUiThread(() -> { if (!isDestroyed()) status.setText(message); }); }
    private boolean safeDocument(Uri uri) {
        if (uri == null || !"content".equals(uri.getScheme()) || uri.getAuthority() == null) return false;
        try {
            ProviderInfo provider = getPackageManager().resolveContentProvider(uri.getAuthority(), 0);
            return provider != null && provider.applicationInfo != null && provider.applicationInfo.uid != Process.myUid();
        } catch (RuntimeException unavailable) { return false; }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data); Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
        if (request == PICK && picker != null) {
            ValueCallback<Uri[]> callback = picker; picker = null;
            java.util.ArrayList<Uri> selected = new java.util.ArrayList<>();
            if (result == RESULT_OK && data != null && data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                if (count > 100) { callback.onReceiveValue(null); show("一次最多选择 100 个文件。"); return; }
                for (int i = 0; i < count; i++) selected.add(data.getClipData().getItemAt(i).getUri());
            } else if (uri != null) selected.add(uri);
            for (Uri item : selected) {
                if (!safeDocument(item)) { callback.onReceiveValue(null); return; }
                try (android.os.ParcelFileDescriptor fd = getContentResolver().openFileDescriptor(item, "r")) { if (fd == null) throw new IOException(); }
                catch (Exception ignored) { callback.onReceiveValue(null); return; }
            }
            callback.onReceiveValue(selected.isEmpty() ? null : selected.toArray(new Uri[0]));
        } else if (request == SAVE && saving) {
            if (!safeDocument(uri) || pendingDownload == null) { clearDownload(); return; }
            String url = pendingDownload, cookie = pendingCookie; int current = generation; cancelled.set(false);
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); show("正在保存并校验 SHA-256，请保持应用在前台…");
            downloads.execute(() -> save(uri, url, cookie, current));
        }
    }
    private void save(Uri destination, String url, String cookie, int current) {
        boolean success = false; HttpsURLConnection request = null;
        try {
            OriginPolicy policy = origin; if (policy == null || !policy.isDownload(url) || current != generation) throw new IOException();
            request = (HttpsURLConnection) new URL(url).openConnection(); connection = request;
            request.setInstanceFollowRedirects(false); request.setConnectTimeout(15000); request.setReadTimeout(30000); request.setRequestProperty("Accept-Encoding", "identity");
            if (cookie != null) request.setRequestProperty("Cookie", cookie);
            if (request.getResponseCode() != 200) throw new IOException();
            String expected = OriginPolicy.digest(request.getHeaderField("ETag")); long size = request.getContentLengthLong();
            try (InputStream input = request.getInputStream(); OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
                if (output == null) throw new IOException();
                VerifiedDownload.copy(input, output, expected, size, () -> cancelled.get() || current != generation);
            }
            success = true; showFor(current, "保存完成，SHA-256 与服务器一致。该校验不替代对发送者的信任。");
        } catch (Exception error) { showFor(current, "下载未完成或校验失败；请重新下载，不要使用残留文件。"); }
        finally {
            if (request != null) request.disconnect(); if (connection == request) connection = null;
            if (!success) { try { if (!DocumentsContract.deleteDocument(getContentResolver(), destination)) showFor(current, "未完成文件无法自动清理，请在所选位置手动删除。"); } catch (Exception error) { showFor(current, "未完成文件无法自动清理，请在所选位置手动删除。"); } }
            runOnUiThread(() -> { if (current == generation && !isDestroyed()) { clearDownload(); getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); } });
        }
    }
    private void showFor(int current, String message) { runOnUiThread(() -> { if (current == generation && !isDestroyed()) status.setText(message); }); }
    private void clearDownload() { saving = false; pendingDownload = null; pendingCookie = null; }
    private void disconnect(Runnable done) {
        int current = ++generation; origin = null; cancelled.set(true); if (connection != null) connection.disconnect();
        if (picker != null) { picker.onReceiveValue(null); picker = null; } clearDownload(); getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web.stopLoading(); web.loadUrl("about:blank"); web.clearHistory(); web.clearCache(true); WebStorage.getInstance().deleteAllData();
        CookieManager.getInstance().removeAllCookies(value -> { if (!isDestroyed() && current == generation) done.run(); });
    }
    @Override protected void onPause() { web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { generation++; cancelled.set(true); if (connection != null) connection.disconnect(); if (picker != null) picker.onReceiveValue(null); downloads.shutdownNow(); web.destroy(); super.onDestroy(); }
}
