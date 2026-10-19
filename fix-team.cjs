const fs = require("fs");
const p = "public-site/src/components/landing/TeamSection.tsx";
let s = fs.readFileSync(p, "utf8");

const replacements = [
  ['className="mx-auto w-full max-w-7xl px-4 py-[length:var(--section-y)] sm:px-6 lg:px-8"', 'className="mk-shell py-[length:var(--section-y)]"'],
  ['className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"', 'className="mk-team-grid"'],
  ['className="group h-full overflow-hidden rounded-[var(--r-xl)] border transition duration-500"', 'className="group mk-member transition duration-500"'],
  ['className="p-6"', 'className="mk-member-info"'],
];

for (const [from, to] of replacements) {
  if (s.includes(from)) {
    s = s.replace(from, to);
    console.log("replaced:", from.slice(0, 40));
  } else {
    console.log("NOT FOUND:", from.slice(0, 40));
  }
}

fs.writeFileSync(p, s);