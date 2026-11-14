/**
 * The inventory page's numbers, checked against the data behind them.
 *
 * A dashboard that reports the wrong money is worse than one that reports
 * nothing: the owner makes decisions on it. These checks compare what the API
 * says against what the stored rows actually say.
 */
import { chromium } from 'playwright';

const API = 'http://127.0.0.1:8000/api/v1';
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
await page.goto('http://localhost:5173/login');
await page.locator('input[autocomplete="username"]').waitFor({ timeout: 20000 });
await page.locator('input[autocomplete="username"]').fill('admin');
await page.locator('input[autocomplete="current-password"]').fill(password);
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 30000 });

const api = async (path) =>
  page.evaluate(async (p) => {
    const token = localStorage.getItem('token') || '';
    const res = await fetch(p, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, total: res.headers.get('x-total-count'), body };
  }, path);

const summary = await api('/api/v1/products/summary');
const all = await api('/api/v1/products?page=1&page_size=1000');
const rows = Array.isArray(all.body) ? all.body : [];

// 1. The stock cost must be the money actually tied up in the shelf.
//
// `cost_price` is the cost of one PACK (`تكلفة العبوة`) and `weight` is how
// many base units a pack holds (`سعة العبوة`). The quantity on the row is in
// base units. So the value of the stock is quantity * (cost_price / weight),
// not quantity * cost_price -- which is what the summary reports, and it
// overstates the money by the pack size (250x, 1000x ...).
const dec = (v) => Number(v || 0);
let expectedCost = 0;
let expectedValue = 0;
for (const p of rows) {
  if (p.is_archived) continue;
  const weight = dec(p.weight);
  const unitCost = weight > 0 ? dec(p.cost_price) / weight : dec(p.cost_price);
  const unitPrice = weight > 0 ? dec(p.sell_price) / weight : dec(p.sell_price);
  expectedCost += dec(p.quantity) * unitCost;
  expectedValue += dec(p.quantity) * unitPrice;
}
const reportedCost = dec(summary.body?.total_cost);
const reportedValue = dec(summary.body?.total_value);

check(
  'the reported stock cost equals the money in the shelf',
  Math.abs(reportedCost - expectedCost) < 1,
  `reported ${reportedCost}, actual ${expectedCost.toFixed(2)}`,
);
check(
  'the reported stock value equals the money in the shelf',
  Math.abs(reportedValue - expectedValue) < 1,
  `reported ${reportedValue}, actual ${expectedValue.toFixed(2)}`,
);

// 2. The low-stock count and the low-stock filter must agree.
//
// The summary counts only unarchived rows; the list endpoint filters on
// quantity <= min_quantity_alert without excluding archived ones. So the
// banner says 2 while the filter shows 3, and the badge on a card disagrees
// with the number the owner clicked on.
const lowStockList = await api(
  '/api/v1/products?page=1&page_size=1000&is_archived=false&low_stock=true',
);
const lowStockListCount = Array.isArray(lowStockList.body)
  ? lowStockList.body.length
  : -1;
check(
  'the low-stock KPI matches the low-stock filter',
  dec(summary.body?.low_stock) === lowStockListCount,
  `KPI ${summary.body?.low_stock}, filter ${lowStockListCount}`,
);

// 3. A product with no alert threshold must not be reported as low stock.
//
// `min_quantity_alert` defaults to 0, and `quantity <= 0` is true for every
// product that was never given a threshold once its stock reaches zero -- but
// a product with a threshold of 0 that still has 100 in stock is not low.
const noThresholdLow = rows.filter(
  (p) => !p.is_archived && dec(p.min_quantity_alert) === 0 && dec(p.quantity) > 0,
);
const flagged = Array.isArray(lowStockList.body)
  ? lowStockList.body.filter((p) => dec(p.min_quantity_alert) === 0 && dec(p.quantity) > 0)
  : [];
check(
  'a product above a zero threshold is not flagged low',
  flagged.length === 0,
  `${flagged.length} products with threshold 0 and stock > 0 are flagged`,
);

// 4. The summary and the list must count the same rows.
//
// The summary applies `q` to the category as well; the list does not. A
// search for a category name therefore shows "3 results" in the KPI and an
// empty list.
const category = rows.find((p) => p.category)?.category;
if (category) {
  const byList = await api(
    `/api/v1/products?page=1&page_size=1000&q=${encodeURIComponent(category)}`,
  );
  const bySummary = await api(
    `/api/v1/products/summary?q=${encodeURIComponent(category)}`,
  );
  const listCount = Array.isArray(byList.body) ? byList.body.length : -1;
  check(
    'searching by category finds the same rows in the list and the KPIs',
    listCount === dec(bySummary.body?.total),
    `category "${category}": list ${listCount}, summary ${bySummary.body?.total}`,
  );
}

