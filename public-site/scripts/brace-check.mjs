/**
 * brace-check.mjs — find where JSX/JS braces stop balancing.
 *
 * Line-index edits across a 700-line JSX file eventually remove one brace too
 * many, and the TypeScript error points at the *end* of the file, which is
 * useless. This strips strings, template literals and comments, then reports
 * the running depth so the first line that stops matching is obvious.
 */
import fs from "node:fs";

const file = process.argv[2];
const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

let depth = 0;
const openStack = [];
const problems = [];

/**
 * Context stack rather than a counter.
 *
 * A `${...}` interpolation inside a template literal is real code and its
 * braces must be counted, but the *outer* backtick must still close the
 * literal. A single "am I in a template" flag cannot express that — it either
 * ignores the braces in the interpolation or loses track of the literal's end.
 * Pushing a marker for the interpolation and popping back to it on `}` does.
 */
const ctx = []; // 'code' | 'template' | 'interp'

for (let i = 0; i < lines.length; i += 1) {
  const raw = lines[i];
  let quote = null;
  const before = depth;
  const top = () => ctx[ctx.length - 1];

  for (let j = 0; j < raw.length; j += 1) {
    const ch = raw[j];

    if (quote) {
      if (ch === "\\") { j += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }

    if (top() === "template") {
      if (ch === "\\") { j += 1; continue; }
      if (ch === "`") { ctx.pop(); continue; }
      if (ch === "$" && raw[j + 1] === "{") { ctx.push("interp"); depth += 1; openStack.push(i + 1); j += 1; }
      continue;
    }

    if (ch === "/" && raw[j + 1] === "/") break;
    if (ch === "/" && raw[j + 1] === "*") {
      const end = raw.indexOf("*/", j + 2);
      if (end === -1) break;
      j = end + 1;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; continue; }
    if (ch === "`") { ctx.push("template"); continue; }
    if (ch === "{") { depth += 1; openStack.push(i + 1); continue; }
    if (ch === "}") {
      if (top() === "interp") { ctx.pop(); depth -= 1; openStack.pop(); continue; }
      depth -= 1;
      if (depth < 0) problems.push(`line ${i + 1}: unmatched }`);
      openStack.pop();
    }
  }

  if (depth < before - 3) {
    problems.push(`line ${i + 1}: depth drops ${before} → ${depth} (possible missing closer)`);
  }
  if (process.env.TRACE && i + 1 >= Number(process.env.TRACE_FROM) && i + 1 <= Number(process.env.TRACE_TO)) {
    console.log(`${String(i + 1).padStart(4)} d=${before}→${depth}  ${raw.trim().slice(0, 62)}`);
  }
}

console.log(`final depth: ${depth} (0 = balanced)`);
if (openStack.length) console.log(`unclosed { opened at lines: ${openStack.slice(0, 10).join(", ")}`);
for (const problem of problems.slice(0, 20)) console.log(`  ${problem}`);
