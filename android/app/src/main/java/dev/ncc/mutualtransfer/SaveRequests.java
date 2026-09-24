package dev.ncc.mutualtransfer;

import java.util.concurrent.atomic.AtomicBoolean;
import javax.net.ssl.HttpsURLConnection;

/** UI-thread ownership of document-picker requests; workers retain their own cancellation. */
final class SaveRequests {
    static final int FIRST_CODE = 0x1000, LAST_CODE = 0xffff;
    static final class Request {
        final int code, generation;
        final String url, cookie;
        final AtomicBoolean cancelled = new AtomicBoolean();
        volatile HttpsURLConnection connection;
        Request(int code, int generation, String url, String cookie) {
            this.code = code; this.generation = generation; this.url = url; this.cookie = cookie;
        }
        void cancel() {
            cancelled.set(true);
            HttpsURLConnection current = connection;
            if (current != null) current.disconnect();
        }
    }
    private int nextCode;
    private Request active;
    SaveRequests(int nextCode) {
        if (nextCode < FIRST_CODE || nextCode > LAST_CODE + 1) throw new IllegalArgumentException("Invalid save request counter");
        this.nextCode = nextCode;
    }
    int nextCode() { return nextCode; }
    boolean busy() { return active != null; }
    static boolean isSaveCode(int code) { return code >= FIRST_CODE && code <= LAST_CODE; }
    Request begin(int generation, String url, String cookie) {
        if (active != null || nextCode > LAST_CODE) throw new IllegalStateException("No save request slot available");
        Request request = new Request(nextCode++, generation, url, cookie);
        active = request;
        return request;
    }
    Request forResult(int code) { return active != null && active.code == code ? active : null; }
    void finish(Request request) { if (active == request) active = null; }
    void cancelActive() { if (active != null) active.cancel(); }
    void invalidate() { cancelActive(); active = null; }
}
