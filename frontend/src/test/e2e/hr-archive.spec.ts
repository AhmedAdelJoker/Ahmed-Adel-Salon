import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * The employee archive, end to end, in the browser.
 *
 * Three claims this proves rather than asserts about code:
 *
 *  1. Archiving through the dialog stores the leaving day, the reason and the
 *     decision, and the archive page *shows* them — it used to print the hire
 *     date and nothing else, because the API had no departure date to send.
 *  2. A restored employee comes back visible. The shipped bug was quieter:
 *     archive flipped `showInPos` / `showInBooking` off, restore only flipped
 *     `status`, and so a returned barber sat in the team list invisible at the
 *     till. The assertion reads the row back over HTTP, because the switch is
 *     exactly the thing the UI did not show.
 *  3. Search hits the roster and not the page.
 *
 * Screenshots land in test-results/hr-archive/ for a human to look at; the
 * assertions above are what makes the run pass or fail.
 */

const API = 'http://127.0.0.1:18001/api/v1';
const SHOTS = 'test-results/hr-archive';

async function login(page: Page) {
  await page.goto('/login');
  const username = page.locator('input[autocomplete="username"]');
  await expect(username).toBeVisible({ timeout: 15000 });
  await username.fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('TestAdmin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 25000 });
}

async function tokenFor(request: any): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    form: { username: 'admin', password: 'TestAdmin123' },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).access_token as string;
}

/**
 * Both the dense table and the stacked cards are mounted at once and one is
 * CSS-hidden, so a text match resolves twice. Playwright's strict mode is right
 * to complain; the visible branch is what a person actually reads.
 */
const shown = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

test('archive records the exit, and restore brings the employee back visible', async ({
  page,
  request,
}) => {
  test.setTimeout(180000);
  mkdirSync(SHOTS, { recursive: true });

  const token = await tokenFor(request);
  const auth = { Authorization: `Bearer ${token}` };

  const seed = async (fullName: string, phone: string) => {
    const res = await request.post(`${API}/employees`, {
      headers: auth,
      data: {
        fullName,
        phonePrimary: phone,
        jobTitle: 'barber',
        baseSalary: 4500,
        commissionRate: 18,
        hireDate: '2023-02-10T00:00:00',
      },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    return (await res.json()).id as number;
  };

  const samyId = await seed('سامي علي', '01099900701');
  await seed('مصطفى كمال', '01099900702');

  await login(page);
  await page.goto('/manager/hr');

  // The board's readout now counts the roster, not the visible page.
  await expect(page.getByText('على رأس العمل')).toBeVisible({ timeout: 30000 });
  await expect(shown(page, 'سامي علي')).toBeVisible();

  // Dense ops view: the reachability column is the new part.
  await page.getByTitle('عرض القائمة').first().click();
  await expect(page.getByText('متاح في')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/01-hr-team.png`, fullPage: true });

  // Server-side search: the row that is not on page one still answers.
  await page.getByLabel('ابحث باسم الموظف أو المسمى الوظيفي...').fill('مصطفى');
  await expect(shown(page, 'مصطفى كمال')).toBeVisible();
  await expect(page.getByText('سامي علي')).toHaveCount(0);

  await page.getByLabel('ابحث باسم الموظف أو المسمى الوظيفي...').fill('سامي');
  // Wait for the debounced search to land before reaching for a row: click
  // immediately after typing and the list still shows the *previous* result,
  // so the action goes to the wrong employee. That race is the test's, not the
  // page's, but it has to be closed here or the assertions prove nothing.
  await expect(shown(page, 'سامي علي')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('table tbody tr')).toHaveCount(1);
  await page.getByTitle('أرشفة الموظف (ترك العمل)').first().click();

  // The dialog asks what the old one did not: when, and why.
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('آخر يوم عمل')).toBeVisible();
  await expect(dialog.getByText('سبب الخروج')).toBeVisible();
  await expect(dialog.getByText(/حجز لم يُنفَّذ بعد/)).toHaveCount(0);

  // Radix renders its listbox in a portal, and the role queries race it, so
  // the option is picked by its rendered text. What matters is the assertion
  // after it: the trigger reads back the chosen reason, which is the only
  // evidence a user has that the dialog recorded it.
  const reasonTrigger = page.locator('#archive-reason');
  await reasonTrigger.click();
  await page
    .locator('[role="option"]')
    .filter({ hasText: 'استقالة' })
    .first()
    .click({ force: true });
  await expect(reasonTrigger).toContainText('استقالة');
  await dialog.getByLabel('آخر يوم عمل').fill('2026-10-30');
  await page.screenshot({ path: `${SHOTS}/02-archive-dialog.png` });
  await dialog.getByRole('button', { name: 'أرشفة' }).click();

  await expect(page.getByText(/أُرشِف الموظف/)).toBeVisible({ timeout: 20000 });
  // Asserted on rows, not on the name: the dialog's own description quotes the
  // employee's name, and a closing dialog keeps its text in the DOM for a
  // moment — which is not the same as the roster still listing him.
  await expect(page.locator('table tbody tr')).toHaveCount(0, { timeout: 20000 });

  await page.goto('/manager/hr/archive');
  await expect(shown(page, 'تاريخ الخروج')).toBeVisible({ timeout: 30000 });
  await expect(shown(page, 'سامي علي')).toBeVisible();
  await expect(shown(page, 'استقالة')).toBeVisible();
  // Tenure reads the hire date against the departure day: 2023-02-10 to 2026-10-30.
  await expect(shown(page, /3 سنة/)).toBeVisible();
  await expect(page.getByText(/غير مسجل/)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/03-archive-list.png`, fullPage: true });

  await page
    .getByRole('button', { name: /استعادة للعمل/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole('dialog').getByRole('button', { name: 'استعادة' }).click();
  await expect(page.getByText(/تم استعادة/)).toBeVisible({ timeout: 20000 });

  // The bug, checked where it actually lived.
  const restored = await (
    await request.get(`${API}/employees/${samyId}`, { headers: auth })
  ).json();
  expect(restored.status).toBe('active');
  expect(restored.isActive).toBe(true);
  expect(restored.showInPos).toBe(true);
  expect(restored.showInBooking).toBe(true);
  expect(restored.archivedAt).toBeNull();

  await page.goto('/manager/hr');
  await expect(shown(page, 'سامي علي')).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: `${SHOTS}/04-hr-after-restore.png`, fullPage: true });
});
