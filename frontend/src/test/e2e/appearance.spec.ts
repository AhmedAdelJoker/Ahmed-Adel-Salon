/**
 * Visual proof for the v2 token layer.
 *
 * The unit tests prove the tokens are *declared*; they cannot prove they
 * *render*. This walks the real built app against the real backend, logs in
 * once, and then captures the same surface across every axis the appearance
 * system controls — accent, theme, density, contrast — plus the bidirectional
 * check, which is where a physical spacing utility would visibly break.
 *
 * Signing in once per test rather than once per variant matters: the auth token
 * lives in localStorage, so a second navigation to /login redirects straight
 * away and the form is never in the DOM. Appearance, by contrast, is a pure
 * device preference, so it can be changed and the page reloaded between
 * captures without touching the session.
 *
 * Output: test-results/appearance/*.png
 */

import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "test-results/appearance";

/**
 * Seeded credentials for `backend/e2e_server.py`, which relaxes the rate
 * limits and creates a known superuser. Same values the working-hours spec
 * uses, so both suites can share one server instance.
 */
const USERNAME = "admin";
const PASSWORD = "TestAdmin123";

mkdirSync(OUT, { recursive: true });

async function signIn(page: Page) {
  await page.goto("/login");
  // Autocomplete attributes rather than labels: the form is bilingual and its
  // visible labels change with the locale, but the semantics do not.
  await page.locator('input[autocomplete="username"]').fill(USERNAME);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 25_000 });
  await page.waitForSelector("#main-content", { timeout: 25_000 });
}

/** Swaps the device appearance and reloads, keeping the session intact. */
async function applyAppearance(page: Page, prefs: Record<string, string>) {
  await page.evaluate((values) => {
    for (const [key, value] of Object.entries(values)) {
      window.localStorage.setItem(key, value);
    }
  }, prefs);
  await page.goto("/appearance", { waitUntil: "networkidle" });
  // The bootstrap script runs before paint; give the providers a frame to
  // settle so the capture is not a half-styled intermediate state.
  await page.waitForTimeout(350);
}

/**
 * Collects the user-visible strings on the page.
 *
 * Reading the DOM rather than the screenshot is deliberate: a garbled Arabic
 * glyph in a rendered image is ambiguous between "corrupt data" and "I
 * misread the font at 12px", and only the text content can settle it.
 */
async function visibleStrings(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? "").trim();
      // Visible only: skip display:none subtrees, which is where portalled
      // dialogs and hidden menus park their copy.
      const parent = node.parentElement;
      if (!text || !parent || parent.offsetParent === null) continue;
      out.push(text);
    }
    return [...new Set(out)];
  });
}

/** Arabic/Latin boundaries that are not a space, a bracket or punctuation. */
const SPLICE = /([؀-ۿ])([A-Za-z]{2,})|([A-Za-z]{2,})([؀-ۿ])/gu;

