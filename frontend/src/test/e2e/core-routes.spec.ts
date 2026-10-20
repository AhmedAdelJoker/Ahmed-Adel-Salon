import { test, expect, type Page } from '@playwright/test';

/**
 * Core front-desk routes mount and render their own content.
 *
 * Login happens once; each route is then visited directly. Asserting a
 * distinctive page heading (not just "body is visible") catches a route that
 * silently renders its guard fallback, an error boundary, or a blank shell —
 * all previously silent killers on these four surfaces.
 */
const ROUTES: Array<{ path: string; heading: string }> = [
  { path: '/reception-board', heading: 'لوحة التحكم والعمليات' },
  { path: '/pos', heading: 'الجلسات الجاهزة' },
  { path: '/bookings', heading: 'إدارة الحجوزات' },
  { path: '/schedule', heading: 'مخطط المواعيد الذكي' },
];

async function login(page: Page) {
  await page.goto('/login');
  const username = page.locator('input[autocomplete="username"]');
  await expect(username).toBeVisible({ timeout: 15000 });

  await username.fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('TestAdmin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('login'), {
    timeout: 25000,
  });
}

test('front-desk core routes render their own page', async ({ page }) => {
  test.setTimeout(120000);
  await login(page);

  for (const { path, heading } of ROUTES) {
    await page.goto(path);
    // The header of the page itself — a route that failed to mount (or was
    // bounced by its role guard) never shows it. POS renders some headings
    // twice (mobile-only duplicates are CSS-hidden, not unmounted), so the
    // assertion must hold for *any* match, not just the first in DOM order.
    const headingMatches = page.getByText(heading, { exact: false });
    await expect(
      headingMatches.filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 30000 });
  }
});
