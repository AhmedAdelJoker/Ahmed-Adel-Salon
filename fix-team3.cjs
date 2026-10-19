const fs = require("fs");
const p = "public-site/src/components/landing/TeamSection.tsx";
let s = fs.readFileSync(p, "utf8");
s = s.replace('className="text-lg font-bold leading-7" style={{ color: theme.text }}', 'className="mk-member-name" style={{ color: theme.text }}');
fs.writeFileSync(p, s);
console.log("done");