import { test, expect, type Page } from '@playwright/test';

/**
 * /customers renders, and the create → find → duplicate-review loop works
 * end to end against the real API: quick form (with the extra phone), the
 * details dialog, search, and the empty merge dialog.
 */
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

test('customers page: create with second phone, then find and review', async ({ page }) => {
  test.setTimeout(120000);
  await login(page);

  await page.goto('/customers');
  await expect(
    page.getByText('سجل العملاء', { exact: true }).first(),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('إجمالي العملاء', { exact: false })).toBeVisible();

  // --- create a customer (name + phone + extra phone) -----------------------
  const suffix = Date.now().toString().slice(-8);
  const name = `عميل اختبار ${suffix}`;
  const phone = `011${suffix}`;
  const phone2 = `012${suffix}`;

  await page.getByRole('button', { name: 'إضافة عميل' }).click();
  await expect(page.getByText('إضافة عميل جديد')).toBeVisible();
  await page.locator('input[placeholder="مثال: أحمد محمد"]').fill(name);
  const phoneInputs = page.locator('input[placeholder="010XXXXXXXX"]');
  await phoneInputs.nth(0).fill(phone);
  await phoneInputs.nth(1).fill(phone2);
  await page.getByRole('button', { name: 'إضافة العميل' }).click();

  // The details dialog opens after a successful save and must show BOTH
  // numbers — the second phone is stored in its own column now, not 422'd.
  await expect(page.getByText('رقم آخر:')).toBeVisible({ timeout: 20000 });
  await expect(page.locator(`text=${phone2}`).first()).toBeVisible();

  // --- search finds the fresh customer --------------------------------------
  await page.keyboard.press('Escape');
  const search = page.locator('input[placeholder*="البحث"]');
  await search.fill(name);
  await expect(page.getByText(name, { exact: false }).first()).toBeVisible({
    timeout: 20000,
  });

  // --- duplicate review dialog renders its empty state -----------------------
  await search.fill('');
  const mergeButton = page.getByRole('button', { name: 'بدء الدمج' });
  if (await mergeButton.count()) {
    await mergeButton.click();
    await expect(
      page.getByText('لا توجد مجموعات مكررة حالياً', { exact: false }),
    ).toBeVisible({ timeout: 15000 });
    await page.keyboard.press('Escape');
  }
});
