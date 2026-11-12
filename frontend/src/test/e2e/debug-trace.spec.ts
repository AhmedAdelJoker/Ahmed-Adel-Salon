import { test, expect, type Page } from '@playwright/test';

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

test('trace the roster response across an archive', async ({ page, request }) => {
  test.setTimeout(150000);
  const res = await request.post(`${API}/auth/login`, {
    form: { username: 'admin', password: 'TestAdmin123' },
  });
  const token = (await res.json()).access_token;
  const auth = { Authorization: `Bearer ${token}` };
  await request.post(`${API}/employees`, {
    headers: auth,
    data: {
      // A name of its own: the archive spec seeds "سامي علي" too, and two
      // employees with the same name make the row-count assertions in either
      // spec depend on which one ran first.
      fullName: 'سامي عبد الله',
      phonePrimary: '01099900921',
      jobTitle: 'barber',
      hireDate: '2023-02-10T00:00:00',
    },
  });

  page.on('response', async (r) => {
    const url = r.url();
    if (!url.includes('/api/v1/employees')) return;
    if (url.includes('/employees/expiring') || url.includes('/stats')) return;
    let body = '';
    try {
      const json = await r.json();
      body = Array.isArray(json)
        ? JSON.stringify(json.map((e: any) => [e.full_name, e.status]))
        : JSON.stringify(json).slice(0, 120);
    } catch {
      body = '<unreadable>';
    }
    console.log(`LIST ${r.status()} ${url.split('/api/v1')[1]} -> ${body}`);
  });

  await login(page);
  await page.goto('/manager/hr');
  await page.getByLabel('ابحث بالاسم أو الجوال أو المسمى الوظيفي...').fill('سامي عبد');
  await page.waitForTimeout(1500);
  await page.getByTitle('عرض القائمة').first().click();
  await page.waitForTimeout(500);
  console.log('ROWS BEFORE ARCHIVE:', await page.locator('table tbody tr').count());

  await page.getByTitle('أرشفة الموظف (ترك العمل)').first().click();
  const dialog = page.getByRole('dialog');
  const reasonTrigger = page.locator('#archive-reason');
  await reasonTrigger.click();
  await page
    .locator('[role="option"]')
    .filter({ hasText: 'استقالة' })
    .first()
    .click({ force: true });
  await dialog.getByLabel('آخر يوم عمل').fill('2026-10-30');
  await dialog.getByRole('button', { name: 'أرشفة' }).click();
  await page.waitForTimeout(1500);
  console.log('TOASTS:', await page.locator('[class*=toast]').allTextContents());
  await page.waitForTimeout(3000);
  console.log('ROWS AFTER ARCHIVE:', await page.locator('table tbody tr').count());
});
