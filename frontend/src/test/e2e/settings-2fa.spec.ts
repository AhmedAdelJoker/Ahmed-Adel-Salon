import { test, expect } from '@playwright/test';

/**
 * 2FA settings journey: login, open security settings, start TOTP setup
 * (QR renders), wrong code is rejected with an error toast.
 */
test('2fa setup panel renders QR and rejects wrong code', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill('admin');
  await page.locator('input[autocomplete="current-password"]').fill('TestAdmin123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('login'), {
    timeout: 25000,
  });

  await page.goto('/settings?tab=security');
  await expect(page.getByText('المصادقة الثنائية')).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: 'بدء الإعداد' }).click();
  await expect(page.locator('img[alt="رمز QR للمصادقة الثنائية"]')).toBeVisible({
    timeout: 15000,
  });

  await page.locator('#totp-setup-code').fill('000000');
  await page.getByRole('button', { name: 'تفعيل' }).click();
  await expect(page.getByText('رمز التحقق غير صحيح')).toBeVisible({
    timeout: 15000,
  });
});
