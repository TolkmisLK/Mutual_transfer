import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 60000, expect: { timeout: 15000 }, workers: 1, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:19879', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
    { name: 'mobile-viewport', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: 'node src/server.js', url: 'http://127.0.0.1:19879', reuseExistingServer: false,
    env: { HOST: '127.0.0.1', PORT: '19879', DATA_DIR: '.browser-test-data', MUTUAL_KEY: 'browser-test-only-workspace-key-2026' } },
});
