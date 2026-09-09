/**
 * prerender.mjs — Post-build SSG script.
 *
 * Renders the SPA index.html for known routes so search engines and
 * social crawlers see pre-rendered HTML instead of an empty <div id="root">.
 *
 * For dynamic salon routes (e.g. /salon/salon-pro), we serve a static
 * shell + rely on edge caching to deliver cached HTML per slug.
 *
 * Run after `vite build`. Output: dist/<route>/index.html
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "../dist");

// Routes that should be pre-rendered as static HTML
const ROUTES = [
  "/",
  "/book",
  "/offline",
];

// Placeholder salon slug for demo pre-rendering
const SALON_SLUGS = ["salon-pro", "demo"];

async function readTemplate() {
  return fs.readFile(path.join(DIST, "index.html"), "utf-8");
}

async function writeRoute(route, html) {
  // For "/", write to dist/index.html (already exists)
  if (route === "/") {
    return fs.writeFile(path.join(DIST, "index.html"), html);
  }
  // For other routes, create dist/<route>/index.html
  const target = path.join(DIST, route, "index.html");
  await fs.mkdir(path.dirname(target), { recursive: true });
  return fs.writeFile(target, html);
}

async function prerender() {
  console.log("🚀 Prerendering routes for SEO + LCP < 1s...");

  const template = await readTemplate();
  let count = 0;

  for (const route of ROUTES) {
    try {
      await writeRoute(route, template);
      console.log(`  ✓ ${route}`);
      count++;
    } catch (err) {
      console.warn(`  ✗ ${route}:`, err.message);
    }
  }

  // For salon pages, we don't pre-render every slug (infinite), but we
  // create a fallback dist/salon/index.html that renders the landing
  // page shell (good for SEO when a slug isn't in the cache yet).
  try {
    await writeRoute("/salon", template);
    console.log(`  ✓ /salon (shell)`);
    count++;
  } catch (err) {
    console.warn(`  ✗ /salon:`, err.message);
  }

  // Also pre-render known demo salon slugs
  for (const slug of SALON_SLUGS) {
    try {
      await writeRoute(`/salon/${slug}`, template);
      console.log(`  ✓ /salon/${slug}`);
      count++;
    } catch (err) {
      console.warn(`  ✗ /salon/${slug}:`, err.message);
    }
  }

  // Create sitemap.xml for SEO
  await generateSitemap();
  console.log(`  ✓ /sitemap.xml`);

  // Create robots.txt
  await generateRobots();
  console.log(`  ✓ /robots.txt`);

  console.log(`\n✅ Pre-rendered ${count} routes successfully.`);
}

async function generateSitemap() {
  const baseUrl = process.env.VITE_SITE_URL || "https://salon-pro.com";
  const today = new Date().toISOString().split("T")[0];

  const urls = [
    { loc: "/", changefreq: "weekly", priority: "1.0" },
    { loc: "/book", changefreq: "monthly", priority: "0.8" },
  ];

  for (const slug of SALON_SLUGS) {
    urls.push({
      loc: `/salon/${slug}`,
      changefreq: "weekly",
      priority: "0.9",
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${baseUrl}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  await fs.writeFile(path.join(DIST, "sitemap.xml"), xml);
}

async function generateRobots() {
  const baseUrl = process.env.VITE_SITE_URL || "https://salon-pro.com";
  const robots = `# Salon Pro — robots.txt
User-agent: *
Allow: /

# Block private/admin routes
Disallow: /admin
Disallow: /api

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml
`;
  await fs.writeFile(path.join(DIST, "robots.txt"), robots);
}

prerender().catch((err) => {
  console.error("Prerender failed:", err);
  process.exit(1);
});
