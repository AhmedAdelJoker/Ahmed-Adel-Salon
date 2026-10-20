/** Ad-hoc inspection of the route registry. */
import { readFileSync } from "node:fs";

const file = "src/app/route-registry.tsx";
const text = readFileSync(file, "utf8");

const paths = [...text.matchAll(/\n\s*path:\s*"([^"]+)"/g)].map((m) => m[1]);

console.log("routes in registry:", paths.length);

const seen = new Map();
for (const p of paths) seen.set(p, (seen.get(p) ?? 0) + 1);
const dupes = [...seen].filter(([, n]) => n > 1);
console.log("duplicates:", dupes.length ? dupes : "none");

const at = paths.indexOf("/appearance");
console.log("/appearance present:", at !== -1, "at index", at);
if (at !== -1) {
  console.log("neighbours:", paths.slice(Math.max(0, at - 2), at + 3));
}

const paramRoutes = paths.filter((p) => p.includes(":") || p.includes("*"));
console.log("param/catchall routes:", paramRoutes);

// Anything that could shadow a single-segment path before /appearance.
const shadowing = paths.filter(
  (p) => p.includes(":") && p.split("/").filter(Boolean).length === 1,
);
console.log("single-segment param routes (shadow risk):", shadowing);
