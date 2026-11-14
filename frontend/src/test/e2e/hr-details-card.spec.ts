import { test, expect, type Page } from '@playwright/test';

/**
 * The employee details card, as a person sees it.
 *
 * The card used to carry three shortcuts -- edit, payroll, attendance -- which
 * made it a menu wearing a record's clothing: the same employee appeared
 * twice, and the actions were one click from a place that looked like a
 * summary. The card now shows the record and points at the row for anything
 * that changes it.
 *
 * The screenshot is the point of this one: the assertions below can only say
 * that a button is absent, not that what remains reads as a card.
 */

const API = 'http://127.0.0.1:18001/api/v1';
const SHOTS = 'test-results/hr-details-card';

async function login(page: Page) {
  await page.goto('/login');
  const username = page.locator('input[autocomplete="username"]');
  await expect(username).toBeVisible({ timeout: 15000 });
  await username.fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('TestAdmin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 25000 });
}

test('the employee card shows the record and nothing else', async ({ page, request }) => {
  test.setTimeout(120000);

  const token = (
    await (
      await request.post(`${API}/auth/login`, {
        form: { username: 'admin', password: 'TestAdmin123' },
      })
    ).json()
  ).access_token as string;
  const created = await request.post(`${API}/employees`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      fullName: 'ندى فتحي',
      phonePrimary: '01099900555',
      jobTitle: 'barber',
      baseSalary: 5200,
      commissionRate: 14,
      hireDate: '2024-08-12T00:00:00',
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const employeeId = (await created.json()).id as number;

  await login(page);
  await page.goto('/manager/hr');
  await expect(page.getByText('فريق العمل').first()).toBeVisible({ timeout: 30000 });

  // The dense table view, where every action sits on the row.
  await page.getByTitle('عرض القائمة').first().click();
  await expect(page.getByText('متاح في')).toBeVisible({ timeout: 20000 });

  // Open the card the way a person does: the row's "open file" button.
  await page
    .locator(`tr:has-text("ندى فتحي") button[title="فتح الملف"]`)
    .first()
    .click();

  const card = page.getByTestId('employee-quick-view');
  await expect(card).toBeVisible({ timeout: 30000 });
  await expect(card.getByTestId('employee-file-name')).toContainText('ندى فتحي');

  // The record is there: salary, status, hire date, tenure.
  await expect(card).toContainText('الراتب');
  await expect(card).toContainText('الحضور');
  await expect(card).toContainText('5,200');

  // The three shortcuts are gone.
  await expect(card.getByRole('button', { name: /Payroll sheet/i })).toHaveCount(0);
  await expect(card.getByRole('button', { name: /Attendance record/i })).toHaveCount(0);
  await expect(card.getByRole('button', { name: /^Edit$/ })).toHaveCount(0);

  await page.screenshot({ path: `${SHOTS}/01-details-card.png` });

  // And the row still has its own actions, which is where they belong:
  // open the file, edit, payroll, and leave/return.
  await page.keyboard.press('Escape');
  const row = page.locator('tr:has-text("ندى فتحي")').first();
  await expect(row.locator('button[title="فتح الملف"]')).toHaveCount(1);
  await expect(row.locator('button[title="تعديل"]')).toHaveCount(1);
  await expect(row.locator('button[title="كشف الراتب"]')).toHaveCount(1);
  await expect(row.locator('button[title="تسجيل إجازة"]')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/02-row-actions.png` });
});
