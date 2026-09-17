package dev.ncc.mutualtransfer;
import org.junit.Test;
import static org.junit.Assert.*;
public class OriginPolicyTest {
    @Test public void rejectsUnsafeOrigins() {
        for (String value : new String[]{"http://192.168.1.2", "file:///secret", "https://u:p@example.org", "https://example.org/path", "https://example.org/?key=secret", "https://example.org/#x", "https://example.org:0", "https://example.org:65536"}) {
            try { new OriginPolicy(value); fail(value); } catch (IllegalArgumentException expected) { }
        }
    }
    @Test public void bindsEveryRequestAndDownloadToOneOrigin() {
        OriginPolicy policy = new OriginPolicy("https://Example.org:443");
        assertTrue(policy.allows("https://example.org/api/transfers"));
        for (String url : new String[]{"https://example.org.evil.test/", "https://example.org:8443/", "http://example.org/", "https://x@example.org/", "intent://example.org/"}) assertFalse(policy.allows(url));
        assertTrue(policy.isDownload("https://example.org/api/transfers/12345678-1234-1234-1234-123456789abc/download"));
        assertFalse(policy.isDownload("https://example.org/api/transfers/12345678-1234-1234-1234-123456789abc/download?token=x"));
        assertFalse(policy.isDownload("https://example.org/api/transfers/12345678-1234-1234-1234-123456789abc/preview"));
    }
    @Test public void requiresAnExactDigest() {
        String hash = "a".repeat(64); assertEquals(hash, OriginPolicy.digest("\"" + hash + "\""));
        for (String value : new String[]{null, hash, "W/\"" + hash + "\"", "\"bad\""}) { try { OriginPolicy.digest(value); fail(); } catch (IllegalArgumentException expected) { } }
    }
}
