import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', timeout: 60000, expect: { timeout: 15000 }, workers: 1, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Keep authentication cookies and ephemeral pairing codes out of artifacts.
  use: { trace: 'off' },
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } } },
    { name: 'mobile-viewport', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
