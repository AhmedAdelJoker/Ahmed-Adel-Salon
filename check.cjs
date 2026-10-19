const { chromium } = require("C:/Users/Ahmed/Downloads/Salon-Management-Pro/node_modules/playwright-core");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

  await page.goto("http://localhost:5175/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const info = await page.evaluate(() => {
    const q = (s) => Array.from(document.querySelectorAll(s));
    const contact = document.querySelector("#contact");
    const footer = document.querySelector("footer");
    return {
      contactExists: !!contact,
      contactClass: contact ? contact.className : null,
      contactRows: q(".mk-c-row").length,
      contactActions: q(".mk-c-actions a").length,
      mapLink: !!document.querySelector("a.mk-map"),
      mapHref: document.querySelector("a.mk-map") ? document.querySelector("a.mk-map").href : null,
      footerCols: footer ? footer.querySelectorAll(".mk-f-grid > *").length : 0,
      footerLinks: q(".mk-f-link").length,
      footerSocial: q(".mk-social a").length,
      footerBottom: q(".mk-f-bot span").map((s) => s.textContent.trim()),
      reviews: q(".mk-rev").length,
      reviewGrid: !!document.querySelector(".mk-rev-grid"),
      verified: q(".mk-verified").length,
      team: q(".mk-member").length,
      gallery: q(".mk-work").length,
      h2: q(".mk-h2").map((h) => h.textContent.trim()),
    };
  });

  console.log(JSON.stringify(info, null, 2));
  console.log("CONSOLE_ERRORS", JSON.stringify(errors));

  if (info.contactExists && info.contactRows > 0) {
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: "C:/Users/Ahmed/AppData/Local/Temp/opencode/contact.png" });
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: "C:/Users/Ahmed/AppData/Local/Temp/opencode/footer.png" });

  await browser.close();
})();