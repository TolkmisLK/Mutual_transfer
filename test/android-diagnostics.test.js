import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCrash } from '../tool/android-diagnostics.js';

test('Android failure diagnostics omit message, URL, cookie and unrecognized frames', () => {
  const report = summarizeCrash(`E AndroidRuntime: FATAL EXCEPTION: main
E AndroidRuntime: java.lang.IllegalStateException: secret-password Cookie=session-private https://secret.example/path
E AndroidRuntime: at dev.ncc.mutualtransfer.MainActivity.onDestroy(MainActivity.java:159)
E AndroidRuntime: at androidx.test.core.app.ActivityScenario.onActivity(ActivityScenario.java:10)
E AndroidRuntime: at other.private.Client.send(secret-password.java:1)
F libc: Fatal signal 11 (SIGSEGV), code 1
E AndroidRuntime: dev.ncc.BadException: private-token
unstructured secret-password`);
  assert.deepEqual(report, { fatalSignal: true, fatalJava: true, classes: ['java.lang.IllegalStateException', 'dev.ncc.BadException'], frames: ['dev.ncc.mutualtransfer.MainActivity.onDestroy(MainActivity.java:159)', 'androidx.test.core.app.ActivityScenario.onActivity(ActivityScenario.java:10)'] });
  assert.doesNotMatch(JSON.stringify(report), /secret|private|Cookie|https/);
  assert.deepEqual(summarizeCrash('arbitrary private text'), { fatalSignal: false, fatalJava: false, classes: [], frames: [] });
});
