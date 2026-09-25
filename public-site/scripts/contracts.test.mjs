import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

async function read(relativePath) {
  return fs.readFile(path.join(dist, relativePath), "utf8");
}

test("emits all public entry points", async () => {
  const requiredFiles = [
    "index.html",
    "book/index.html",
    "offline/index.html",
    "salon/index.html",
    "salon/salon-pro/index.html",
    "salon/demo/index.html",
    "sitemap.xml",
    "robots.txt",
  ];

  for (const relativePath of requiredFiles) {
    await fs.access(path.join(dist, relativePath));
  }
});

test("keeps deployment security and routing contracts", async () => {
  const headers = await read("_headers");
  const redirects = await read("_redirects");

  for (const header of [
    "X-Frame-Options: DENY",
    "X-Content-Type-Options: nosniff",
    "Content-Security-Policy:",
    "Strict-Transport-Security:",
  ]) {
    assert.ok(headers.includes(header), `Missing deployment header: ${header}`);
  }

  assert.ok(redirects.includes("/salon/*  /index.html  200"));
  assert.ok(redirects.includes("/book      /index.html  200"));
});

test("uses the TypeScript entry point and API proxy", async () => {
  const sourceIndex = await fs.readFile(path.join(root, "index.html"), "utf8");
  const viteConfig = await fs.readFile(path.join(root, "vite.config.js"), "utf8");

  assert.ok(sourceIndex.includes("/src/main.tsx"));
  assert.ok(viteConfig.includes("'/api'"));
  assert.ok(viteConfig.includes("target: 'http://localhost:8000'"));
});

test("does not cache the service worker", async () => {
  const headers = await read("_headers");
  const serviceWorkerRules = headers.slice(headers.indexOf("/sw.js"));
  assert.ok(serviceWorkerRules.includes("Cache-Control: public, max-age=0, must-revalidate"));
});
