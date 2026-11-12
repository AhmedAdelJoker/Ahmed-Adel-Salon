import { test, expect, type Page } from '@playwright/test';

/**
 * Employee photos, in the browser.
 *
 * The stored value is the full path (`/uploads/profiles/<id>.jpg`). Two things
 * used to break it, and both failed *silently* -- the image never appeared and
 * the fallback initials looked like a deliberate choice:
 *
 *  1. `EmployeeAvatar` prefixed the stored path with `/uploads` again, asking
 *     for `/uploads/uploads/profiles/<id>.jpg`.
 *  2. The api client picked the backend address from the user-agent string,
 *     so any Electron-based browser was handed an absolute
 *     `http://127.0.0.1:8000` media origin while the page was on
 *     `localhost:5173`. That is a different site, and the backend's
 *     `Cross-Origin-Resource-Policy: same-site` header blocked every image
 *     with `ERR_BLOCKED_BY_RESPONSE.NotSameSite`.
 *
 * The assertion is on the *rendered* size, not on the `src` attribute: a URL
 * can be perfectly correct and still deliver nothing.
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

test('an employee photo is delivered, not just requested', async ({ page, request }) => {
  test.setTimeout(120000);

  const token = (
    await (
      await request.post(`${API}/auth/login`, {
        form: { username: 'admin', password: 'TestAdmin123' },
      })
    ).json()
  ).access_token as string;

  // A real file on disk, written through the same endpoint the form uses.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const upload = await request.post(`${API}/employees/upload-image`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      file: { name: 'avatar.png', mimeType: 'image/png', buffer: png },
    },
  });
  expect(upload.ok(), await upload.text()).toBeTruthy();
  const url = (await upload.json()).url as string;
  expect(url).toMatch(/^\/uploads\/profiles\//);

  const created = await request.post(`${API}/employees`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      fullName: 'سلمى رشدي',
      phonePrimary: '01099900777',
      jobTitle: 'barber',
      baseSalary: 3900,
      commissionRate: 10,
      hireDate: '2024-03-01T00:00:00',
      profileImageUrl: url,
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();

  await login(page);
  await page.goto('/manager/hr');
  await expect(page.getByText('سلمى رشدي').first()).toBeVisible({ timeout: 30000 });

  // The file is served by the API origin and is reachable.
  const probe = await page.evaluate(async (mediaPath) => {
    const res = await fetch(mediaPath);
    return { status: res.status, type: res.headers.get('content-type') };
  }, url);
  expect(probe.status).toBe(200);
  expect(probe.type).toContain('image');

  // ...and the row shows it: a rendered photo, not the initials fallback.
  const photo = page.locator(`img[src*="${url.split('/').pop()}"]`).first();
  await expect(photo).toBeVisible({ timeout: 20000 });
  const size = await photo.evaluate((el) => ({
    natural: (el as HTMLImageElement).naturalWidth,
    complete: (el as HTMLImageElement).complete,
  }));
  expect(size.complete).toBe(true);
  // A broken image has naturalWidth 0; a delivered 1x1 PNG has 1.
  expect(size.natural).toBeGreaterThan(0);
});
