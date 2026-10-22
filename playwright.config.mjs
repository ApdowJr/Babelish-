import { defineConfig } from '@playwright/test';

/**
 * E2E for the exported web app (dist/ from `npm run build:web`).
 * The static server must be running first — `npm run test:e2e` handles that
 * (build → serve → test). No production services are contacted: demo mode is
 * fully local and the app's AI/speech paths degrade gracefully offline, which
 * is exactly what several journeys assert.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1, // deterministic; shared browser cache dir per worker could bleed storage
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${process.env.E2E_PORT || 3100}`,
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
