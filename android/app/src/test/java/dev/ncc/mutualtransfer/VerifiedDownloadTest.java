package dev.ncc.mutualtransfer;

import org.junit.Test;
import static org.junit.Assert.*;
import java.io.*;
import java.security.MessageDigest;
import java.util.concurrent.atomic.AtomicBoolean;

public class VerifiedDownloadTest {
    private static String digest(byte[] bytes) throws Exception {
        StringBuilder value = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes)) value.append(String.format("%02x", b & 255));
        return value.toString();
    }
    @Test public void streamsExactBytesAcrossBufferBoundary() throws Exception {
        byte[] bytes = new byte[65537]; for (int i = 0; i < bytes.length; i++) bytes[i] = (byte)i;
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        assertEquals(bytes.length, VerifiedDownload.copy(new ByteArrayInputStream(bytes), output, digest(bytes), bytes.length, () -> false));
        assertArrayEquals(bytes, output.toByteArray());
        assertEquals(0, VerifiedDownload.copy(new ByteArrayInputStream(new byte[0]), new ByteArrayOutputStream(), digest(new byte[0]), 0, () -> false));
    }
    @Test public void rejectsTruncationWrongDigestOversizeAndCancellation() throws Exception {
        byte[] bytes = new byte[]{1, 2, 3};
        for (long size : new long[]{2, 4, VerifiedDownload.MAX_BYTES + 1}) {
            try { VerifiedDownload.copy(new ByteArrayInputStream(bytes), new ByteArrayOutputStream(), digest(bytes), size, () -> false); fail(); } catch (IOException expected) { }
        }
        try { VerifiedDownload.copy(new ByteArrayInputStream(bytes), new ByteArrayOutputStream(), "0".repeat(64), -1, () -> false); fail(); } catch (IOException expected) { }
        AtomicBoolean cancelled = new AtomicBoolean();
        OutputStream sink = new OutputStream() { @Override public void write(int value) { cancelled.set(true); } };
        try { VerifiedDownload.copy(new ByteArrayInputStream(bytes), sink, digest(bytes), 3, cancelled::get); fail(); } catch (IOException expected) { }
    }
}
