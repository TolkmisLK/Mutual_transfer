package dev.ncc.mutualtransfer;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

public class DownloadQueueTest {
    @Test public void closingDrainsAcceptedCleanupInsteadOfDiscardingQueuedDestinations() throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        DownloadQueue queue = new DownloadQueue(executor);
        CountDownLatch started = new CountDownLatch(1), release = new CountDownLatch(1);
        AtomicBoolean invalidated = new AtomicBoolean(), interrupted = new AtomicBoolean();
        AtomicInteger cleanup = new AtomicInteger(), transfers = new AtomicInteger();
        try {
            queue.execute(() -> {
                started.countDown();
                try { release.await(); } catch (InterruptedException error) { interrupted.set(true); }
                finally { cleanup.incrementAndGet(); }
            });
            assertTrue(started.await(5, TimeUnit.SECONDS));
            queue.execute(() -> {
                try { if (!invalidated.get()) transfers.incrementAndGet(); }
                finally { cleanup.incrementAndGet(); }
            });
            invalidated.set(true); queue.close(); queue.close();
            assertTrue(executor.isShutdown());
            try { queue.execute(() -> transfers.incrementAndGet()); fail("Closed queue accepted another save"); }
            catch (RejectedExecutionException expected) { }
            release.countDown();
            assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS));
            assertEquals(2, cleanup.get()); assertEquals(0, transfers.get()); assertFalse(interrupted.get());
        } finally { release.countDown(); executor.shutdownNow(); }
    }
}
