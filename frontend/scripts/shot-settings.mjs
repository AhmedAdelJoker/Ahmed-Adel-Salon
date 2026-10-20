// Screenshot the owner website-settings "المعرض" tab, which now hosts the hero
// video uploader and the motion master switch.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "C:/Users/Ahmed/Downloads/Salon-Management-Pro/.review/settings";
mkdirSync(OUT, { recursive: true });

const BASE = "http://localhost:5173";
const user = process.argv[2];
const pass = process.argv[3];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
  locale: "ar-EG",
});
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2500);

if (user) {
  // The form inputs carry no `name`/`id` — select by placeholder.
  const u = page.getByPlaceholder(/اسم المستخدم/).first();
  const p = page.getByPlaceholder(/•••/).first();
  await u.fill(user);
  await p.fill(pass);
  await page.getByRole("button", { name: /دخول المنصة/ }).first().click();
  await page.waitForTimeout(6000);
}

// If login didn't take, dump what the form actually looks like so the selector
// can be fixed instead of guessing again.
if (page.url().includes("/login")) {
  const dump = await page.evaluate(() => ({
    inputs: Array.from(document.querySelectorAll("input")).map((i) => ({
      name: i.name, id: i.id, type: i.type, placeholder: i.placeholder,
    })),
    buttons: Array.from(document.querySelectorAll("button")).map((b) => b.textContent?.trim().slice(0, 30)),
  }));
  console.log("LOGIN FAILED — form dump:", JSON.stringify(dump, null, 1));
}

await page.goto(`${BASE}/owner/settings?tab=website`, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/settings-01-content.png` });

// Open the portfolio sub-tab (المعرض) which holds the new controls.
const tab = page.getByRole("tab", { name: /المعرض/ }).or(page.getByText("المعرض").first());
if (await tab.count()) {
  await tab.first().click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/settings-02-portfolio.png` });
  console.log("portfolio tab opened");
} else {
  console.log("portfolio tab NOT found");
}

const hasVideo = await page.getByText(/فيديو الغلاف/).count();
const hasMotion = await page.getByText(/الحركة والانتقالات/).count();
console.log(`video section present: ${hasVideo > 0}`);
console.log(`motion section present: ${hasMotion > 0}`);
console.log("url:", page.url());

await browser.close();