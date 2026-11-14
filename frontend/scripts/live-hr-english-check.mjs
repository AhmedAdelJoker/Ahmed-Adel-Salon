/**
 * The HR form in English, live.
 *
 * The Arabic locale was the one the app was built in, so a screen that only
 * ever looked right in Arabic could hide an English interface that reads
 * wrong: an Arabic validation message under an English label, an Arabic
 * job-title card on an English form.
 *
 * This drives the real page against the running dev server and the real
 * backend, switches the interface to English, and reads what is actually on
 * screen.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const password = process.env.SALON_ADMIN_PASSWORD;
if (!password) {
  console.error('Set SALON_ADMIN_PASSWORD before running this check.');
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/login`);
await page.locator('input[autocomplete="username"]').waitFor({ timeout: 20000 });
await page.locator('input[autocomplete="username"]').fill('admin');
await page.locator('input[autocomplete="current-password"]').fill(password);
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 30000 });

// Switch the interface to English.
await page.getByRole('button', { name: /English|التبديل إلى الإنجليزية/i }).first().click();
await page.waitForTimeout(1500);

/**
 * The page's own content, not the shell around it.
 *
 * The sidebar's group names and the language switcher are app chrome that
 * lives outside the HR feature; reading them here would report the chrome as
 * if the HR page were untranslated.
 */
const mainText = async () =>
  (await page.locator('#main-content').innerText().catch(() => page.innerText('body')));

// On the HR board itself, not the dashboard the switch left us on.
await page.goto(`${BASE}/manager/hr`);
await page.getByText('Human Resources').first().waitFor({ timeout: 30000 });
await page.waitForTimeout(1200);

const body = await mainText();
const arabic = body.match(/[\u0600-\u06FF]+/g) || [];
// The page legitimately carries one Arabic name (the employee), so the check
// is that no *sentence* of the interface is Arabic.
const longArabic = arabic.filter((w) => w.length > 3);
check(
  'the HR board in English carries no Arabic copy',
  longArabic.length === 0,
  longArabic.slice(0, 5).join(' | '),
);

// Open the new-employee form: the blueprint card is the Arabic-heavy part.
await page.waitForTimeout(800);
await page.getByRole('button', { name: /Add Employee/i }).first().click();
await page.waitForTimeout(2500);

const dialogText = await page.innerText('[role="dialog"]');
const dialogArabic = (dialogText.match(/[\u0600-\u06FF]+/g) || []).filter((w) => w.length > 3);
check(
  'the employee form in English carries no Arabic copy',
  dialogArabic.length === 0,
  dialogArabic.slice(0, 6).join(' | '),
);

// The blueprint card: the role name, its priorities and its summary.
const hasBlueprint = /Barber|Manager|Accountant|Cashier/.test(dialogText);
check('the blueprint card is in English', hasBlueprint, dialogText.slice(0, 160).replace(/\s+/g, ' '));

// A validation message in English: type a name with digits.
const nameInput = page.locator('input#employee-full-name');
await nameInput.fill('Ahmed 123');
await page.waitForTimeout(1200);
const afterTyping = await page.innerText('[role="dialog"]');
const englishError = /Name cannot contain digits/.test(afterTyping);
check(
  'a validation message is in English',
  englishError,
  afterTyping.match(/Name[^\n]{0,60}/)?.[0] ?? afterTyping.slice(0, 120),
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
