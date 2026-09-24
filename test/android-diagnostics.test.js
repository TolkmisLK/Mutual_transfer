import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCrash, summarizePhases, relevantCrashes } from '../tool/android-diagnostics.js';

test('Android failure diagnostics omit message, URL, cookie and unrecognized frames', () => {
  const report = summarizeCrash(`E AndroidRuntime: FATAL EXCEPTION: main
E AndroidRuntime: java.lang.IllegalStateException: secret-password Cookie=session-private https://secret.example/path
E AndroidRuntime: at dev.ncc.mutualtransfer.MainActivity.onDestroy(MainActivity.java:159)
E AndroidRuntime: at androidx.test.core.app.ActivityScenario.onActivity(ActivityScenario.java:10)
E AndroidRuntime: at other.private.Client.send(secret-password.java:1)
F libc: Fatal signal 11 (SIGSEGV), code 1
E AndroidRuntime: dev.ncc.BadException: private-token
unstructured secret-password`);
  assert.deepEqual(report, { fatalSignal: true, fatalJava: true, javaFatalCount: 1, fatalRole: null, fatalThread: 'main', fatalTime: null, classes: ['java.lang.IllegalStateException', 'dev.ncc.BadException'], frames: ['dev.ncc.mutualtransfer.MainActivity.onDestroy(MainActivity.java:159)', 'androidx.test.core.app.ActivityScenario.onActivity(ActivityScenario.java:10)'] });
  assert.doesNotMatch(JSON.stringify(report), /secret|private|Cookie|https/);
  assert.deepEqual(summarizeCrash('arbitrary private text'), { fatalSignal: false, fatalJava: false, javaFatalCount: 0, fatalRole: null, fatalThread: null, fatalTime: null, classes: [], frames: [] });
});

test('Android provider frames and fixed phases retain call-site evidence without log contents', () => {
  const crash = summarizeCrash(`E AndroidRuntime: FATAL EXCEPTION: save-worker
E AndroidRuntime: Process: dev.ncc.mutualtransfer.acceptance, PID: 123
E AndroidRuntime: java.lang.IllegalStateException: Cookie=secret https://private.example
E AndroidRuntime: at com.android.providers.downloads.DownloadProvider.update(DownloadProvider.java:1650)
E AndroidRuntime: at android.content.ContentProviderClient.update(ContentProviderClient.java:222)
E AndroidRuntime: at com.android.providers.downloads.DownloadProvider$$ExternalSyntheticLambda2.run(D8$$SyntheticClass:0)
E AndroidRuntime: at other.private.Provider.update(Provider.java:1)`);
  assert.deepEqual(crash.frames, [
    'com.android.providers.downloads.DownloadProvider.update(DownloadProvider.java:1650)',
    'android.content.ContentProviderClient.update(ContentProviderClient.java:222)',
    'com.android.providers.downloads.DownloadProvider$$ExternalSyntheticLambda2.run(D8$$SyntheticClass:0)',
  ]);
  assert.equal(crash.fatalRole, 'app');
  assert.equal(crash.fatalThread, 'other');
  const history = summarizePhases(`09-24 12:00:00.000  123  456 I MutualAcceptance: phase=scenario-start
09-24 12:00:01.000  123  456 I MutualAcceptance: phase=source-publish-start
09-24 12:00:02.000  123  789 I MutualTransferSave: phase=destination-close-start
09-24 12:00:02.100  123  789 I MutualAcceptance: phase=picker-recreate-complete
09-24 12:00:02.200  123  789 I MutualTransferSave: phase=stale-delete-removed
09-24 12:00:03.000  123  789 I MutualTransferSave: phase=destination-close-complete Cookie=secret
09-24 12:00:04.000  123  789 I MutualTransferSave: phase=not-allowlisted
09-24 12:00:05.000  123  789 I OtherTag: phase=failed-delete-start`);
  assert.deepEqual(history, ['MutualAcceptance:scenario-start', 'MutualAcceptance:source-publish-start', 'MutualTransferSave:destination-close-start', 'MutualAcceptance:picker-recreate-complete', 'MutualTransferSave:stale-delete-removed']);
  assert.doesNotMatch(JSON.stringify({ crash, history }), /secret|private|Cookie|https/);
});

test('the final fatal block keeps frame order and classifies process without exposing it', () => {
  const summary = summarizeCrash(`09-24 12:00:01.000 E AndroidRuntime: FATAL EXCEPTION: main
09-24 12:00:01.001 E AndroidRuntime: Process: com.android.providers.downloads, PID: 10
09-24 12:00:01.002 E AndroidRuntime: java.lang.IllegalArgumentException: earlier-secret
09-24 12:00:01.003 E AndroidRuntime: at android.os.Parcel.readException(Parcel.java:1)
09-24 12:00:02.000 E AndroidRuntime: FATAL EXCEPTION: Thread-7
09-24 12:00:02.001 E AndroidRuntime: Process: dev.ncc.mutualtransfer.acceptance.test, PID: 20
09-24 12:00:02.002 E AndroidRuntime: java.lang.IllegalStateException: later-secret
09-24 12:00:02.003 E AndroidRuntime: at android.os.Parcel.readException(Parcel.java:2)
09-24 12:00:02.004 E AndroidRuntime: at android.os.Parcel.readException(Parcel.java:3)`);
  assert.equal(summary.javaFatalCount, 2);
  assert.equal(summary.fatalRole, 'test');
  assert.equal(summary.fatalThread, 'worker');
  assert.equal(summary.fatalTime, '09-24 12:00:02.000');
  assert.deepEqual(summary.classes, ['java.lang.IllegalStateException']);
  assert.deepEqual(summary.frames, ['android.os.Parcel.readException(Parcel.java:2)', 'android.os.Parcel.readException(Parcel.java:3)']);
  assert.doesNotMatch(JSON.stringify(summary), /earlier-secret|later-secret|\.acceptance\.test/);
});

test('the crash gate catches an earlier DownloadProvider fatal even after an unrelated system fatal', () => {
  const provider = `E AndroidRuntime: FATAL EXCEPTION: provider-worker
E AndroidRuntime: Process: android.process.media, PID: 123
E AndroidRuntime: java.lang.IllegalStateException: private-file-path
E AndroidRuntime: at android.content.ContentProviderClient.update(ContentProviderClient.java:417)
E AndroidRuntime: at com.android.providers.downloads.DownloadProvider.updateMediaProvider(DownloadProvider.java:957)
E AndroidRuntime: at com.android.providers.downloads.DownloadProvider$1.onClose(DownloadProvider.java:1775)`;
  const unrelated = `E AndroidRuntime: FATAL EXCEPTION: main
E AndroidRuntime: Process: other.system.service, PID: 456
E AndroidRuntime: java.lang.IllegalStateException: unrelated-secret
E AndroidRuntime: at android.os.Parcel.readException(Parcel.java:3209)`;
  assert.equal(relevantCrashes('').length, 0);
  assert.equal(relevantCrashes(unrelated).length, 0);
  const reports = relevantCrashes(`${provider}\n${unrelated}`);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].fatalRole, 'media-provider');
  assert.ok(reports[0].frames.some(frame => frame.includes('DownloadProvider$1.onClose')));
  assert.doesNotMatch(JSON.stringify(reports), /private-file-path|unrelated-secret|PID|android\.process\.media/);
  assert.equal(relevantCrashes(provider.replace('android.process.media', 'unknown.system.process')).length, 1);
  assert.equal(relevantCrashes(unrelated.replace('other.system.service', 'dev.ncc.mutualtransfer.acceptance')).length, 1);
});
