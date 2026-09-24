package dev.ncc.mutualtransfer;

import org.junit.Test;
import static org.junit.Assert.*;

public class SaveRequestsTest {
    @Test public void cancelledPickerCannotStartWorkOrCancelTheNextSave() {
        SaveRequests saves = new SaveRequests(SaveRequests.FIRST_CODE);
        SaveRequests.Request old = saves.begin(1, "https://example.test/old", "old-cookie");
        saves.cancelActive();
        assertTrue(old.cancelled.get());
        assertSame(old, saves.forResult(old.code));

        saves.invalidate();
        SaveRequests.Request next = saves.begin(2, "https://example.test/next", "next-cookie");
        assertNotEquals(old.code, next.code);
        assertNull(saves.forResult(old.code));
        saves.finish(old); // A delayed old result must leave the new request alone.
        assertSame(next, saves.forResult(next.code));
        assertFalse(next.cancelled.get());
        assertTrue(old.cancelled.get());
    }

    @Test public void recreatedActivityDoesNotReuseAnInFlightRequestCode() {
        SaveRequests former = new SaveRequests(SaveRequests.FIRST_CODE);
        SaveRequests.Request old = former.begin(0, "https://example.test/old", null);
        SaveRequests restored = new SaveRequests(former.nextCode());
        assertNull(restored.forResult(old.code));
        SaveRequests.Request next = restored.begin(0, "https://example.test/next", null);
        assertNotEquals(old.code, next.code);
        assertNull(restored.forResult(old.code));
        assertSame(next, restored.forResult(next.code));
    }
}