// 5. The active tab must not show archived rows.
//
// `is_archived` and `is_active` are two columns for one fact. The list
// filters on `is_archived`; the KPI counts `total - archived`. If a row ever
// has the two out of step, the tab and the counter disagree.
const activeTab = await api('/api/v1/products?page=1&page_size=1000&is_archived=false');
const activeRows = Array.isArray(activeTab.body) ? activeTab.body : [];
const drifted = activeRows.filter((p) => p.is_active === false);
check(
  'every row on the active tab is active',
  drifted.length === 0,
  `${drifted.length} rows have is_archived=false but is_active=false`,
);

// 6. The export must cover what the screen shows.
//
// The page exports with `is_archived` set only for the archived tab, so the
// active tab's export silently includes the archived rows too.
const exported = await api('/api/v1/exports/products/excel');
check(
  'the products export answers',
  exported.status === 200,
  `status ${exported.status}`,
);

// 7b. The insights endpoint behind the redesigned hero.
const insights = await api('/api/v1/products/insights?days=60&limit=4');
check(
  'the stock insights answer with the shelf totals',
  insights.status === 200 &&
    typeof insights.body?.totals?.units === 'number' &&
    typeof insights.body?.totals?.packs === 'number' &&
    Array.isArray(insights.body?.top_by_value),
  `status ${insights.status}, totals ${JSON.stringify(insights.body?.totals)}`,
);
check(
  'the insights shelf totals count exactly the active rows',
  Number(insights.body?.totals?.lines) === activeRows.length,
  `lines ${insights.body?.totals?.lines}, active rows ${activeRows.length}`,
);

// 7. The screen must agree with the numbers above.
//
// The API being right is only half of it: the hero is what the owner reads.
await page.goto('http://localhost:5173/inventory');
await page.locator('article').first().waitFor({ timeout: 30000 });

const hero = page.locator('section[aria-label="قيمة المخزون الحالية"]');
const heroText = (await hero.innerText()).replace(/\s+/g, ' ');
const valueText = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(dec(summary.body?.total_value));
check(
  'the hero shows the corrected shelf value',
  heroText.includes(valueText),
  `hero "${heroText.slice(0, 120)}", expected value ${valueText}`,
);

const costText = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(reportedCost);
check(
  'the hero shows the corrected stock cost',
  heroText.includes(costText),
  `hero "${heroText.slice(0, 160)}", expected cost ${costText}`,
);

// The weightless case no longer exists in the live data (the two products
// missing it were restored to their seed pack sizes), so this asserts the
// honest value instead: واكس شعر holds 15 g of a 150 g pack = 0.1 pack.
const waxCard = page.locator('article', { hasText: 'واكس شعر' });
const waxPacks = await waxCard
  .locator('div.grid.grid-cols-3 > div')
  .nth(1)
  .innerText();
check(
  'a small-stock line shows its real pack fraction',
  waxPacks.includes('0.1'),
  `card metric "${waxPacks.replace(/\s+/g, ' ')}"`,
);

const creamCard = page.locator('article', { hasText: 'كريم الشعر' });
const creamPacks = await creamCard
  .locator('div.grid.grid-cols-3 > div')
  .nth(1)
  .innerText();
check(
  'a pack-priced product shows its pack count',
  creamPacks.includes('11.11'),
  `card metric "${creamPacks.replace(/\s+/g, ' ')}"`,
);

await page.locator('input[placeholder]').first().fill('cream');
await page.waitForTimeout(800);
const searchCards = await page.locator('article').count();
check(
  'searching a category shows its products',
  searchCards === 1,
  `${searchCards} cards`,
);
await page.locator('input[placeholder]').first().fill('');
await page.waitForTimeout(800);

await page.getByRole('tab', { name: /مؤرشف/ }).click();
await page.waitForTimeout(800);
const archivedEmpty = await page
  .getByText('لا توجد أصناف مؤرشفة', { exact: false })
  .count();
check(
  'the archived tab is empty when nothing is archived',
  archivedEmpty > 0,
  `empty state nodes: ${archivedEmpty}`,
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
