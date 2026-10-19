const fs = require("fs");
const p = "public-site/src/lib/i18n.ts";
const lines = fs.readFileSync(p, "utf8").split("\n");
const idx = lines.findIndex((l) => l.includes("landing.callUs"));
console.log("line", idx + 1, JSON.stringify(lines[idx]));
// Insert addressLabel and phoneLabel before callUs
lines.splice(idx, 0, '  "landing.addressLabel": "العنوان",', '  "landing.phoneLabel": "الهاتف / واتساب",');
fs.writeFileSync(p, lines.join("\n"));
console.log("done");