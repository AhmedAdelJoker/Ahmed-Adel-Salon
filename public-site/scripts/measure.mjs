/**
 * measure.mjs — dump the box model of key elements on a route.
 *
 * Screenshots show *that* a layout is wrong; this shows *why*. Run with:
 *   node scripts/measure.mjs /
 */
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4181;
const route = process.argv[2] || "/";

async function findChrome() {
  const roots = [
    path.join(process.env.USERPROFILE || "", ".cache/puppeteer/chrome"),
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application"),
  ];
  for (const dir of roots) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
      const hit = entries.find((e) => e.isFile() && e.name === "chrome.exe");
      if (hit) return path.join(hit.parentPath || hit.path, hit.name);
    } catch {
      /* next */
    }
  }
  throw new Error("no chrome");
}

const { preview } = await import("vite");
const server = await preview({
  root,
  preview: { port: PORT, strictPort: true, host: "127.0.0.1" },
  logLevel: "error",
});

const puppeteer = require("puppeteer-core");
const browser = await puppeteer.launch({
  executablePath: await findChrome(),
  headless: "new",
  args: ["--no-sandbox"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(`http://127.0.0.1:${PORT}${route}`, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);

const report = await page.evaluate(() => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      cls: (el.className || "").toString().slice(0, 70),
      w: Math.round(r.width),
      h: Math.round(r.height),
      maxW: cs.maxWidth,
      display: cs.display,
      fontSize: cs.fontSize,
      dir: cs.direction,
    };
  };

  const h1 = document.querySelector("h1");
  const out = { viewport: document.documentElement.clientWidth, chain: [] };
  let el = h1;
  while (el && el !== document.documentElement) {
    out.chain.push(box(el));
    el = el.parentElement;
  }
  return out;
});

console.log(`viewport ${report.viewport}px\n`);
for (const node of report.chain) {
  console.log(
    `  ${String(node.w).padStart(5)}px  ${node.tag.padEnd(7)} maxW=${String(node.maxW).padEnd(10)} fs=${String(node.fontSize).padEnd(7)} ${node.cls}`,
  );
}

await browser.close();
await server.httpServer.close();
