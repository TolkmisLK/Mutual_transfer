import test from 'node:test';
import assert from 'node:assert/strict';
import { portableOptions } from '../tool/portable-launch.js';

test('portable defaults isolate durable data from the extracted program and preserve fail-closed LAN rules', async () => {
  const options = await portableOptions({ LOCALAPPDATA: 'C:\\Users\\Fixture\\AppData\\Local' }, 'win32');
  assert.equal(options.root, 'C:\\Users\\Fixture\\AppData\\Local\\MutualTransfer\\data');
  assert.equal(options.host, '127.0.0.1'); assert.equal(options.generatedKey, true);
  assert.notEqual(options.key, (await portableOptions({ LOCALAPPDATA: 'C:\\Users\\Fixture\\AppData\\Local' }, 'win32')).key);
  for (const LOCALAPPDATA of [undefined, '', 'relative']) await assert.rejects(portableOptions({ LOCALAPPDATA }, 'win32'), /LOCALAPPDATA/);
  const explicit = await portableOptions({ DATA_DIR: 'D:\\TransferFiles', MUTUAL_KEY: 'test-key-with-at-least-24-characters' }, 'win32');
  assert.equal(explicit.root, 'D:\\TransferFiles'); assert.equal(explicit.generatedKey, false);
  await assert.rejects(portableOptions({ DATA_DIR: 'D:\\TransferFiles', HOST: '0.0.0.0' }, 'win32'), /requires TLS/);
});
