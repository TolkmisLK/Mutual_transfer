import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { selectRun, verifyEvidence, verifyChecksum, verifyReport, verifyWindowsEntries } from '../tool/preview-release-guard.js';

const sha = 'a'.repeat(40);
const repository = 'TolkmisLK/Mutual_transfer';
const workflow = { id: 123, path: '.github/workflows/ci.yml' };
const run = { id: 456, workflow_id: 123, path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main', head_sha: sha,
  head_repository: { full_name: repository }, status: 'completed', conclusion: 'success' };
const source = { version: '0.1.0', tag: 'windows-v0.1.0-preview.1', sha, repository, workflow, listing: { total_count: 1, workflow_runs: [run] } };

test('release source must be one successful main-push CI at the exact tag SHA', () => {
  assert.equal(selectRun(source), 456);
  for (const bad of [
    { tag: 'windows-v0.1.0-preview.0' },
    { sha: 'b'.repeat(40) },
    { listing: { total_count: 2, workflow_runs: [run, run] } },
    { listing: { total_count: 1, workflow_runs: [{ ...run, event: 'pull_request' }] } },
    { listing: { total_count: 1, workflow_runs: [{ ...run, head_branch: 'feature' }] } },
    { listing: { total_count: 1, workflow_runs: [{ ...run, conclusion: 'failure' }] } },
    { listing: { total_count: 1, workflow_runs: [{ ...run, path: '.github/workflows/other.yml' }] } },
  ]) assert.throws(() => selectRun({ ...source, ...bad }));
});

test('release evidence requires all jobs and the unexpired selected artifact', () => {
  const names = ['windows-portable', 'test (ubuntu-latest)', 'test (windows-2022)', 'browser', 'disk-full'];
  const jobList = { total_count: names.length, jobs: names.map(name => ({ name, run_id: 456, status: 'completed', conclusion: 'success' })) };
  const artifactList = { total_count: 1, artifacts: ['mutual-transfer-windows-portable']
    .map(name => ({ name, expired: false, size_in_bytes: 12, workflow_run: { id: 456 } })) };
  assert.doesNotThrow(() => verifyEvidence({ runId: 456, jobList, artifactList }));
  assert.throws(() => verifyEvidence({ runId: 456, jobList: { ...jobList, jobs: jobList.jobs.slice(1) }, artifactList }));
  assert.throws(() => verifyEvidence({ runId: 456, jobList, artifactList: { ...artifactList, artifacts: [{ ...artifactList.artifacts[0], expired: true }] } }));
  assert.throws(() => verifyEvidence({ runId: 456, jobList, artifactList: { total_count: 2, artifacts: [artifactList.artifacts[0], artifactList.artifacts[0]] } }));
});


test('archive checksum rejects altered bytes', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'transfer-preview-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const zip = path.join(root, 'preview.zip'); const sum = `${zip}.sha256`;
  await fs.writeFile(zip, 'fixture');
  await fs.writeFile(sum, `${createHash('sha256').update('fixture').digest('hex')}  preview.zip\r\n`);
  await verifyChecksum(zip, sum);
  await fs.writeFile(zip, 'changed'); await assert.rejects(verifyChecksum(zip, sum));
});

test('archive paths and packaged process evidence are required', () => {
  const prefix = 'mutual-transfer-0.1.0-preview-windows-x64/';
  const files = ['runtime/node.exe', 'runtime/NODE-LICENSE.txt', 'START-WINDOWS.cmd', 'src/server.js', 'public/app.js', 'FILES.sha256.json', 'LICENSE'].map(p => prefix+p);
  verifyWindowsEntries(files, '0.1.0');
  for (const entry of ['../outside', 'data/private.data', '.env.local', 'test-results/trace.zip', 'server.key']) assert.throws(() => verifyWindowsEntries([...files,prefix+entry], '0.1.0'));
  const report = { platform:'win32',runtimeVersion:'v24.21.0',runtimeArch:'x64',manifestFilesVerified:37,bytes:4259841,
    actualPackagedProcess:true,defaultUserDataIsolated:true,restartedResumeAndHashMatch:true,previousSessionInvalidated:true,normalStdinExit:true,commandLauncherTested:true,inheritedNodeOptionsCleared:true,commandFailureExitPreserved:true,
    browserAutoOpenTested:false,cleanMachineTested:false,physicalLanTested:false };
  verifyReport(report);
  assert.throws(() => verifyReport({...report,restartedResumeAndHashMatch:false}));
  assert.throws(() => verifyReport({...report,physicalLanTested:true}));
});
