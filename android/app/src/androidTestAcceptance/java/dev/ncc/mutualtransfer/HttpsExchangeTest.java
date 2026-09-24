package dev.ncc.mutualtransfer;

import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.MotionEvent;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.*;
import java.net.URL;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Real emulator WebView, system DocumentsUI and native TLS against the actual Node service. */
@RunWith(AndroidJUnit4.class)
public class HttpsExchangeTest {
    private void phase(String name) { android.util.Log.i("MutualAcceptance", "phase=" + name); }
    private <T> T find(View view, Class<T> type, String text) {
        if (type.isInstance(view) && (text == null || (view instanceof TextView && ((TextView)view).getText().toString().equals(text)))) return type.cast(view);
        if (view instanceof ViewGroup) for (int i = 0; i < ((ViewGroup)view).getChildCount(); i++) {
            T result = find(((ViewGroup)view).getChildAt(i), type, text); if (result != null) return result;
        }
        return null;
    }
    private String js(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1); AtomicReference<String> answer = new AtomicReference<>();
        scenario.onActivity(activity -> find(activity.getWindow().getDecorView(), WebView.class, null).evaluateJavascript(script, value -> { answer.set(value); done.countDown(); }));
        assertTrue("WebView did not answer", done.await(10, TimeUnit.SECONDS)); return answer.get();
    }
    private void waitJs(ActivityScenario<MainActivity> scenario, String script) throws Exception {
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(60);
        while (System.nanoTime() < end) { if ("true".equals(js(scenario, script))) return; Thread.sleep(200); }
        fail("WebView condition did not become true (no credentials logged)");
    }
    private void tapElement(ActivityScenario<MainActivity> scenario, String selector) throws Exception {
        String quoted = JSONObject.quote(selector);
        js(scenario, "document.querySelector(" + quoted + ").scrollIntoView({block:'center'})");
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        JSONObject point = new JSONObject(js(scenario, "(()=>{const r=document.querySelector(" + quoted + ").getBoundingClientRect();return {x:(r.left+r.width/2)*devicePixelRatio,y:(r.top+r.height/2)*devicePixelRatio}})()"));
        int[] location = new int[2]; scenario.onActivity(a -> find(a.getWindow().getDecorView(), WebView.class, null).getLocationOnScreen(location));
        long time = SystemClock.uptimeMillis(); float x = location[0] + (float)point.getDouble("x"), y = location[1] + (float)point.getDouble("y");
        MotionEvent down = MotionEvent.obtain(time, time, MotionEvent.ACTION_DOWN, x, y, 0);
        MotionEvent up = MotionEvent.obtain(time, time + 50, MotionEvent.ACTION_UP, x, y, 0);
        try { InstrumentationRegistry.getInstrumentation().sendPointerSync(down); InstrumentationRegistry.getInstrumentation().sendPointerSync(up); }
        finally { down.recycle(); up.recycle(); }
    }
    private AccessibilityNodeInfo documentNode(AccessibilityNodeInfo node, String text, boolean editable) {
        if (node == null) return null;
        String pkg = String.valueOf(node.getPackageName());
        boolean documentUi = pkg.equals("com.android.documentsui") || pkg.equals("com.google.android.documentsui");
        if (documentUi && ((editable && node.isEditable()) || (!editable &&
            (text.equalsIgnoreCase(String.valueOf(node.getText())) || text.equalsIgnoreCase(String.valueOf(node.getContentDescription())))))) return node;
        for (int i = 0; i < node.getChildCount(); i++) { AccessibilityNodeInfo found = documentNode(node.getChild(i), text, editable); if (found != null) return found; }
        return null;
    }
    private AccessibilityNodeInfo waitDocumentNode(String text, boolean editable) throws Exception {
        long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(20);
        while (System.nanoTime() < end) {
            AccessibilityNodeInfo node = documentNode(InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow(), text, editable);
            if (node != null) return node;
            Thread.sleep(200);
        }
        throw new AssertionError("Expected system document picker control was not found");
    }
    private void clickDocument(String text) throws Exception {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(20);
        do {
            // DocumentsUI can replace nodes while switching roots. Retry only
            // an unaccepted action against a fresh node, never skip the action.
            AccessibilityNodeInfo node = documentNode(InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow(), text, false);
            while (node != null && !node.isClickable()) node = node.getParent();
            if (node != null && node.isEnabled() && node.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return;
            Thread.sleep(200);
        } while (System.nanoTime() < deadline);
        fail("System document picker did not accept the requested action");
    }
    @Test public void realHttpsLoginChunkUploadAndNativeVerifiedDownload() throws Exception {
        phase("scenario-start");
        JSONObject config;
        try (InputStream input = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open("connection.json")) {
            config = new JSONObject(new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
        }
        String origin = config.getString("origin");
        assertTrue(InstrumentationRegistry.getInstrumentation().getTargetContext().getPackageName().endsWith(".acceptance"));
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                View root = activity.getWindow().getDecorView(); find(root, EditText.class, null).setText(origin);
                find(root, Button.class, "连接").performClick();
            });
            waitJs(scenario, "!!document.getElementById('login') && typeof document.getElementById('login').onsubmit === 'function'");
            assertEquals("true", js(scenario, "window.isSecureContext && !!crypto.subtle"));
            js(scenario, "document.getElementById('key').value=" + JSONObject.quote(config.getString("key")) + ";document.getElementById('login').requestSubmit();");
            waitJs(scenario, "!document.getElementById('workspace').hidden && document.getElementById('list').textContent.includes('server-fixture.bin')");
            // Exercise the shipped upload handler and its real two-chunk protocol.
            js(scenario, "(()=>{const bytes=new Uint8Array(4194304+65537);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;const dt=new DataTransfer();dt.items.add(new File([bytes],'android-upload.bin'));const f=document.getElementById('files');f.files=dt.files;f.dispatchEvent(new Event('change'));})()");
            waitJs(scenario, "document.getElementById('status').textContent.includes('android-upload.bin 已上传并通过校验') && !document.getElementById('files').disabled");
            phase("browser-upload-complete");
            // Publish a generated fixture through the real Downloads provider,
            // then select it using actual system UI (no ActivityResult stubbing).
            android.content.ContentResolver resolver = InstrumentationRegistry.getInstrumentation().getTargetContext().getContentResolver();
            String suffix = java.util.UUID.randomUUID().toString();
            String sourceName = "provider-upload-" + suffix + ".bin";
            String savedName = "native-download-" + suffix + ".bin";
            String damagedName = "rejected-download-" + suffix + ".bin";
            android.content.ContentValues values = new android.content.ContentValues();
            values.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, sourceName);
            values.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "application/octet-stream");
            values.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS);
            values.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 1);
            android.net.Uri source = resolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            assertNotNull(source);
            phase("source-created");
            try {
                byte[] fixture = new byte[65537]; for (int i = 0; i < fixture.length; i++) fixture[i] = (byte)(i % 251);
                try (OutputStream out = resolver.openOutputStream(source)) { assertNotNull(out); out.write(fixture); }
                phase("source-write-complete");
                phase("source-publish-start");
                values.clear(); values.put(android.provider.MediaStore.MediaColumns.IS_PENDING, 0); resolver.update(source, values, null, null);
                phase("source-published");
                tapElement(scenario, "#files");
                clickDocument("Show roots"); clickDocument("Downloads"); clickDocument(sourceName);
                waitJs(scenario, "document.getElementById('status').textContent.includes(" + JSONObject.quote(sourceName + " 已上传并通过校验") + ") && !document.getElementById('files').disabled");
                phase("provider-upload-complete");
                phase("good-save-requested");
                tapElement(scenario, "a[href='" + config.getString("download") + "']");
                AccessibilityNodeInfo filename = waitDocumentNode("", true);
                android.os.Bundle text = new android.os.Bundle(); text.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, savedName);
                assertTrue(filename.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, text));
                clickDocument("Save");
                long savedDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30); java.util.concurrent.atomic.AtomicBoolean saved = new java.util.concurrent.atomic.AtomicBoolean();
                do {
                    scenario.onActivity(a -> saved.set(find(a.getWindow().getDecorView(), TextView.class, "保存完成，SHA-256 与服务器一致。该校验不替代对发送者的信任。") != null));
                    if (saved.get()) break; Thread.sleep(200);
                } while (System.nanoTime() < savedDeadline);
                assertTrue("Native document save did not complete", saved.get());
                phase("good-save-verified");
                try (android.os.ParcelFileDescriptor shell = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("cat /sdcard/Download/" + savedName);
                     FileInputStream input = new FileInputStream(shell.getFileDescriptor())) {
                    assertArrayEquals(fixture, input.readNBytes(65538));
                }
                // The same real server now sends a disposable file altered after
                // completion, with its original ETag. Use actual create-document
                // UI and the production downloader, not a helper/Activity stub.
                phase("damaged-save-requested");
                tapElement(scenario, "a[href='" + config.getString("damagedDownload") + "']");
                AccessibilityNodeInfo rejectedFilename = waitDocumentNode("", true);
                android.os.Bundle rejectedText = new android.os.Bundle();
                rejectedText.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, damagedName);
                assertTrue(rejectedFilename.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, rejectedText));
                clickDocument("Save");
                long rejectedDeadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(30);
                java.util.concurrent.atomic.AtomicBoolean rejected = new java.util.concurrent.atomic.AtomicBoolean();
                do {
                    scenario.onActivity(a -> rejected.set(find(a.getWindow().getDecorView(), TextView.class, "下载未完成或校验失败；请重新下载，不要使用残留文件。") != null));
                    if (rejected.get()) break; Thread.sleep(200);
                } while (System.nanoTime() < rejectedDeadline);
                assertTrue("Corrupted bytes must not be reported as saved", rejected.get());
                boolean removed = false;
                do {
                    // No shell operators: an independently successful directory
                    // listing must still contain the earlier good destination.
                    try (android.os.ParcelFileDescriptor shell = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("ls -1 /sdcard/Download/");
                         FileInputStream input = new FileInputStream(shell.getFileDescriptor())) {
                        java.util.List<String> names = java.util.Arrays.asList(new String(input.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).split("\\r?\\n"));
                        assertTrue("Destination directory listing must succeed", names.contains(savedName));
                        removed = !names.contains(damagedName);
                    }
                    if (removed) break; Thread.sleep(200);
                } while (System.nanoTime() < rejectedDeadline);
                assertTrue("Failed destination must actually be removed", removed);
                phase("damaged-save-removed");
                // Failure cleanup must not touch the earlier successful document.
                try (android.os.ParcelFileDescriptor shell = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("cat /sdcard/Download/" + savedName);
                     FileInputStream input = new FileInputStream(shell.getFileDescriptor())) { assertArrayEquals(fixture, input.readNBytes(65538)); }
            } finally {
                phase("source-cleanup-start");
                resolver.delete(source, null, null);
                phase("source-cleanup-complete");
                // Exact unique fixture path in this disposable emulator only.
                try (android.os.ParcelFileDescriptor cleanup = InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand("rm -f /sdcard/Download/" + savedName + " /sdcard/Download/" + damagedName);
                     FileInputStream completion = new FileInputStream(cleanup.getFileDescriptor())) { completion.readAllBytes(); }
            }
            AtomicReference<String> cookie = new AtomicReference<>(); scenario.onActivity(a -> cookie.set(CookieManager.getInstance().getCookie(origin)));
            assertNotNull(cookie.get());
            HttpsURLConnection request = (HttpsURLConnection)new URL(origin + config.getString("download")).openConnection();
            request.setConnectTimeout(15000); request.setReadTimeout(15000); request.setInstanceFollowRedirects(false); request.setRequestProperty("Cookie", cookie.get());
            try {
                assertEquals(200, request.getResponseCode()); ByteArrayOutputStream output = new ByteArrayOutputStream();
                try (InputStream input = request.getInputStream()) {
                    assertEquals(65537, VerifiedDownload.copy(input, output, OriginPolicy.digest(request.getHeaderField("ETag")), request.getContentLengthLong(), () -> false));
                }
                assertEquals(config.getString("hash"), OriginPolicy.digest(request.getHeaderField("ETag")));
                byte[] data = output.toByteArray(); for (int i = 0; i < data.length; i++) assertEquals((byte)(i % 251), data[i]);
            } finally { request.disconnect(); }
            // Same issuer but absent localhost SAN must still fail name verification.
            HttpsURLConnection wrong = (HttpsURLConnection)new URL("https://127.0.0.1:10878/").openConnection();
            wrong.setConnectTimeout(5000); wrong.setReadTimeout(5000);
            try { wrong.getInputStream().close(); fail("Wrong certificate hostname accepted"); }
            catch (javax.net.ssl.SSLException expected) { /* ordinary hostname verification */ }
            finally { wrong.disconnect(); }
            js(scenario, "document.getElementById('list').scrollIntoView({block:'start'})");
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            try (android.os.ParcelFileDescriptor capture = InstrumentationRegistry.getInstrumentation().getUiAutomation()
                    .executeShellCommand("screencap -p /data/local/tmp/mutual-transfer-https.png");
                 FileInputStream completion = new FileInputStream(capture.getFileDescriptor())) {
                assertEquals(-1, completion.read());
            }
            scenario.onActivity(a -> find(a.getWindow().getDecorView(), Button.class, "断开并清理").performClick());
            long end = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
            do { scenario.onActivity(a -> cookie.set(CookieManager.getInstance().getCookie(origin))); if (cookie.get() == null) break; Thread.sleep(100); } while (System.nanoTime() < end);
            assertNull("Disconnect must clear the application's session cookie", cookie.get());
        }
    }
}
