import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke E2E: built frontend (preview) + real backend (uvicorn + sqlite).
 * Proves the full stack boots and login works end to end.
 */
export default defineConfig({
  testDir: './src/test/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command:
        '"../backend/.venv/Scripts/python.exe" -u ../backend/e2e_server.py',
      url: 'http://127.0.0.1:18001/',
      cwd: '../backend',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run preview -- --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
