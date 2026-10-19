const fs = require("fs");
const p = "public-site/src/components/landing/TeamSection.tsx";
let s = fs.readFileSync(p, "utf8");

const r = [
  ['className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-5 text-sm font-bold transition hover:bg-accent-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"', 'className="mk-btn mk-btn-ghost mk-btn-sm mt-5 w-full"'],
  ['className="mt-1.5 flex items-center gap-2 text-xs font-bold"', 'className="mk-member-role"'],
  ['className="mt-4 text-sm font-bold leading-7"', 'className="mk-member-bio"'],
  ['className="text-lg font-bold leading-7"', 'className="mk-member-name"'],
];

for (const [a, b] of r) {
  if (s.includes(a)) {
    s = s.replace(a, b);
    console.log("ok:", a.slice(0, 40));
  } else {
    console.log("MISS:", a.slice(0, 40));
  }
}

fs.writeFileSync(p, s);