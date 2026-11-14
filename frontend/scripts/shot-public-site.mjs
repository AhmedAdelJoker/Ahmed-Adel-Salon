// Capture full-page screenshots of the public salon site for design review.
// Run from frontend/ so it resolves the already-installed playwright.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = process.argv[2] ?? "http://localhost:3000/salon/salon-pro";
const OUT = process.argv[3] ?? "C:/Users/Ahmed/Downloads/Salon-Management-Pro/.review/before";
mkdirSync(OUT, { recursive: true });

const shots = [
  { name: "01-hero", width: 1440, height: 900, full: false },
  { name: "02-full-desktop", width: 1440, height: 900, full: true },
  { name: "03-full-mobile", width: 390, height: 844, full: true },
];

const browser = await chromium.launch();

for (const shot of shots) {
  const ctx = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: 2,
    locale: "ar-EG",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  // The site holds a route-transition loader until its catalog fetch settles.
  await page.waitForTimeout(6000);

  const heading = await page
    .locator("h1")
    .first()
    .textContent()
    .catch(() => null);

  await page.screenshot({ path: `${OUT}/${shot.name}.png`, fullPage: shot.full });

  console.log(
    `${shot.name}: h1=${JSON.stringify(heading?.trim().slice(0, 60) ?? null)} errors=${errors.length}`,
  );
  for (const e of errors.slice(0, 4)) console.log(`   ! ${e.slice(0, 200)}`);
  await ctx.close();
}

await browser.close();
console.log(`\nsaved to ${OUT}`);