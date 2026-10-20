const fs = require("fs");
const p = "public-site/src/pages/LandingPage.tsx";
const lines = fs.readFileSync(p, "utf8").split("\n");
const target = '  const content = useMemo(() => buildLandingSiteContent(settings), [settings]);';
const idx = lines.findIndex((l) => l.includes(target));
lines.splice(
  idx + 1,
  0,
  '  console.log("DEBUG content.portfolio:", content?.portfolio);',
  '  console.log("DEBUG settings keys:", Object.keys(settings).filter((k) => k.toLowerCase().includes("portfolio")));',
);
fs.writeFileSync(p, lines.join("\n"));
console.log("patched at line", idx + 1);