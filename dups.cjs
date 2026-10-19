const fs = require("fs");
const p = "public-site/src/lib/i18n.ts";
const lines = fs.readFileSync(p, "utf8").split("\n");

// Split the file into the two catalogue objects (ar and en) so a key that is
// legitimately in both is not reported as a duplicate.
let boundary = lines.findIndex((l) => /^const en\b/.test(l));
const buckets = [
  { name: "ar", start: 0, end: boundary },
  { name: "en", start: boundary, end: lines.length },
];

for (const b of buckets) {
  const seen = new Map();
  for (let i = b.start; i < b.end; i++) {
    const m = /^\s*"([^"]+)":/.exec(lines[i]);
    if (!m) continue;
    const k = m[1];
    if (seen.has(k)) {
      console.log(`${b.name} duplicate "${k}" at line ${i + 1} (first at ${seen.get(k) + 1})`);
    } else {
      seen.set(k, i);
    }
  }
}