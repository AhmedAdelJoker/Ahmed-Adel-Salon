import { test, expect } from '@playwright/test';

/**
 * Full-stack smoke: login as seeded admin and land outside /login.
 * Covers: static serving, backend boot, auth API, client routing.
 */
test('admin login reaches the app', async ({ page }) => {
  await page.goto('/login');

  const username = page.locator('input[autocomplete="username"]');
  const password = page.locator('input[autocomplete="current-password"]');
  await expect(username).toBeVisible({ timeout: 15000 });

  await username.fill('admin');
  await password.fill('TestAdmin123');
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.includes('login'), {
    timeout: 25000,
  });
  await expect(page.locator('body')).toBeVisible();
});

test('owner dashboard fetches live KPIs after login', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('TestAdmin123');

  // The dashboard fires authed API calls right after landing — wait for one.
  const apiCall = page.waitForResponse(
    (res) => res.url().includes('/api/v1/') && res.request().method() === 'GET',
    { timeout: 25000 },
  );
  await page.locator('button[type="submit"]').click();

  await page.waitForURL((url) => url.pathname.includes('/owner'), {
    timeout: 25000,
  });
  const res = await apiCall;
  expect(res.ok()).toBeTruthy();
  await expect(page.locator('body')).toBeVisible();
});
