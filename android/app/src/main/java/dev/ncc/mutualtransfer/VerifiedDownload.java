package dev.ncc.mutualtransfer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.function.BooleanSupplier;

/** Bounded streaming copy; the caller removes the selected document on failure. */
public final class VerifiedDownload {
    static final long MAX_BYTES = 100L * 1024 * 1024 * 1024;
    private VerifiedDownload() { }
    public static long copy(InputStream input, OutputStream output, String expected, long size, BooleanSupplier cancelled) throws IOException {
        if (expected == null || !expected.matches("[a-f0-9]{64}") || size < -1 || size > MAX_BYTES) throw new IOException("Invalid download metadata");
        final MessageDigest digest;
        try { digest = MessageDigest.getInstance("SHA-256"); } catch (NoSuchAlgorithmException error) { throw new IOException(error); }
        byte[] buffer = new byte[65536]; long count = 0;
        while (true) {
            if (cancelled.getAsBoolean()) throw new IOException("Cancelled");
            int read = input.read(buffer);
            if (read == -1) break;
            if (cancelled.getAsBoolean() || count + read > MAX_BYTES || (size >= 0 && count + read > size)) throw new IOException("Cancelled or oversized response");
            output.write(buffer, 0, read); digest.update(buffer, 0, read); count += read;
        }
        StringBuilder actual = new StringBuilder();
        for (byte value : digest.digest()) actual.append(String.format(Locale.ROOT, "%02x", value & 255));
        if (cancelled.getAsBoolean() || (size >= 0 && size != count) || !expected.contentEquals(actual)) throw new IOException("Incomplete response or checksum mismatch");
        output.flush();
        if (cancelled.getAsBoolean()) throw new IOException("Cancelled while flushing destination");
        return count;
    }
}
