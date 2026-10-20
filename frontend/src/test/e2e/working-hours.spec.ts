import { test, expect, type Page } from '@playwright/test';

/**
 * Working-hours E2E against the real stack (preview build + uvicorn + sqlite).
 *
 * The interesting case is a window that crosses midnight: the panel must accept
 * it, label it, persist it, and the public booking payload must come back with
 * the same window. Anything less and the salon silently stops taking bookings
 * after its close time.
 */

const login = async (page: Page) => {
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('TestAdmin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 25000 });
};

const openHoursTab = async (page: Page) => {
  await page.goto('/owner/settings?tab=hours');
  await expect(page.getByRole('tab', { name: /ساعات العمل/ })).toBeVisible({
    timeout: 25000,
  });
  // NB: a day renders its time inputs only while it is open, and a freshly
  // seeded database has working_hours = null, so every day starts closed.
  // Each test opens the day it needs, idempotently, so the suite does not
  // depend on what an earlier test left saved.
};

/** Open `day` only when it is currently closed. */
const ensureDayOpen = async (page: Page, day: string) => {
  const toggle = page.getByLabel(`تبديل ${day}`);
  await expect(toggle).toBeVisible({ timeout: 25000 });
  if ((await toggle.getAttribute('data-state')) !== 'checked') {
    await toggle.click();
  }
};

const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:18001/api/v1';

/**
 * Re-publish the public site.
 *
 * The public catalog serves working hours from `public_site_snapshot`, a frozen
 * copy taken when the owner publishes. Saving new hours does not change what
 * visitors see until the site is published again, so any assertion about the
 * public payload has to publish first.
 */
const publishSite = async (page: Page) => {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
  const response = await page.request.post(`${API}/business-settings/publish-site`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok()).toBeTruthy();
};

test.describe('working hours', () => {
  test('renders every day with a labelled time input', async ({ page }) => {
    await login(page);
    await openHoursTab(page);

    await ensureDayOpen(page, 'السبت');
    await expect(page.locator('#open-saturday')).toBeVisible();
    await expect(page.locator('#close-friday')).toHaveCount(0); // Friday starts closed
    await expect(page.getByLabel('تبديل الجمعة')).toBeVisible();
  });

  test('saves a window that crosses midnight', async ({ page }) => {
    await login(page);
    await openHoursTab(page);

    // open Saturday then set the close time to 02:00, i.e. after midnight
    await ensureDayOpen(page, 'السبت');
    await page.locator('#open-saturday').fill('22:00');
    await page.locator('#close-saturday').fill('02:00');

    await expect(page.getByText('بعد منتصف الليل').first()).toBeVisible();

    const save = page.getByRole('button', { name: /حفظ المواعيد/ });
    await expect(save).toBeEnabled();
    await save.click();

    await expect(page.getByText('تم حفظ ساعات العمل بنجاح')).toBeVisible({
      timeout: 20000,
    });
  });

  test('persists the overnight window through a reload', async ({ page }) => {
    await login(page);
    await openHoursTab(page);

    // A distinct window from the previous test: re-entering the values that are
    // already saved leaves the form clean, and Save stays correctly disabled.
    await ensureDayOpen(page, 'السبت');
    await page.locator('#open-saturday').fill('21:00');
    await page.locator('#close-saturday').fill('03:00');
    await page.getByRole('button', { name: /حفظ المواعيد/ }).click();
    await expect(page.getByText('تم حفظ ساعات العمل بنجاح')).toBeVisible({
      timeout: 20000,
    });

    await page.reload();
    await expect(page.locator('#close-saturday')).toHaveValue('03:00', {
      timeout: 25000,
    });
    await expect(page.getByText('بعد منتصف الليل').first()).toBeVisible();
  });

  test('the public booking payload exposes the same overnight window', async ({ page }) => {
    await login(page);
    await openHoursTab(page);

    await ensureDayOpen(page, 'السبت');
    await page.locator('#open-saturday').fill('20:00');
    await page.locator('#close-saturday').fill('04:00');
    await page.getByRole('button', { name: /حفظ المواعيد/ }).click();
    await expect(page.getByText('تم حفظ ساعات العمل بنجاح')).toBeVisible({
      timeout: 20000,
    });

    const response = await page.request.get(`${API}/public/booking-catalog`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const saturday = body?.business?.working_hours?.saturday;
    expect(saturday).toBeTruthy();
    expect(saturday.is_open).toBe(false); // snapshot predates the change
    expect(saturday.close_time).not.toBe('04:00');

    // Republish and the same overnight window is what visitors get.
    await publishSite(page);
    const republished = await (await page.request.get(`${API}/public/booking-catalog`)).json();
    const live = republished?.business?.working_hours?.saturday;
    expect(live.is_open).toBe(true);
    expect(live.open_time).toBe('20:00');
    expect(live.close_time).toBe('04:00');
  });

  test('rejects an open time equal to the close time', async ({ page }) => {
    await login(page);
    await openHoursTab(page);

    await ensureDayOpen(page, 'الجمعة');
    await page.locator('#open-friday').fill('10:00');
    await page.locator('#close-friday').fill('10:00');

    await expect(page.getByText(/وقت الإغلاق لا يمكن أن يساوي وقت الفتح/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /حفظ المواعيد/ })).toBeDisabled();
  });

  test('warns before overwriting the whole week', async ({ page }) => {
    await login(page);
    await openHoursTab(page);

    await page.getByLabel('نسخ مواعيد السبت إلى كل الأيام').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'تطبيق' }).click();
    await expect(dialog).toBeHidden();
  });

  test('blocks leaving the tab with unsaved changes until confirmed', async ({ page }) => {
    await login(page);
    await openHoursTab(page);

    await ensureDayOpen(page, 'الجمعة');
    await expect(page.getByText('غير محفوظ').first()).toBeVisible();

    await page.getByRole('tab', { name: /بيانات المنشأة/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'العودة والإكمال' }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/tab=hours/);
  });
});
