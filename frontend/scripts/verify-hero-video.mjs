// Verify the hero video actually plays on the public site, and that the
// reduced-motion / no-video paths still render the image.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = "http://localhost:3000/salon/salon-pro";
const OUT = "C:/Users/Ahmed/Downloads/Salon-Management-Pro/.review/verify";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function run(label, opts) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: "ar-EG",
    reducedMotion: opts.reducedMotion,
  });
  const page = await ctx.newPage();
  const failed = [];
  page.on("requestfailed", (r) => failed.push(r.url().slice(0, 70)));
  await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(6000);

  const state = await page.evaluate(() => {
    const v = document.querySelector("section video");
    const img = document.querySelector("section img");
    return {
      hasVideo: Boolean(v),
      videoSrc: v?.currentSrc || v?.querySelector("source")?.src || null,
      readyState: v?.readyState ?? null,
      currentTime: v?.currentTime ?? null,
      paused: v?.paused ?? null,
      videoW: v?.videoWidth ?? null,
      hasImg: Boolean(img),
      imgSrc: img?.currentSrc || img?.src || null,
      revealReady: document.documentElement.classList.contains("js-reveal-ready"),
      revealCount: document.querySelectorAll(".reveal").length,
    };
  });

  // Scroll the whole page: reveals are meant to fire on entry, so anything still
  // hidden after a full pass is a real failure, not just off-screen content.
  const afterScroll = await page.evaluate(async () => {
    const step = window.innerHeight * 0.7;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 180));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 900));
    const all = Array.from(document.querySelectorAll(".reveal"));
    return {
      total: all.length,
      revealed: all.filter((e) => e.classList.contains("is-revealed")).length,
      stillHidden: all.filter((e) => getComputedStyle(e).opacity === "0").length,
    };
  });

  console.log(`\n[${label}]`);
  console.log(`  video present : ${state.hasVideo}  src=${state.videoSrc}`);
  console.log(`  video playing : readyState=${state.readyState} currentTime=${state.currentTime} paused=${state.paused} size=${state.videoW}`);
  console.log(`  image present : ${state.hasImg}  ${state.imgSrc?.slice(-44)}`);
  console.log(`  reveal        : ready=${state.revealReady} total=${state.revealCount}`);
  console.log(`  after scroll  : revealed=${afterScroll.revealed}/${afterScroll.total} stillHidden=${afterScroll.stillHidden}`);
  if (failed.length) console.log("  failed reqs   :", failed.slice(0, 3));

  await page.screenshot({ path: `${OUT}/${label}.png` });
  await ctx.close();
  return { ...state, afterScroll };
}

const normal = await run("01-video-normal-motion", { reducedMotion: "no-preference" });
const reduced = await run("02-video-reduced-motion", { reducedMotion: "reduce" });

console.log("\n=== verdict ===");
console.log(`video element rendered : ${normal.hasVideo ? "YES" : "NO"}`);
console.log(`clip actually decoding : ${normal.readyState >= 2 && normal.videoW > 0 ? "YES" : "NO"}`);
console.log(`poster/fallback image  : ${normal.hasImg ? "YES" : "NO"}`);
console.log(`motion ON  hidden after scroll : ${normal.afterScroll.stillHidden} (must be 0)`);
console.log(`motion OFF hidden             : ${reduced.afterScroll.stillHidden} (must be 0)`);

await browser.close();