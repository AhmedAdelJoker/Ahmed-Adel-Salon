/**
 * screenshot.mjs — render the built site in a real browser and capture it.
 *
 * Design work cannot be verified from source. This boots the production build
 * with `vite preview`, walks the routes at a set of viewports, and writes PNGs
 * to .screenshots/ so the layout can actually be looked at.
 *
 * Usage:
 *   node scripts/screenshot.mjs                    # all routes, all viewports
 *   node scripts/screenshot.mjs /book desktop       # filter by route + viewport
 *   node scripts/screenshot.mjs / /book mobile desktop   # order does not matter
 *
 * Requires puppeteer-core (already a devDependency of the repo root) and a
 * local Chrome. Set CHROME_PATH to override the binary.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

/*
 * Watchdog. A dev server plus a browser plus an open HMR socket can leave
 * handles behind that keep Node alive after the work is done, so the run is
 * bounded explicitly rather than relying on the process exiting on its own.
 */
const WATCHDOG_MS = Number(process.env.SCREENSHOT_TIMEOUT || 180_000);
const watchdog = setTimeout(() => {
  console.error(`\nwatchdog: no completion after ${WATCHDOG_MS / 1000}s — forcing exit`);
  process.exit(2);
}, WATCHDOG_MS);
watchdog.unref?.();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT = path.join(root, ".screenshots");

/**
 * Ask the OS for a free port instead of hard-coding one.
 *
 * A fixed port collides with a server left behind by an interrupted run, and
 * the obvious fix — shelling out to find and kill it — deadlocks when the
 * script is itself launched from PowerShell, because `execFileSync` blocks the
 * event loop while the child waits on the same shell.
 */
async function freePort() {
  const { createServer } = await import("node:net");
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const VIEWPORTS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  tablet: { width: 834, height: 1112, deviceScaleFactor: 2 },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2 },
  wide: { width: 1920, height: 1080, deviceScaleFactor: 1 },
};

const ROUTES = ["/", "/book"];
const DEMO_QUERY = process.env.DEMO === "1" ? "demo=1" : "";
let PORT;
let BASE;

async function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const roots = [
    path.join(process.env.USERPROFILE || "", ".cache/puppeteer/chrome"),
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application"),
    path.join(process.env.ProgramFiles || "", "Google/Chrome/Application"),
  ];
  for (const dir of roots) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
      const hit = entries.find((e) => e.isFile() && e.name === "chrome.exe");
      if (hit) return path.join(hit.parentPath || hit.path, hit.name);
    } catch {
      // try the next candidate
    }
  }
  throw new Error("No Chrome found. Set CHROME_PATH.");
}

