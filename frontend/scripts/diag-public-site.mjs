// Diagnose why the public salon landing renders blank in a fresh browser.
import { chromium } from "playwright";

const URL = "http://localhost:3000/salon/salon-pro";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const console_ = [];
const requests = [];
page.on("console", (m) => console_.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => console_.push(`[pageerror] ${e.stack ?? e.message}`));
page.on("requestfailed", (r) =>
  requests.push(`FAILED ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`),
);
page.on("response", (r) => {
  if (r.status() >= 400) requests.push(`HTTP ${r.status()} ${r.url()}`);
});

await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 }).catch((e) =>
  console.log("goto:", e.message),
);
await page.waitForTimeout(7000);

const rootHtml = await page.evaluate(() => document.getElementById("root")?.innerHTML ?? "(no #root)");
console.log("--- #root length:", rootHtml.length);
console.log("--- #root snippet:", rootHtml.slice(0, 600));
console.log("--- body text:", JSON.stringify((await page.evaluate(() => document.body.innerText)).slice(0, 400)));
console.log("--- title:", await page.title());

console.log("\n--- console ---");
for (const line of console_.slice(0, 25)) console.log(line);
console.log("\n--- failed/4xx+ requests ---");
for (const line of requests.slice(0, 25)) console.log(line);
if (!requests.length) console.log("(none)");

await browser.close();