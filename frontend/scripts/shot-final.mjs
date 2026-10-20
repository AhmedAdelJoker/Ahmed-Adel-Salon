// Render the merged final mockup and check gallery + filters actually work.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const SRC = "C:/Users/Ahmed/Downloads/Salon-Management-Pro/DESIGN_MOCKUP_FINAL.html";
const OUT = "C:/Users/Ahmed/Downloads/Salon-Management-Pro/.review/final";
mkdirSync(OUT, { recursive: true });
const html = readFileSync(SRC, "utf8");

const browser = await chromium.launch();

async function shoot(ctx, tag, full) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text().slice(0, 120)));
  await page.setContent(html, { waitUntil: "load", timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.waitForTimeout(5000);
  // Scroll the whole page so lazy work settles, then return to the top.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
  const h = await page.evaluate(() => document.body.scrollHeight);
  const imgs = await page.evaluate(() =>
    Array.from(document.images).map((i) => [i.naturalWidth, i.src.slice(-30)]),
  );
  console.log(`[${tag}] height=${h} imgs=${imgs.length} loaded=${imgs.filter((i) => i[0] > 0).length} errors=${errors.length}`);
  for (const [w, s] of imgs) if (w === 0) console.log(`   ! img failed: ${s}`);
  for (const e of errors) console.log(`   ! ${e}`);
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: full });
  return page;
}

const desk = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: "ar-EG",
});
const page = await shoot(desk, "final-01-hero", false);

// Exercise the filter that previously crashed on a missing .no-results node.
await page.locator('.filters button[data-filter="care"]').click();
await page.waitForTimeout(500);
const visible = await page.evaluate(
  () => Array.from(document.querySelectorAll(".svc")).filter((c) => c.style.display !== "none").length,
);
console.log("filter 'care' visible cards:", visible);
await page.locator("#services").scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.locator("#services").screenshot({ path: `${OUT}/final-04-services-filtered.png` });
await page.locator('.filters button[data-filter="all"]').click();
await page.waitForTimeout(400);

for (const [name, sel] of [
  ["final-03-about", "#about"],
  ["final-05-gallery", "#gallery"],
  ["final-06-team", "#team"],
  ["final-07-reviews", "#reviews"],
  ["final-08-contact", "#contact"],
]) {
  const el = page.locator(sel);
  if (await el.count()) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await el.screenshot({ path: `${OUT}/${name}.png` });
  } else console.log(`   ! missing ${sel}`);
}

await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/final-02-full.png`, fullPage: true });

const mob = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "ar-EG",
});
await shoot(mob, "final-09-mobile", true);

console.log("saved to", OUT);
await browser.close();