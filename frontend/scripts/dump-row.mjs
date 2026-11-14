// Dump the actual markup of one service row: what is producing the vertical
// bullet list under each service name?
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://localhost:3000/salon/salon-pro", { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
await page.waitForTimeout(6000);

const html = await page.evaluate(() => {
  const dl = document.querySelector("#services dl");
  const first = dl?.querySelector("div");
  return first ? first.outerHTML : "(no row)";
});
console.log(html.slice(0, 2600));
await browser.close();