async function startPreview() {
  const vite = await import("vite");
  if (DEMO_QUERY) {
    // The demo catalogue is gated on import.meta.env.DEV, so it only resolves
    // under the dev server; a preview build renders every empty state.
    // createServer() does not bind until listen() is called — preview() does
    // that for you, which is why only this branch needs the explicit call.
    const server = await vite.createServer({
      root,
      server: { port: PORT, strictPort: true, host: "127.0.0.1" },
      logLevel: "warn",
    });
    await server.listen();
    return server;
  }
  return vite.preview({
    root,
    preview: { port: PORT, strictPort: true, host: "127.0.0.1" },
    logLevel: "warn",
  });
}
/** Vite resolves before the socket is accepting; poll until it answers. */
async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server never became ready at ${url}`);
}

async function main() {
  /*
   * Filters are positional-free: any argument starting with `/` is a route, any
   * argument naming a viewport is a viewport, and the order does not matter.
   *
   * Previously this read `argv[2]` as the route and `argv[3]` as the viewport,
   * so `screenshot.mjs / /book mobile` treated `/book` as a viewport name.
   * `VIEWPORTS["/book"]` is undefined, which did not throw — it produced a file
   * literally named `home-\book.png` and an ENOENT about a directory that did
   * not exist. An unknown viewport is now a hard error.
   */
  const routeFilters = [];
  const viewportFilters = [];
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("/")) routeFilters.push(arg);
    else if (arg in VIEWPORTS) viewportFilters.push(arg);
    else {
      console.error(
        `Unknown argument "${arg}".\n` +
          `  routes:    ${ROUTES.join(" ")}\n` +
          `  viewports: ${Object.keys(VIEWPORTS).join(" ")}`,
      );
      process.exit(1);
    }
  }

  PORT = await freePort();
  BASE = `http://127.0.0.1:${PORT}`;

  const routes = routeFilters.length ? routeFilters : ROUTES;
  const viewports = viewportFilters.length
    ? Object.fromEntries(viewportFilters.map((name) => [name, VIEWPORTS[name]]))
    : VIEWPORTS;

  await fs.mkdir(OUT, { recursive: true });
  const executablePath = await findChrome();
  const puppeteer = require("puppeteer-core");

  const server = await startPreview();
  await waitForServer(`${BASE}/`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });

  const problems = [];

  try {
    for (const [name, viewport] of Object.entries(viewports)) {
      const page = await browser.newPage();
      await page.setViewport(viewport);

      page.on("console", (msg) => {
        if (msg.type() === "error") problems.push(`[${name}] console: ${msg.text()}`);
      });
      page.on("pageerror", (err) => problems.push(`[${name}] pageerror: ${err.message}`));

      for (const route of routes) {
        const url = `${BASE}${route}${route.includes("?") ? "&" : "?"}${DEMO_QUERY}`;
        /*
          `networkidle0` is unusable against the dev server: Vite holds an HMR
          websocket open, so the connection count never reaches zero and the
          navigation hangs until timeout. Wait for the app to actually render
          its <h1> instead, which is the condition that matters here.
        */
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForSelector("h1", { timeout: 20_000 });
        // Let fonts settle so text is not measured mid-swap.
        await page.evaluate(() => document.fonts.ready);
        await new Promise((r) => setTimeout(r, 400));

        /*
         * The filename has to be a filesystem-safe slug, and the route is not.
         * A query string became part of the path and `writeFile` failed with
         * ENOENT, because `?` is a wildcard in a path; a mistyped argument
         * containing a backslash fails the same way on Windows. Everything
         * outside `[a-z0-9]` is folded to `-`, so no route can break this.
         */
        const slug =
          route === "/"
            ? "home"
            : (route.split(/[?#]/)[0].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
              "home") + (route.includes("?") ? "-q" : "");
        const file = path.join(OUT, `${slug}-${name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        console.log(`  ✓ ${path.relative(root, file)}`);

        /*
          Layout smoke checks. These catch the failure modes a screenshot hides:
          horizontal overflow, and text that has collided with its neighbour.
        */
        const audit = await page.evaluate(() => {
          const doc = document.documentElement;
          const overflow = doc.scrollWidth - doc.clientWidth;

          const h1 = document.querySelector("h1");
          const h1Box = h1?.getBoundingClientRect();

          // Any element wider than the viewport is a horizontal-overflow bug.
          const wide = [...document.querySelectorAll("body *")]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > doc.clientWidth + 2 && r.height > 0;
            })
            .slice(0, 5)
            .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}`);

          return {
            overflow,
            h1Lines: h1Box ? Math.round(h1Box.height / parseFloat(getComputedStyle(h1).lineHeight)) : 0,
            h1Text: h1?.textContent?.trim().slice(0, 60) ?? null,
            wide,
            dir: doc.dir,
            lang: doc.lang,
            title: document.title,
          };
        });

        if (audit.overflow > 2) {
          problems.push(`[${name}] ${route}: horizontal overflow ${audit.overflow}px`);
        }
        if (audit.wide.length) {
          problems.push(`[${name}] ${route}: elements wider than viewport → ${audit.wide.join(", ")}`);
        }
        if (audit.h1Lines > 4) {
          problems.push(`[${name}] ${route}: h1 wraps to ${audit.h1Lines} lines`);
        }
        console.log(
          `      dir=${audit.dir} lang=${audit.lang} h1=${audit.h1Lines} lines, overflow=${audit.overflow}px`,
        );
      }

      await page.close();
    }
  } finally {
    await browser.close();
    await (server.httpServer ? server.httpServer.close() : server.close());
  }

  if (problems.length) {
    console.log("\nLayout problems:");
    for (const problem of problems) console.log(`  ✗ ${problem}`);
    process.exitCode = 1;
  } else {
    console.log("\nNo layout problems detected.");
  }
}

main()
  .then(() => {
    clearTimeout(watchdog);
    // Vite's dev server keeps its HMR socket open; exit rather than wait.
    process.exit(process.exitCode ?? 0);
  })
  .catch((err) => {
    clearTimeout(watchdog);
    console.error(err);
    process.exit(1);
  });
