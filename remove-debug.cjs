const fs = require("fs");
const p = "public-site/src/pages/LandingPage.tsx";
const lines = fs.readFileSync(p, "utf8").split("\n");
const idx = lines.findIndex((l) => l.includes("DEBUG content.portfolio"));
if (idx >= 0) {
  lines.splice(idx, 2);
  fs.writeFileSync(p, lines.join("\n"));
  console.log("removed debug lines at", idx + 1);
} else {
  console.log("nothing to remove");
}