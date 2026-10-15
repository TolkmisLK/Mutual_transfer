import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { verifyPortableDocLinks } from '../tool/portable-doc-links.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the Windows packaging allowlist closes every local Markdown link', async () => {
  const script = await fs.readFile(path.join(root, 'tool/build-windows-portable.ps1'), 'utf8');
  const list = /\$Files = @\(([\s\S]*?)\)\s*foreach/.exec(script)?.[1];
  assert.ok(list, 'packaging allowlist found');
  const included = [...list.matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.equal(new Set(included).size, included.length, 'no duplicate bundle entries');
  const result = await verifyPortableDocLinks(root, included);
  assert.ok(result.markdownFilesVerified >= 15);
  assert.ok(result.localLinksVerified >= 40);
});

test('a missing linked document or image fails before the bundle can be published', async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'mutual-doc-links-'));
  try {
    await fs.mkdir(path.join(fixture, 'docs'));
    await fs.writeFile(path.join(fixture, 'README.md'), '[guide](docs/guide.md) [external](https://example.org) [section](#start)');
    await fs.writeFile(path.join(fixture, 'docs/guide.md'), '![image](image.png)\n[back][home]\n\n[home]: ../README.md\n');
    await assert.rejects(verifyPortableDocLinks(fixture, ['README.md']), /Missing packaged link.*guide.md/);
    await assert.rejects(verifyPortableDocLinks(fixture, ['README.md', 'docs/guide.md']), /Missing packaged link.*image.png/);
    await fs.writeFile(path.join(fixture, 'docs/image.png'), 'fixture');
    assert.deepEqual(await verifyPortableDocLinks(fixture, ['README.md', 'docs/guide.md', 'docs/image.png']),
      { markdownFilesVerified: 2, localLinksVerified: 3 });
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
  }
});
