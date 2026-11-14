const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = [];
  p.on("console", m => { if (m.type() === "error") errs.push(m.text().slice(0,80)); });
  await p.goto("http://localhost:5173/", { waitUntil: "networkidle", timeout: 45000 });
  await p.waitForTimeout(3000);
  const info = await p.evaluate(() => {
    // Access window object to see if there's any catalog data stored
    const win = window;
    return {
      hasCatalog: !!win.__catalog,
      catalogBusinessKeys: win.__catalog ? Object.keys(win.__catalog.business || {}).filter(k => k.includes("portfolio")) : "no catalog",
      settingsHasPortfolio: typeof window.__settings === "object" && window.__settings !== null ? window.__settings.landing_portfolio : null,
      settingsHasPortfolioCamel: typeof window.__settings === "object" && window.__settings !== null ? window.__settings.landingPortfolio : null,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await b.close();
})();
