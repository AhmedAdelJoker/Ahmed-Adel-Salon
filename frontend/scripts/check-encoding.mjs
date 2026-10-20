import { readFileSync } from "node:fs";

const targets = [
  "src/app/route-registry.tsx",
  "src/components/layout/Sidebar.tsx",
  "src/components/layout/Header.tsx",
  "src/pages/common/Login.tsx",
  "src/styles/legacy.css",
  "src/styles/tokens.css",
];

for (const file of targets) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    console.log(`${file}: MISSING`);
    continue;
  }
  const replacement = (text.match(/�/g) ?? []).length;
  const arabic = (text.match(/[؀-ۿ]/g) ?? []).length;
  // A control char or lone surrogate usually means the file was written with
  // the wrong code page rather than genuinely containing replacement chars.
  const suspicious = (text.match(/[\u0080-￿]/g) ?? []).length;
  console.log(
    `${file.padEnd(38)} U+FFFD=${String(replacement).padStart(4)}  arabic=${String(arabic).padStart(5)}  high-chars=${String(suspicious).padStart(5)}`,
  );
}

console.log("\n--- first mojibake site in route-registry ---");
const reg = readFileSync("src/app/route-registry.tsx", "utf8");
const at = reg.indexOf("�");
if (at === -1) {
  console.log("none — the earlier console output was a PowerShell rendering artefact");
} else {
  console.log(JSON.stringify(reg.slice(Math.max(0, at - 90), at + 90)));
}
