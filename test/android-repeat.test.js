import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyRepeatedAndroid } from '../tool/android-repeat.js';

test('Android reliability gate requires exactly three successful rounds', () => {
  let runs = 0; const reports = [];
  assert.equal(verifyRepeatedAndroid(() => { runs++; return { status: 0 }; }, entry => reports.push(entry)), 0);
  assert.equal(runs, 3);
  assert.deepEqual(reports, [1, 2, 3].flatMap(round => [
    { androidAcceptanceRound: round, state: 'started' },
    { androidAcceptanceRound: round, state: 'passed' },
  ]));
});

test('Android reliability gate stops at the first failure and preserves exit status', () => {
  let runs = 0; const reports = [];
  assert.equal(verifyRepeatedAndroid(() => ({ status: ++runs === 1 ? 0 : 37 }), entry => reports.push(entry)), 37);
  assert.equal(runs, 2);
  assert.deepEqual(reports.at(-1), { androidAcceptanceRound: 2, state: 'failed' });
});

test('Android spawn failure or signal cannot become success or leak diagnostics', () => {
  for (const result of [{ status: null, error: new Error('private-token') }, { status: null, signal: 'SIGTERM' }]) {
    let runs = 0; const reports = [];
    assert.equal(verifyRepeatedAndroid(() => { runs++; return result; }, entry => reports.push(entry)), 1);
    assert.equal(runs, 1);
    assert.doesNotMatch(JSON.stringify(reports), /private|SIGTERM/);
  }
});
