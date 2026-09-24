package dev.ncc.mutualtransfer;

import android.os.ParcelFileDescriptor;
import android.security.NetworkSecurityPolicy;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.FileInputStream;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class ClientStartupTest {
    @Test public void installedAppDisablesBackupAndExcludesEveryTransferDomain() throws Exception {
        android.content.Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals(0, context.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_ALLOW_BACKUP);
        java.util.Set<String> domains = new java.util.HashSet<>(java.util.Arrays.asList("root", "file", "database", "sharedpref", "external", "device_root", "device_file", "device_database", "device_sharedpref"));
        java.util.Map<String, java.util.Set<String>> found = new java.util.HashMap<>(); String section = null;
        try (android.content.res.XmlResourceParser xml = context.getResources().getXml(R.xml.data_extraction_rules)) {
            for (int event = xml.getEventType(); event != org.xmlpull.v1.XmlPullParser.END_DOCUMENT; event = xml.next()) {
                if (event == org.xmlpull.v1.XmlPullParser.START_TAG) {
                    String name = xml.getName(); assertNotEquals("include", name);
                    if (name.equals("cloud-backup") || name.equals("device-transfer")) { section = name; found.put(name, new java.util.HashSet<>()); }
                    if (name.equals("exclude")) { assertNotNull(section); assertEquals(".", xml.getAttributeValue(null, "path")); found.get(section).add(xml.getAttributeValue(null, "domain")); }
                } else if (event == org.xmlpull.v1.XmlPullParser.END_TAG && xml.getName().equals(section)) section = null;
            }
        }
        assertEquals(domains, found.get("cloud-backup")); assertEquals(domains, found.get("device-transfer"));
    }
    private <T> T find(View view, Class<T> type, String text) {
        if (type.isInstance(view) && (text == null || (view instanceof TextView && ((TextView)view).getText().toString().equals(text)))) return type.cast(view);
        if (view instanceof ViewGroup) for (int i = 0; i < ((ViewGroup)view).getChildCount(); i++) {
            T result = find(((ViewGroup)view).getChildAt(i), type, text); if (result != null) return result;
        }
        return null;
    }
    @Test public void recreationDetachesOldWebViewAndCreatesFreshRestrictedView() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            for (int round = 0; round < 2; round++) {
                java.util.concurrent.atomic.AtomicReference<MainActivity> previous = new java.util.concurrent.atomic.AtomicReference<>();
                java.util.concurrent.atomic.AtomicReference<WebView> previousWeb = new java.util.concurrent.atomic.AtomicReference<>();
                java.util.concurrent.atomic.AtomicReference<ViewGroup> previousParent = new java.util.concurrent.atomic.AtomicReference<>();
                scenario.onActivity(activity -> {
                    WebView view = find(activity.getWindow().getDecorView(), WebView.class, null);
                    assertNotNull(view); assertTrue(view.getParent() instanceof ViewGroup);
                    previous.set(activity); previousWeb.set(view); previousParent.set((ViewGroup) view.getParent());
                });
                scenario.recreate();
                scenario.onActivity(activity -> {
                    assertNotSame(previous.get(), activity); assertTrue(previous.get().isDestroyed());
                    // Inspect the former parent, never call methods on a destroyed WebView.
                    assertEquals(-1, previousParent.get().indexOfChild(previousWeb.get()));
                    View root = activity.getWindow().getDecorView(); WebView view = find(root, WebView.class, null);
                    assertNotNull(view); assertNotSame(previousWeb.get(), view); assertNull(view.getUrl());
                    assertFalse(view.getSettings().getAllowFileAccess()); assertFalse(view.getSettings().getAllowContentAccess());
                    assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, view.getSettings().getMixedContentMode());
                    find(root, EditText.class, null).setText("http://192.168.1.2:8787");
                    find(root, Button.class, "连接").performClick();
                    assertNotNull(find(root, TextView.class, "请输入仅含地址和端口的 HTTPS 网址，不要附带密码、路径或查询参数。"));
                    assertNull(view.getUrl());
                });
            }
        }
    }
    @Test public void actualActivityRejectsPlaintextAndUsesRestrictedWebView() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                View root = activity.getWindow().getDecorView(); WebView web = find(root, WebView.class, null);
                assertNotNull(web); WebSettings settings = web.getSettings();
                assertFalse(settings.getAllowFileAccess()); assertFalse(settings.getAllowContentAccess());
                assertFalse(settings.getAllowUniversalAccessFromFileURLs()); assertFalse(settings.getJavaScriptCanOpenWindowsAutomatically());
                assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW, settings.getMixedContentMode());
                assertFalse(NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted());
                find(root, EditText.class, null).setText("http://192.168.1.2:8787");
                find(root, Button.class, "连接").performClick();
                assertNotNull(find(root, TextView.class, "请输入仅含地址和端口的 HTTPS 网址，不要附带密码、路径或查询参数。"));
                assertNull(web.getUrl());
            });
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            // UTP uninstalls the tested APK after the suite, removing app-scoped files.
            // Capture through the test-only shell into a shell-owned path instead.
            try (ParcelFileDescriptor capture = InstrumentationRegistry.getInstrumentation().getUiAutomation()
                    .executeShellCommand("screencap -p /data/local/tmp/mutual-transfer-startup.png");
                 FileInputStream completion = new FileInputStream(capture.getFileDescriptor())) {
                assertEquals("screencap reported an error", -1, completion.read());
            }
        }
    }
}
