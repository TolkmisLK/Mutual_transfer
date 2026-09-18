package dev.ncc.mutualtransfer;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Accepted saves own a newly created document, including while queued. */
final class DownloadQueue implements AutoCloseable {
    private final ExecutorService executor;
    DownloadQueue() { this(Executors.newSingleThreadExecutor()); }
    DownloadQueue(ExecutorService executor) { this.executor = executor; }
    void execute(Runnable save) { executor.execute(save); }
    @Override public void close() {
        // Activity invalidates generation and disconnects active HTTPS first.
        // Stale queued saves must still reach their finally/deleteDocument.
        // shutdownNow would discard those accepted tasks and orphan documents.
        executor.shutdown();
    }
}