test.describe("v2 appearance system", () => {
  test("captures every accent in light mode", async ({ page }) => {
    await signIn(page);
    for (const accent of ["indigo", "violet", "cyan", "emerald", "gold"]) {
      await applyAppearance(page, {
        accent,
        theme: "light",
        density: "comfortable",
        motion: "reduced",
        highContrast: "false",
      });
      await expect(page.locator("html")).toHaveAttribute("data-accent", accent);
      await page.screenshot({ path: `${OUT}/accent-${accent}-light.png`, fullPage: true });
    }
  });

  test("captures the dark theme across the density axis", async ({ page }) => {
    await signIn(page);
    for (const density of ["compact", "comfortable", "spacious"]) {
      await applyAppearance(page, {
        accent: "indigo",
        theme: "dark",
        density,
        motion: "reduced",
        highContrast: "false",
      });
      await expect(page.locator("html")).toHaveAttribute("data-density", density);
      await page.screenshot({ path: `${OUT}/dark-${density}.png`, fullPage: true });
    }
  });

  test("captures the high-contrast mode", async ({ page }) => {
    await signIn(page);
    await applyAppearance(page, {
      accent: "indigo",
      theme: "light",
      density: "comfortable",
      motion: "reduced",
      highContrast: "true",
    });
    await expect(page.locator("html")).toHaveAttribute("data-contrast", "high");
    await page.screenshot({ path: `${OUT}/high-contrast.png`, fullPage: true });
  });

  test("the shell mirrors correctly in both directions", async ({ page }) => {
    await signIn(page);

    const measurements: Record<string, Record<string, number>> = {};

    for (const [language, dir] of [
      ["ar", "rtl"],
      ["en", "ltr"],
    ]) {
      await applyAppearance(page, {
        accent: "indigo",
        theme: "light",
        density: "comfortable",
        motion: "reduced",
        highContrast: "false",
        language,
      });

      const html = page.locator("html");
      await expect(html).toHaveAttribute("dir", dir);
      await expect(html).toHaveAttribute("lang", language);

      await page.goto("/appearance", { waitUntil: "networkidle" });
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${OUT}/dir-${dir}.png`, fullPage: true });

      // A logical inset resolves against the inline axis, so its computed
      // margin changes sign between RTL and LTR. A physical one does not —
      // which is exactly the bug this measurement exists to catch.
      measurements[dir] = await page.evaluate(() => {
        const probe = document.createElement("div");
        // Author the same value for all four axes. Under RTL the browser
        // resolves `margin-inline-start` onto the right-hand physical edge and
        // `margin-inline-end` onto the left; under LTR it is the reverse.
        probe.style.marginInlineStart = "2rem";
        probe.style.marginInlineEnd = "3rem";
        probe.style.paddingInlineStart = "4rem";
        probe.style.paddingInlineEnd = "5rem";
        document.body.appendChild(probe);
        const computed = getComputedStyle(probe);
        const result = {
          marginLeft: parseFloat(computed.marginLeft),
          marginRight: parseFloat(computed.marginRight),
          paddingLeft: parseFloat(computed.paddingLeft),
          paddingRight: parseFloat(computed.paddingRight),
          inlineSize: probe.getBoundingClientRect().width,
        };
        probe.remove();
        return result;
      });
    }

    // Same authored values, opposite resolved physical edges.
    const px = (rem: number) => rem * 16;
    expect(measurements.rtl.marginRight).toBeCloseTo(px(2), 0);
    expect(measurements.rtl.marginLeft).toBeCloseTo(px(3), 0);
    expect(measurements.rtl.paddingRight).toBeCloseTo(px(4), 0);
    expect(measurements.rtl.paddingLeft).toBeCloseTo(px(5), 0);

    expect(measurements.ltr.marginLeft).toBeCloseTo(px(2), 0);
    expect(measurements.ltr.marginRight).toBeCloseTo(px(3), 0);
    expect(measurements.ltr.paddingLeft).toBeCloseTo(px(4), 0);
    expect(measurements.ltr.paddingRight).toBeCloseTo(px(5), 0);
  });

  test("every token resolves at runtime, with no unresolved var()", async ({ page }) => {    // Catches the "declared but never defined" class of bug that the static
    // token guard cannot see, because it compares against the source rather
    // than the computed style the browser actually produced.
    await signIn(page);
    await applyAppearance(page, {
      accent: "gold",
      theme: "dark",
      density: "compact",
      motion: "reduced",
      highContrast: "false",
    });

    const report = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const names = [
        "--accent-50",
        "--accent-500",
        "--accent-950",
        "--accent-hue",
        "--surface-canvas",
        "--surface-raised",
        "--surface-sunken",
        "--surface-overlay",
        "--content-primary",
        "--content-secondary",
        "--line-subtle",
        "--line-default",
        "--line-strong",
        "--status-success",
        "--status-warning",
        "--status-danger",
        "--status-info",
        "--action-primary",
        "--focus-ring",
        "--elevation-1",
        "--elevation-4",
        "--glow-accent",
        "--radius-sm",
        "--radius-pill",
        "--blur-glass",
        "--gradient-accent",
        "--chrome-color",
        "--chart-1",
        "--chart-8",
        "--density-control-h",
        "--density-row-y",
        // The v1 bridge, still consumed by ~365 unmigrated files.
        "--bg-card",
        "--bg-elevated",
        "--text-main",
        "--border-strong",
        "--primary-soft",
        "--secondary-soft",
        "--shadow-neon",
        "--sidebar-surface",
      ];
      const resolved: Record<string, string> = {};
      for (const name of names) resolved[name] = style.getPropertyValue(name).trim();
      return {
        resolved,
        attributes: { ...document.documentElement.dataset },
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        themeColorMeta: document
          .querySelector('meta[name="theme-color"]:not([media])')
          ?.getAttribute("content"),
      };
    });

    const unresolved = Object.entries(report.resolved)
      .filter(([, value]) => value === "" || value.includes("var("))
      .map(([name, value]) => `${name} = "${value}"`);

    expect(unresolved, "tokens that failed to resolve").toEqual([]);
    expect(report.attributes.accent).toBe("gold");
    expect(report.attributes.theme).toBe("dark");
    expect(report.attributes.density).toBe("compact");
    expect(report.bodyBackground).not.toBe("rgba(0, 0, 0, 0)");
    // The browser chrome follows the canvas, read back through the cascade.
    expect(report.themeColorMeta).toBe("#08080a");
  });

  test("the theme choice survives the preferences round-trip", async ({ page }) => {
    // Regression guard for a real defect: `loadPreferences()` ran on every
    // mount and wrote the *server* theme over the local one, so choosing light
    // looked like it worked for the length of the session and then reverted.
    // The same clobber hit the locale and flipped `dir` back to rtl.
    await signIn(page);

    for (const theme of ["light", "dark", "light"] as const) {
      await applyAppearance(page, {
        theme,
        accent: "indigo",
        density: "comfortable",
        motion: "reduced",
        highContrast: "false",
      });

      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator("html")).toHaveClass(
        theme === "dark" ? /(^|\s)dark(\s|$)/ : /^(?!.*\bdark\b).*$/,
      );
      // The resolved canvas has to match, not just the attribute.
      const background = await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      );
      const [r, g, b] = background.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      if (theme === "dark") {
        expect(luminance, "dark theme should paint a dark canvas").toBeLessThan(0.2);
      } else {
        expect(luminance, "light theme should paint a light canvas").toBeGreaterThan(0.8);
      }
    }
  });

  test("the rendered Arabic copy is not corrupted", async ({ page }) => {
    // Reading the DOM instead of the screenshot: a garbled glyph in a rendered
    // image is ambiguous between corrupt data and a misread 12px font, and only
    // the text content settles it. This walks the surfaces a user sees first.
    await signIn(page);
    await applyAppearance(page, {
      theme: "light",
      accent: "indigo",
      density: "comfortable",
      motion: "reduced",
      highContrast: "false",
    });

    const corrupt: string[] = [];
    const pages = ["/appearance", "/owner", "/cashier/customers"];

    for (const route of pages) {
      await page.goto(route, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      for (const text of await visibleStrings(page)) {
        if (text.includes("\uFFFD")) {
          corrupt.push(`${route}: replacement char in "${text}"`);
        }
        for (const match of text.matchAll(SPLICE)) {
          corrupt.push(`${route}: splice "${match[0]}" in "${text}"`);
        }
      }
    }

    expect(corrupt, "user-visible Arabic is corrupted").toEqual([]);
  });
});
