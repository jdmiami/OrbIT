import { defineConfig } from '@playwright/test';

// Two suites: the orb embedded in ordinary pages (Chromium), and the Orb Browser itself (Electron,
// launched by the test). Build first: `npm run e2e` does.
export default defineConfig({
  testDir: 'test/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { viewport: { width: 1024, height: 760 }, trace: 'retain-on-failure' },
  projects: [
    { name: 'embed', testMatch: /embed\.spec\.ts/, use: { browserName: 'chromium' } },
    { name: 'browser', testMatch: /browser\.spec\.ts/ },
  ],
});
