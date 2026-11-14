// Re-measure after the fix - see if the grid changed correctly
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto("http://localhost:3000/salon/salon-pro", { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const rows = document.querySelectorAll("#services dl > div");
  if (rows.length === 0) return { found: false, count: 0 };
  const row = rows[0];
  const cs = getComputedStyle(row);
  const kids = Array.from(row.children).map((el) => {
    const s = getComputedStyle(el);
    return {
      tag: el.tagName,
      cls: el.className.slice(0, 60),
      w: Math.round(el.getBoundingClientRect().width),
      gridColumn: s.gridColumnStart,
    };
  });
  const dd = row.querySelector("dd");
  const ddcs = dd ? getComputedStyle(dd) : null;
  return {
    found: true,
    rowW: Math.round(row.getBoundingClientRect().width),
    gridCols: cs.gridTemplateColumns,
    kids,
    dd: dd
      ? {
          w: Math.round(dd.getBoundingClientRect().width),
          maxWidth: ddcs.maxWidth,
          width: ddcs.width,
          text: dd.textContent?.slice(0, 50),
        }
      : null,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();