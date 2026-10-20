// Render the user's improved mockup and report on layout/quality issues.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const SRC =
  "C:/Users/Ahmed/.minimax/v2/assets/2026/10/13/18-22-19-022-asset_20261013-182219-022_3e0aeb814cc0_9b3cd614-DESIGN_MOCKUP_IMPROVED 1.html";
const OUT = "C:/Users/Ahmed/Downloads/Salon-Management-Pro/.review/merged";
mkdirSync(OUT, { recursive: true });
const html = readFileSync(SRC, "utf8");

const browser = await chromium.launch();

async function shoot(ctx, tag, full) {
  const page = await ctx.newPage();
  const failed = [];
  const errors = [];
  page.on("requestfailed", (r) => failed.push(r.url().slice(0, 60)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 140)));
  await page.setContent(html, { waitUntil: "load", timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(4500);
  const h = await page.evaluate(() => document.body.scrollHeight);
  const imgs = await page.evaluate(() =>
    Array.from(document.images).map((i) => [i.naturalWidth, i.src.slice(-34)]),
  );
  console.log(`[${tag}] height=${h} imgs=${imgs.length} loaded=${imgs.filter((i) => i[0] > 0).length} jsErrors=${errors.length}`);
  for (const [w, s] of imgs) if (w === 0) console.log(`   ! img failed: ${s}`);
  for (const e of errors) console.log(`   ! js: ${e}`);
  for (const f of failed.slice(0, 4)) console.log(`   ! req: ${f}`);
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: full });
  return page;
}

const desk = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "ar-EG",
});
const page = await shoot(desk, "merged-01-hero", false);

for (const [name, sel] of [
  ["merged-03-about", "#about"],
  ["merged-04-services", "#services"],
  ["merged-05-gallery", "#gallery"],
  ["merged-06-team", "#team"],
  ["merged-07-reviews", "#reviews"],
  ["merged-08-contact", "#contact"],
]) {
  const el = page.locator(sel);
  if (await el.count()) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await el.screenshot({ path: `${OUT}/${name}.png` });
  } else console.log(`   ! missing section ${sel}`);
}

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/merged-02-full.png`, fullPage: true });

const mob = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "ar-EG",
});
await shoot(mob, "merged-09-mobile", true);

console.log("saved to", OUT);
await browser.close();