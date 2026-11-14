import { test, expect, type Page } from '@playwright/test';

/**
 * The HR board and its archive, side by side.
 *
 * Three claims this proves rather than asserts:
 *
 *  1. The two pages have separate addresses and separate content. The live
 *     symptom was a board that kept rendering on the archive address (and
 *     vice versa), which a single navigation check cannot catch -- it needs
 *     the *same* page visited twice, in both orders.
 *  2. `?employeeId=` opens the employee file (read-only), while `?edit=` opens
 *     the edit form. They are different things and the URL is the only thing
 *     that tells them apart; a deep link that opened the wrong one meant a
 *     shared link silently handed the reader an editable form.
 *  3. `?edit=<id>` fetches the employee by id, so it works for someone who is
 *     not on the page currently loaded -- which is the whole point of a link.
 */

const API = 'http://127.0.0.1:18001/api/v1';

async function login(page: Page) {
  await page.goto('/login');
  const username = page.locator('input[autocomplete="username"]');
  await expect(username).toBeVisible({ timeout: 15000 });
  await username.fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('TestAdmin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('login'), { timeout: 25000 });
}

/**
 * Both the dense table and the stacked cards are mounted at once and one is
 * CSS-hidden, so a text match resolves twice. The visible branch is what a
 * person actually reads.
 */
const shown = (page: Page, text: string | RegExp) =>
  page.getByText(text).filter({ visible: true }).first();

async function seed(page: Page, request: any, tag: string, name: string) {
  const res = await request.post(`${API}/auth/login`, {
    form: { username: 'admin', password: 'TestAdmin123' },
  });
  const token = (await res.json()).access_token as string;
  const created = await request.post(`${API}/employees`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      fullName: name,
      // A unique number per run: the phone is unique on the server, and a
      // repeated one fails the create with a 409. The name may not carry
      // digits -- the server rejects that -- so the tag only goes here.
      phonePrimary: `0109990${tag.padStart(4, "0")}`,
      jobTitle: 'barber',
      baseSalary: 4200,
      commissionRate: 12,
      hireDate: '2024-05-01T00:00:00',
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  return (await created.json()).id as number;
}

test('the team board and the archive keep their own address and content', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const employeeId = await seed(page, request, '01', 'نور الهادي الأول');

  await login(page);

  // The board, twice.
  for (const _ of [0, 1]) {
    await page.goto('/manager/hr');
    await expect(shown(page, 'فريق العمل')).toBeVisible({ timeout: 30000 });
    await expect(shown(page, 'نور الهادي الأول')).toBeVisible();
    await expect(shown(page, 'أرشيف الموظفين')).toHaveCount(0);
  }

  // The archive, twice -- and it must not render the board.
  for (const _ of [0, 1]) {
    await page.goto('/manager/hr/archive');
    await expect(shown(page, 'سجل الانقطاعات')).toBeVisible({ timeout: 30000 });
    await expect(shown(page, 'فريق العمل')).toHaveCount(0);
  }

  // Board again, after the archive: coming back has to land on the board.
  await page.goto('/manager/hr');
  await expect(shown(page, 'فريق العمل')).toBeVisible({ timeout: 30000 });
  await expect(shown(page, 'نور الهادي الأول')).toBeVisible();
});

test('?employeeId opens the read-only file and ?edit opens the form', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const employeeId = await seed(page, request, '02', 'هدى سالم');

  await login(page);

  // The file: the employee's details, and nothing else.
  await page.goto(`/manager/hr?employeeId=${employeeId}`);
  const file = page.getByTestId('employee-quick-view');
  await expect(file).toBeVisible({ timeout: 30000 });
  await expect(file.getByTestId('employee-file-name')).toContainText('هدى سالم');
  // The card shows the record; it is not a menu of shortcuts to edit,
  // payroll and attendance. Those live on the employee's row.
  await expect(file.getByRole('button', { name: /Payroll sheet/i })).toHaveCount(0);
  await expect(file.getByRole('button', { name: /Attendance record/i })).toHaveCount(0);
  await expect(file.getByRole('button', { name: /^Edit$/ })).toHaveCount(0);

  // The param is consumed once, so the URL does not stay armed.
  await expect(page).not.toHaveURL(new RegExp(`employeeId=${employeeId}`));

  // The edit form: fetched by id, so it works for someone not on the page.
  await page.goto(`/manager/hr?edit=${employeeId}`);
  const form = page.getByRole('dialog');
  await expect(form).toBeVisible({ timeout: 30000 });
  await expect(form.getByText('تحديث ملف موظف')).toBeVisible();
  await expect(form.getByLabel(/الاسم الكامل/)).toHaveValue('هدى سالم');
});
