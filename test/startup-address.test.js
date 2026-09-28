import test from 'node:test';
import assert from 'node:assert/strict';
import { startupAddress } from '../src/server.js';

test('loopback startup prints an openable local URL', () => {
  const result = startupAddress({ host: '127.0.0.1', port: 8787, tls: undefined });
  assert.equal(result.url, 'http://127.0.0.1:8787');
  assert.match(result.lines.join(' '), /only on the service computer/);
  assert.equal(startupAddress({ host: '127.0.0.2', port: 8787, tls: undefined }).url, 'http://127.0.0.2:8787');
});

test('LAN startup identifies the listener without presenting a wildcard or certificate-mismatched URL', () => {
  for (const host of ['0.0.0.0', '::', '192.0.2.10']) {
    const result = startupAddress({ host, port: 8787, tls: {} });
    assert.equal(result.url, null);
    assert.doesNotMatch(result.lines.join(' '), /https:\/\//);
    assert.match(result.lines.join(' '), /trusted certificate/);
  }
  assert.match(startupAddress({ host: '0.0.0.0', port: 8787, tls: {} }).lines[0], /all IPv4 interfaces/);
  assert.match(startupAddress({ host: '::', port: 8787, tls: {} }).lines[0], /all IPv6 interfaces/);
});

test('explicit LAN HTTP test is labeled unencrypted and without cross-device pairing', () => {
  const result = startupAddress({ host: '0.0.0.0', port: 8787, tls: undefined });
  assert.equal(result.url, null);
  assert.match(result.lines.join(' '), /unencrypted/);
  assert.match(result.lines.join(' '), /pairing is unavailable/);
});
