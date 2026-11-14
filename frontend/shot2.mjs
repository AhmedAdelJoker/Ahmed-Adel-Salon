import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "C:/Users/Ahmed/Downloads/Salon-Management-Pro/.review/before";
mkdirSync(OUT, { recursive: true });

const jobs = [
  { url: `${BASE}/salon/salon-pro/book`, name: "04-booking-desktop", w: 1440, h: 900, full: true },
  { url: `${BASE}/salon/salon-pro`, name: "05-team-section", w: 1440, h: 900, full: false, scrollTo: 2600 },
  { url: `${BASE}/salon/salon-pro`, name: "06-services-mobile", w: 390, h: 844, full: false, scrollTo: 900 },
];

const browser = await chromium.launch();

for (const j of jobs) {
  const ctx = await browser.newContext({
    viewport: { width: j.w, height: j.h },
    deviceScaleFactor: 2,
    locale: "ar-EG",
  });
  const page = await ctx.newPage();
  await page.goto(j.url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(5000);
  if (j.scrollTo) {
    await page.evaluate((y) => window.scrollTo(0, y), j.scrollTo);
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: `${OUT}/${j.name}.png`, fullPage: !!j.full });
  console.log(`${j.name} saved`);
  await ctx.close();
}

await browser.close();