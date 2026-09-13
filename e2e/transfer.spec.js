import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('访问密钥').fill('browser-test-only-workspace-key-2026');
  await page.getByRole('button', { name: '加入', exact: true }).click();
  await expect(page.locator('#workspace')).toBeVisible();
});
test('verified browser upload, literal text preview and download', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const name = `roundtrip-${info.project.name}.txt`; const bytes = Buffer.from('你好 Mutual Transfer\n<script>literal, never execute</script>');
  await page.locator('#files').setInputFiles({ name, mimeType: 'text/plain', buffer: bytes });
  const row = page.locator('.file').filter({ hasText: name }); await expect(row).toContainText('已校验完成');
  await expect(row).toContainText(createHash('sha256').update(bytes).digest('hex'));
  await row.getByRole('button', { name: '预览文本' }).click(); await expect(page.locator('pre')).toHaveText(bytes.toString());
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  const download = page.waitForEvent('download'); await row.getByRole('link', { name: '下载', exact: true }).click();
  const file = await download; expect(await fs.readFile(await file.path())).toEqual(bytes);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('verified-workspace.png'), fullPage: true }); expect(errors).toEqual([]);
});
test('interrupted network resumes the same content without duplicating the transfer', async ({ page }, info) => {
  const name = `resumed-${info.project.name}.bin`; const bytes = Buffer.alloc(9 * 1024 * 1024, 71); let chunks = 0;
  await page.route('**/chunk', route => ++chunks === 2 ? route.abort('failed') : route.continue());
  await page.locator('#files').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: bytes });
  await expect(page.locator('#status')).toContainText('传输已停止');
  const before = await page.evaluate(async name => (await (await fetch('/api/transfers')).json()).files.find(f => f.name === name), name);
  expect(before.offset).toBe(4 * 1024 * 1024); expect(before.complete).toBe(false);
  await page.unroute('**/chunk');
  await page.locator('#files').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: bytes });
  const row = page.locator('.file').filter({ hasText: name }); await expect(row).toContainText('已校验完成');
  const after = await page.evaluate(async name => (await (await fetch('/api/transfers')).json()).files.filter(f => f.name === name), name);
  expect(after).toHaveLength(1); expect(after[0].id).toBe(before.id);
  expect(after[0].sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
});
