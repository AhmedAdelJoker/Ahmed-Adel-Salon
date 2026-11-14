// Final public-site capture: hero + a scroll-through, to show the reveal
// animation landing correctly and the page still reading well without a clip.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

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

await page.screenshot({ path: `${OUT}/site-01-hero.png` });

// Scroll through once so every reveal has fired before the full-page capture.
await page.evaluate(async () => {
  const step = window.innerHeight * 0.7;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 200));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 1200));
});

const state = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll(".reveal"));
  return {
    reveals: all.length,
    revealed: all.filter((e) => e.classList.contains("is-revealed")).length,
    hidden: all.filter((e) => getComputedStyle(e).opacity === "0").length,
    video: Boolean(document.querySelector("section video")),
  };
});
console.log(`reveals ${state.revealed}/${state.reveals} revealed, ${state.hidden} hidden, video=${state.video}`);

await page.screenshot({ path: `${OUT}/site-02-full.png`, fullPage: true });

const mob = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: "ar-EG",
});
const mp = await mob.newPage();
await mp.goto(URL, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
await mp.waitForTimeout(5000);

// Same scroll pass as desktop. A full-page capture without it photographs the
// reveal elements at opacity 0, which reads as a broken empty section rather
// than the intended animation.
await mp.evaluate(async () => {
  const step = window.innerHeight * 0.7;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 180));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 1200));
});

const mState = await mp.evaluate(() => {
  const all = Array.from(document.querySelectorAll(".reveal"));
  return {
    reveals: all.length,
    revealed: all.filter((e) => e.classList.contains("is-revealed")).length,
    hidden: all.filter((e) => getComputedStyle(e).opacity === "0").length,
  };
});
console.log(
  `mobile reveals ${mState.revealed}/${mState.reveals} revealed, ${mState.hidden} hidden`,
);

await mp.screenshot({ path: `${OUT}/site-03-mobile.png`, fullPage: true });

console.log("saved to", OUT);
await browser.close();