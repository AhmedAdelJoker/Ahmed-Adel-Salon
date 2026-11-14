// Which palette is the running site actually using, and does the hero text
// colour come from the theme while the photo stays dark?
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/salon/salon-pro", { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
await page.waitForTimeout(5000);

const info = await page.evaluate(() => {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const h1 = document.querySelector("h1");
  const h1cs = h1 ? getComputedStyle(h1) : null;
  return {
    htmlClass: root.className,
    cBg: cs.getPropertyValue("--c-bg").trim(),
    cText: cs.getPropertyValue("--c-text").trim(),
    cAccent: cs.getPropertyValue("--c-accent").trim(),
    h1Color: h1cs?.color,
    h1FontSize: h1cs?.fontSize,
    heroImg: document.querySelector("section img")?.getAttribute("src"),
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();