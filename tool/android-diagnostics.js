import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Never print raw logcat: WebView/HTTP logs may include fixture credentials.
// This fixed grammar returns only exception class names and our source frames.
export function summarizeCrash(log) {
  const classes = new Set(), frames = new Set();
  let fatalSignal = false, fatalJava = false;
  for (const line of log.split('\n')) {
    fatalSignal ||= /Fatal signal (?:6|7|11)\b/.test(line);
    fatalJava ||= /FATAL EXCEPTION:/.test(line);
    const type = line.match(/(?:^|\s)((?:java|javax|android|androidx|org\.chromium|dev\.ncc)(?:\.[A-Za-z_$][A-Za-z0-9_$]*){1,12}(?:Exception|Error))(?::|\s|$)/);
    if (type && classes.size < 20) classes.add(type[1]);
    const frame = line.match(/\bat (dev\.ncc\.mutualtransfer\.[A-Za-z_$][A-Za-z0-9_$.]{0,150})\((MainActivity|VerifiedDownload|OriginPolicy|HttpsExchangeTest)\.java:([0-9]{1,6})\)/);
    if (frame && frames.size < 40) frames.add(`${frame[1]}(${frame[2]}.java:${frame[3]})`);
  }
  return { fatalSignal, fatalJava, classes: [...classes], frames: [...frames] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const log = execFileSync('adb', ['logcat', '-b', 'crash', '-d'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(JSON.stringify({ androidCrashSummary: summarizeCrash(log) }));
  } catch { console.log(JSON.stringify({ androidCrashSummaryUnavailable: true })); }
}
