import { defineConfig, devices } from '@playwright/test';

const backendPython =
  process.platform === 'win32'
    ? '"../backend/.venv/Scripts/python.exe"'
    : 'python';

/**
 * Smoke E2E: built frontend (preview) + real backend (uvicorn + sqlite).
 * Proves the full stack boots and login works end to end.
 *
 * NOTE: the bundle must be built with the E2E backend URL, otherwise the
 * app talks to the dev server (:8000) and login fails:
 *   $env:VITE_API_URL="http://127.0.0.1:18001/api/v1"; npm run build
 * Preview runs on :5174 so human dev on :5173 is never disturbed.
 */
export default defineConfig({
  testDir: './src/test/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
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
      command: `${backendPython} -u e2e_server.py`,
      url: 'http://127.0.0.1:18001/',
      cwd: '../backend',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run preview -- --port 5174',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
