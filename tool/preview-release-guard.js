import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const jobs = ['windows-portable', 'test (ubuntu-latest)', 'test (windows-2022)', 'browser', 'disk-full'];
const artifacts = ['mutual-transfer-windows-portable'];
const workflowPath = '.github/workflows/ci.yml';

export function selectRun({ version, tag, sha, repository, workflow, listing }) {
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(tag, `windows-v${version}-preview.${Number(tag.slice(`windows-v${version}-preview.`.length))}`);
  assert.match(tag, /^windows-v\d+\.\d+\.\d+-preview\.[1-9]\d*$/);
  assert.match(sha, /^[a-f0-9]{40}$/);
  assert.equal(repository, 'TolkmisLK/Mutual_transfer');
  assert.ok(Number.isSafeInteger(workflow.id) && workflow.id > 0);
  assert.equal(workflow.path, workflowPath);
  assert.equal(listing.total_count, 1, 'Require exactly one main-push CI run for this tag SHA');
  assert.equal(listing.workflow_runs?.length, 1);
  const run = listing.workflow_runs[0];
  assert.ok(Number.isSafeInteger(run.id) && run.id > 0);
  assert.equal(run.workflow_id, workflow.id);
  assert.equal(run.path?.split('@')[0], workflowPath);
  assert.equal(run.event, 'push');
  assert.equal(run.head_branch, 'main');
  assert.equal(run.head_sha, sha);
  assert.equal(run.head_repository?.full_name, repository);
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'success');
  return run.id;
}

export function verifyEvidence({ runId, jobList, artifactList }) {
  assert.equal(jobList.total_count, jobList.jobs?.length, 'Job listing must not be truncated');
  assert.deepEqual([...jobList.jobs.map(job => job.name)].sort(), [...jobs].sort());
  for (const job of jobList.jobs) {
    assert.equal(job.run_id, runId);
    assert.equal(job.status, 'completed');
    assert.equal(job.conclusion, 'success');
  }
  assert.equal(artifactList.total_count, artifactList.artifacts?.length, 'Artifact listing must not be truncated');
  for (const name of artifacts) {
    const matches = artifactList.artifacts.filter(item => item.name === name);
    assert.equal(matches.length, 1, `Expected one ${name} artifact`);
    assert.equal(matches[0].expired, false);
    assert.ok(matches[0].size_in_bytes > 0);
    assert.equal(matches[0].workflow_run?.id, runId);
  }
}

export async function verifyChecksum(zip, checksum) {
  const name = path.basename(zip);
  const expected = await fs.readFile(checksum, 'ascii');
  assert.match(expected, new RegExp(`^[a-f0-9]{64}  ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?\\n?$`));
  const actual = createHash('sha256');
  for await (const bytes of createReadStream(zip)) actual.update(bytes);
  assert.equal(actual.digest('hex'), expected.slice(0, 64));
}


export function verifyWindowsEntries(entries, version) {
  const prefix = `mutual-transfer-${version}-preview-windows-x64/`;
  for (const required of ['runtime/node.exe', 'runtime/NODE-LICENSE.txt', 'START-WINDOWS.cmd', 'src/server.js', 'public/app.js', 'FILES.sha256.json', 'LICENSE'])
    assert.ok(entries.includes(prefix + required), `Missing ${required}`);
  for (const entry of entries) {
    assert.ok(entry.startsWith(prefix));
    assert.equal(entry.includes('\\'), false);
    assert.equal(entry.split('/').includes('..'), false);
    assert.equal(/(?:^|\/)(?:\.env(?:\.[^/]*)?|data|test|e2e|test-results|playwright-report)(?:\/|$)|\.(?:pem|key|p12|db|sqlite)$/i.test(entry), false, `Private or test file: ${entry}`);
  }
}

export function verifyReport(report) {
  assert.equal(report.platform, 'win32');
  assert.equal(report.runtimeVersion, 'v24.21.0');
  assert.equal(report.runtimeArch, 'x64');
  assert.ok(report.manifestFilesVerified > 20);
  assert.equal(report.bytes, 4259841);
  for (const key of ['actualPackagedProcess', 'defaultUserDataIsolated', 'restartedResumeAndHashMatch', 'previousSessionInvalidated', 'normalStdinExit', 'commandLauncherTested', 'inheritedNodeOptionsCleared', 'commandFailureExitPreserved']) assert.equal(report[key], true, key);
  for (const key of ['browserAutoOpenTested', 'cleanMachineTested', 'physicalLanTested']) assert.equal(report[key], false, key);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  const read = file => fs.readFile(file, 'utf8').then(text => JSON.parse(text.replace(/^\uFEFF/, '')));
  if (command === 'select') {
    const [version, tag, sha, repository, workflowFile, listingFile] = args;
    console.log(selectRun({ version, tag, sha, repository, workflow: await read(workflowFile), listing: await read(listingFile) }));
  } else if (command === 'evidence') {
    const [runId, jobsFile, artifactsFile] = args;
    verifyEvidence({ runId: Number(runId), jobList: await read(jobsFile), artifactList: await read(artifactsFile) });
  } else if (command === 'checksum') await verifyChecksum(args[0], args[1]);
  else if (command === 'windows') {
    const entries = execFileSync('unzip', ['-Z1', args[0]], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trimEnd().split('\n');
    verifyWindowsEntries(entries, args[1]);
    verifyReport(await read(args[2]));
  } else throw new Error('Unknown preview release guard command');
}
