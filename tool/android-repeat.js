import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// A fixed reliability gate, not retry-until-green. Each invocation owns and
// cleans up its fresh HTTPS fixture before the next round may start.
export function verifyRepeatedAndroid(run, report = () => {}) {
  for (let round = 1; round <= 3; round++) {
    report({ androidAcceptanceRound: round, state: 'started' });
    const result = run();
    if (result.error || result.signal || result.status !== 0) {
      report({ androidAcceptanceRound: round, state: 'failed' });
      return Number.isInteger(result.status) && result.status > 0 && result.status < 256 ? result.status : 1;
    }
    report({ androidAcceptanceRound: round, state: 'passed' });
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = verifyRepeatedAndroid(
    () => spawnSync('bash', ['tool/verify-android.sh'], { stdio: 'inherit' }),
    entry => console.log(JSON.stringify(entry)),
  );
}
