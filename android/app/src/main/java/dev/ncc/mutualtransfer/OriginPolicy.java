package dev.ncc.mutualtransfer;

import java.net.URI;
import java.util.Locale;

/** Pure policy boundary, also exercised by local JVM tests. */
public final class OriginPolicy {
    private final URI origin;
    public OriginPolicy(String address) {
        URI value = parse(address.trim());
        if (!safe(value) || value.getQuery() != null || value.getFragment() != null ||
            !(value.getPath().isEmpty() || value.getPath().equals("/"))) throw new IllegalArgumentException("Use an HTTPS server origin without credentials, path or query.");
        origin = URI.create("https://" + value.getRawAuthority().toLowerCase(Locale.ROOT) + "/");
    }
    private static URI parse(String value) { try { return new URI(value); } catch (Exception error) { throw new IllegalArgumentException("Invalid address."); } }
    private static boolean safe(URI value) { return "https".equalsIgnoreCase(value.getScheme()) && value.getHost() != null && value.getUserInfo() == null && value.getPort() != 0 && value.getPort() <= 65535; }
    private static int port(URI value) { return value.getPort() == -1 ? 443 : value.getPort(); }
    public String address() { return origin.toString(); }
    public boolean allows(String address) {
        try { URI value = parse(address); return safe(value) && origin.getHost().equalsIgnoreCase(value.getHost()) && port(origin) == port(value); }
        catch (IllegalArgumentException error) { return false; }
    }
    public boolean isDownload(String address) {
        if (!allows(address)) return false;
        URI value = parse(address);
        return value.getQuery() == null && value.getFragment() == null && value.getRawPath().matches("/api/transfers/[a-f0-9-]{36}/download");
    }
    public static String digest(String etag) {
        if (etag == null || !etag.matches("\"[a-f0-9]{64}\"")) throw new IllegalArgumentException("Missing verified SHA-256 ETag.");
        return etag.substring(1, 65);
    }
}
