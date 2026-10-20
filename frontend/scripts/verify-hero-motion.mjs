// Two hero frames a few seconds apart, to show the clip is actually moving
// rather than a frozen poster. Pixels must differ between the two.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const URL = "http://localhost:3000/salon/salon-pro";
const OUT = "C:/Users/Ahmed/Downloads/Salon-Management-Pro/.review/final-site";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "ar-EG",
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
await page.waitForTimeout(6000);

const hash = (p) => createHash("sha1").update(readFileSync(p)).digest("hex").slice(0, 12);

const paths = [];
for (const [i, wait] of [0, 3000].entries()) {
  await page.waitForTimeout(wait);
  const p = `${OUT}/site-04-motion-frame${i + 1}.png`;
  await page.screenshot({ path: p });
  paths.push(p);
}

const t = await page.evaluate(() => document.querySelector("section video")?.currentTime ?? null);
const [h1, h2] = paths.map(hash);
console.log(`frame hashes: ${h1} vs ${h2} -> ${h1 === h2 ? "IDENTICAL (no motion)" : "DIFFERENT (moving)"}`);
console.log(`video currentTime at capture: ${t}`);

await browser.close();