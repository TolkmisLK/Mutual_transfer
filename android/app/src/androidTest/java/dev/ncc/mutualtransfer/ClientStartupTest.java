package dev.ncc.mutualtransfer;

import android.graphics.Bitmap;
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
import java.io.File;
import java.io.FileOutputStream;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class ClientStartupTest {
    private <T> T find(View view, Class<T> type, String text) {
        if (type.isInstance(view) && (text == null || (view instanceof TextView && ((TextView)view).getText().toString().equals(text)))) return type.cast(view);
        if (view instanceof ViewGroup) for (int i = 0; i < ((ViewGroup)view).getChildCount(); i++) {
            T result = find(((ViewGroup)view).getChildAt(i), type, text); if (result != null) return result;
        }
        return null;
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
            Bitmap screenshot = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            assertNotNull(screenshot);
            File file = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "client-startup.png");
            try (FileOutputStream output = new FileOutputStream(file)) { assertTrue(screenshot.compress(Bitmap.CompressFormat.PNG, 100, output)); }
            screenshot.recycle();
        }
    }
}
