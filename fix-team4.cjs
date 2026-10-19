const fs = require("fs");
const p = "public-site/src/components/landing/TeamSection.tsx";
let s = fs.readFileSync(p, "utf8");
s = s.replace('className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold"', 'className="mk-availability"');
fs.writeFileSync(p, s);
console.log("done");