// Render the design mockup to PNG at desktop + mobile for review.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const SRC = "C:/Users/Ahmed/Downloads/Salon-Management-Pro/DESIGN_MOCKUP.html";
const OUT = "C:/Users/Ahmed/Downloads/Salon-Management-Pro/.review/after";
mkdirSync(OUT, { recursive: true });
const html = readFileSync(SRC, "utf8");

const browser = await chromium.launch();

async function shoot(ctx, tag, full) {
  const page = await ctx.newPage();
  const failed = [];
  page.on("requestfailed", (r) => failed.push(r.url().slice(0, 70)));
  await page.setContent(html, { waitUntil: "load", timeout: 60000 }).catch((e) => {
    console.log("setContent:", e.message.split("\n")[0]);
  });
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(4000);
  const h = await page.evaluate(() => document.body.scrollHeight);
  const imgs = await page.evaluate(() =>
    Array.from(document.images).map((i) => [i.naturalWidth, i.src.slice(-38)]),
  );
  console.log(`[${tag}] height=${h} images=${imgs.length} loaded=${imgs.filter((i) => i[0] > 0).length}`);
  for (const [w, s] of imgs) if (w === 0) console.log(`   ! image failed: ${s}`);
  for (const f of failed.slice(0, 5)) console.log(`   ! requestfailed: ${f}`);
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: full });
  return page;
}

const desk = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "ar-EG",
});
const page = await shoot(desk, "mockup-02-full", true);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/mockup-01-hero.png` });

for (const [name, sel] of [
  ["mockup-03-about", "#about"],
  ["mockup-04-services", "#services"],
  ["mockup-05-team", "#team"],
  ["mockup-06-reviews", "#reviews"],
  ["mockup-07-contact", "#contact"],
]) {
  const el = page.locator(sel);
  if (await el.count()) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await el.screenshot({ path: `${OUT}/${name}.png` });
  }
}

const mob = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "ar-EG",
});
await shoot(mob, "mockup-08-mobile", true);

console.log("saved to", OUT);
await browser.close();