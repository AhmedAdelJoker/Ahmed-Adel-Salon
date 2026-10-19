// Read the services section at full resolution, and exercise the filters.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const URL = "http://localhost:3000/salon/salon-pro";
const OUT = "C:/Users/Ahmed/Downloads/Salon-Management-Pro/.review/services";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
  locale: "ar-EG",
});
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
await page.waitForTimeout(6000);

const section = page.locator("#services");
await section.scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await section.screenshot({ path: `${OUT}/services-01-default.png` });

// What does the filter row actually contain?
const chips = await page.evaluate(() => {
  const group = document.querySelector('#services [role="group"]');
  if (!group) return { found: false };
  return {
    found: true,
    label: group.getAttribute("aria-label"),
    chips: Array.from(group.querySelectorAll("button")).map((b) => ({
      text: b.textContent?.trim(),
      pressed: b.getAttribute("aria-pressed"),
    })),
  };
});
console.log("filter row:", JSON.stringify(chips));

const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll("#services dt")).map((el) => el.textContent?.trim()),
);
console.log(`services visible: ${rows.length} ->`, rows.join(" | "));

// Exercise a non-"all" chip and re-count.
if (chips.found && chips.chips.length > 1) {
  const target = chips.chips.find((c) => c.pressed !== "true" && c.text !== "الكل");
  if (target) {
    await page
      .locator("#services [role=group] button", { hasText: target.text })
      .first()
      .click();
    await page.waitForTimeout(700);
    const after = await page.evaluate(() =>
      Array.from(document.querySelectorAll("#services dt")).map((el) => el.textContent?.trim()),
    );
    console.log(`after clicking "${target.text}": ${after.length} ->`, after.join(" | "));
    await section.screenshot({ path: `${OUT}/services-02-filtered.png` });
  }
}

await browser.close();