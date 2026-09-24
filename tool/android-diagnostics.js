import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Never print raw logcat: WebView/HTTP logs may include fixture credentials.
// Fixed grammars return class/frame names and bounded, credential-free phases.
const phases = new Set([
  'scenario-start', 'browser-upload-complete', 'source-created', 'source-write-complete',
  'source-publish-start', 'source-published', 'provider-upload-complete',
  'good-save-requested', 'good-save-verified', 'damaged-save-requested',
  'damaged-save-removed', 'source-cleanup-start', 'source-cleanup-complete',
  'picker-recreate-start', 'picker-recreate-complete', 'picker-recreate-cleaned',
  'next-save-verified', 'stale-delete-start', 'stale-delete-removed',
  'stale-delete-retained', 'stale-delete-error',
  'destination-open-start', 'destination-write-start', 'destination-close-start',
  'destination-copy-and-close-complete', 'failed-delete-start', 'failed-delete-removed',
  'failed-delete-retained', 'failed-delete-error',
]);
export function summarizeCrash(log) {
  const lines = log.split(/\r?\n/);
  const fatalSignal = lines.some(line => /Fatal signal (?:6|7|11)\b/.test(line));
  const starts = lines.flatMap((line, index) => /AndroidRuntime(?:\s*\([^)]*\))?:.*FATAL EXCEPTION:/.test(line) ? [index] : []);
  const start = starts.at(-1);
  const classes = [], frames = [];
  let fatalRole = null, fatalThread = null, fatalTime = null;
  if (start !== undefined) {
    const first = lines[start];
    fatalTime = first.match(/\b(\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3})\b/)?.[1] ?? null;
    const thread = first.match(/FATAL EXCEPTION:\s*([^\r\n]+)/)?.[1].trim();
    fatalThread = thread === 'main' ? 'main' : /^(?:pool-|Thread-|AsyncTask|HandlerThread|Download)/.test(thread || '') ? 'worker' : 'other';
  }
  // Parse only the final Java fatal block. Earlier crashes on this emulator
  // must not donate frames to the current failure.
  for (const line of start === undefined ? [] : lines.slice(start)) {
    if (!/AndroidRuntime(?:\s*\([^)]*\))?:/.test(line)) continue;
    const process = line.match(/\bProcess:\s*([A-Za-z0-9._:]+)/)?.[1];
    if (process && fatalRole === null) {
      fatalRole = /^dev\.ncc\.mutualtransfer(?:\.acceptance)?\.test$/.test(process) ? 'test'
        : /^dev\.ncc\.mutualtransfer(?:\.acceptance)?$/.test(process) ? 'app'
          : /^com\.android\.providers\.downloads(?:\.|:|$)/.test(process) ? 'download-provider'
            : /^(?:android\.process\.media|com\.android\.providers\.media|com\.google\.android\.providers\.media)(?:\.|:|$)/.test(process) ? 'media-provider' : 'other';
    }
    const type = line.match(/(?:^|\s)((?:java|javax|android|androidx|org\.chromium|dev\.ncc|com\.android\.providers|com\.android\.documentsui)(?:\.[A-Za-z_$][A-Za-z0-9_$]*){1,12}(?:Exception|Error))(?::|\s|$)/);
    if (type && classes.length < 20) classes.push(type[1]);
    const frame = line.match(/\bat ((?:dev\.ncc\.mutualtransfer|android|androidx|java|org\.chromium|com\.android\.providers|com\.android\.documentsui)\.[A-Za-z_$][A-Za-z0-9_$.]{0,150})\(([A-Za-z_$][A-Za-z0-9_$]{0,80}\.java:[0-9]{1,6}|D8\$\$SyntheticClass:[0-9]{1,6}|Native Method|Unknown Source)\)/);
    if (frame && frames.length < 40) frames.push(`${frame[1]}(${frame[2]})`);
  }
  return { fatalSignal, fatalJava: start !== undefined, javaFatalCount: starts.length, fatalRole, fatalThread, fatalTime, classes, frames };
}
// The gate must inspect every fatal, not only the final one: an unrelated
// later system error must not hide a provider failure from a passing test.
export function relevantCrashes(log) {
  const lines = log.split(/\r?\n/);
  const starts = lines.flatMap((line, index) => /AndroidRuntime(?:\s*\([^)]*\))?:.*FATAL EXCEPTION:/.test(line) ? [index] : []);
  return starts.map((start, index) => summarizeCrash(lines.slice(start, starts[index + 1]).join('\n')))
    .filter(report => ['app', 'test', 'download-provider', 'media-provider'].includes(report.fatalRole) ||
      report.frames.some(frame => /^(?:dev\.ncc\.mutualtransfer\.|com\.android\.providers\.(?:downloads|media)\.)/.test(frame)));
}
export function summarizePhases(log) {
  const recent = [];
  for (const line of log.split('\n')) {
    const match = line.match(/\sI (MutualAcceptance|MutualTransferSave): phase=([a-z-]+)\s*$/);
    if (match && phases.has(match[2])) {
      recent.push(`${match[1]}:${match[2]}`);
      if (recent.length > 24) recent.shift();
    }
  }
  return recent;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const gate = process.argv.includes('--check');
  try {
    const log = execFileSync('adb', ['logcat', '-b', 'crash', '-d'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] });
    const crashes = relevantCrashes(log);
    const summary = summarizeCrash(log);
    if (gate && crashes.length === 0 && !summary.fatalSignal) {
      console.log(JSON.stringify({ androidProviderCrashGate: 'passed' }));
    } else {
      let history = [];
      try {
        const phaseLog = execFileSync('adb', ['logcat', '-b', 'main', '-d', '-v', 'threadtime', '-s', 'MutualAcceptance:I', 'MutualTransferSave:I'], { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] });
        history = summarizePhases(phaseLog);
      } catch { /* Preserve the crash summary even when the phase buffer is unavailable. */ }
      console.log(JSON.stringify({ androidCrashSummary: summary, relevantCrashCount: crashes.length, relevantCrashes: crashes.slice(-5), androidPhaseHistory: history }));
      if (gate) process.exitCode = 1;
    }
  } catch {
    console.log(JSON.stringify({ androidCrashSummaryUnavailable: true }));
    if (gate) process.exitCode = 1;
  }
}
