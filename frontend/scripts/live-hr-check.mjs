/**
 * Live check against the running dev server (:5173) and the real backend
 * (:8000) -- the same database the owner uses.
 *
 * Not a committed test: it needs the dev stack running and it reads the real
 * roster. Run it with:
 *   node scripts/live-hr-check.mjs
 *
 * The dev server is a plain browser, so it uses `BrowserRouter` and the URLs
 * are paths. The packaged desktop app uses `HashRouter`, where the same route
 * is `#/manager/hr`; `ROUTE` below is the only thing that differs.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const API = 'http://127.0.0.1:8000/api/v1';
const ROUTE = (path) => `${BASE}${path}`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});

await page.goto(`${BASE}/login`);
await page.locator('input[autocomplete="username"]').waitFor({ timeout: 20000 });
// The password comes from the environment, never from this file: a credential
// that lives in the repository is a credential that leaks with the repository.
const password = process.env.SALON_ADMIN_PASSWORD;
if (!password) {
  console.error(
    'Set SALON_ADMIN_PASSWORD to the admin password before running this check.',
  );
  process.exit(2);
}
await page.locator('input[autocomplete="username"]').fill('admin');
await page.locator('input[autocomplete="current-password"]').fill(password);
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 30000 });
check('login', true, page.url());

// 1. The board and the archive keep their own content, twice each.
for (const pass of [1, 2]) {
  await page.goto(`${ROUTE('/manager/hr')}`);
  await page.getByText('فريق العمل').first().waitFor({ timeout: 30000 });
  const hrHas = await page.getByText('فريق العمل').first().isVisible();
  check(`pass ${pass}: /manager/hr renders the board`, hrHas);

  await page.goto(`${ROUTE('/manager/hr')}/archive`);
  await page.getByText('سجل الانقطاعات').first().waitFor({ timeout: 30000 });
  const archHas = await page.getByText('سجل الانقطاعات').first().isVisible();
  const archLeak = await page.getByText('فريق العمل').count();
  check(`pass ${pass}: /manager/hr/archive renders the archive`, archHas, `board heading count on archive page: ${archLeak}`);
}

// 2. The archive stat card opens the archive.
await page.goto(`${ROUTE('/manager/hr')}`);
await page.getByText('فريق العمل').first().waitFor({ timeout: 30000 });
await page.getByRole('button', { name: /الأرشيف/ }).first().click();
await page.getByText('سجل الانقطاعات').first().waitFor({ timeout: 30000 });
check('the archive stat card navigates to the archive', page.url().includes('/manager/hr/archive'), page.url());

// 3. Status filters agree with the server.
await page.goto(`${ROUTE('/manager/hr')}`);
await page.getByText('فريق العمل').first().waitFor({ timeout: 30000 });
const apiCount = async (query) => {
  const res = await page.evaluate(async (q) => {
    const token = localStorage.getItem('token') || '';
    const r = await fetch(`/api/v1/employees?page=1&page_size=100${q}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    const j = await r.json().catch(() => []);
    return { total: r.headers.get('x-total-count'), count: Array.isArray(j) ? j.length : -1 };
  }, query);
  return res;
};
for (const [label, filter, query] of [
  ['كل الفريق', 'كل الفريق', '&excludeStatus=resigned'],
  ['نشط', 'نشط', '&status=active'],
  ['في إجازة', 'في إجازة', '&status=suspended'],
]) {
  const server = await apiCount(query);
  await page.getByRole('button', { name: new RegExp(`^${label}`) }).first().click();
  await page.waitForTimeout(1500);
  const rows = await page.locator('tbody tr').count();
  const cards = await page.locator('article').count();
  const shown = rows + cards;
  check(
    `filter "${label}" matches the server`,
    shown === server.count,
    `ui rows=${shown}, server count=${server.count} (total=${server.total})`,
  );
}

// 4. Quick view via ?employeeId and edit via ?edit.
const ids = await page.evaluate(async () => {
  const token = localStorage.getItem('token') || '';
  const r = await fetch('/api/v1/employees?page=1&page_size=50&excludeStatus=resigned', {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  const j = await r.json();
  return j.map((e) => ({ id: e.id, name: e.full_name }));
});
console.log('   live roster:', JSON.stringify(ids));

if (ids.length) {
  const target = ids[0];
  await page.goto(`${ROUTE('/manager/hr')}?employeeId=${target.id}`);
  const quick = page.getByTestId('employee-quick-view');
  await quick.waitFor({ timeout: 30000 });
  const quickText = (await quick.innerText()).replace(/\s+/g, ' ');
  const isEditWizard = /الهوية الشخصية.*المسار الوظيفي.*بوابة النظام/.test(quickText);
  check('?employeeId opens the read-only file', !isEditWizard, quickText.slice(0, 120));

  await page.goto(`${ROUTE('/manager/hr')}?edit=${target.id}`);
  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ timeout: 30000 });
  const dialogText = (await dialog.innerText()).replace(/\s+/g, ' ');
  check(
    '?edit opens the edit form for an employee fetched by id',
    /تحديث ملف موظف/.test(dialogText),
    dialogText.slice(0, 120),
  );
}

// 5. Employee photos actually arrive.
const photos = await page.evaluate(async () => {
  const token = localStorage.getItem('token') || '';
  const r = await fetch('/api/v1/employees?page=1&page_size=50', {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  const j = await r.json();
  const withPhoto = j.filter((e) => e.profile_image_url);
  if (!withPhoto.length) return { count: 0, ok: true, note: 'no employee has a photo' };
  const probe = await fetch(withPhoto[0].profile_image_url, { credentials: 'include' });
  return {
    count: withPhoto.length,
    ok: probe.ok,
    status: probe.status,
    type: probe.headers.get('content-type'),
    path: withPhoto[0].profile_image_url,
  };
});
check('employee photos are served', photos.ok, JSON.stringify(photos));

// 6. No nested-button or CORP console errors.
const nesting = consoleErrors.filter((t) => /validateDOMNesting|NotSameSite|NotSameOrigin/i.test(t));
check('no DOM-nesting / blocked-media console errors', nesting.length === 0, nesting.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

