/**
 * generate-assets.mjs — builds the brand raster assets with zero dependencies.
 *
 * Why this exists: the site referenced /og-image.jpg and /favicon.ico for its
 * Open Graph card and PWA icons, but no such files were ever committed. Social
 * shares rendered without an image and Android Chrome refused to offer the
 * install prompt (a PWA needs a 192px and a 512px icon, an .ico does not count).
 *
 * Everything is rasterised from signed-distance fields, so the output is crisp
 * at any size and needs neither sharp, canvas nor a headless browser.
 *
 * Output (into public/, which Vite copies verbatim into dist/):
 *   public/og-image.png             1200x630  Open Graph / Twitter card
 *   public/icon-192.png              192x192  PWA icon (any)
 *   public/icon-512.png              512x512  PWA icon (any)
 *   public/icon-maskable-512.png     512x512  PWA icon (maskable, 80% safe zone)
 *   public/apple-touch-icon.png      180x180  iOS home screen
 *
 * Run via `npm run assets` (also wired into `prebuild`).
 */

import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "../public");

/* ── brand palette ──────────────────────────────────────────────────────── */
const INK = [0x09, 0x09, 0x0b];
const INK_LIFT = [0x14, 0x14, 0x1c];
const GOLD = [0xd4, 0xaf, 0x37];
const GOLD_DEEP = [0xb0, 0x8d, 0x26];
const CREAM = [0xfa, 0xfa, 0xf7];
const SLATE = [0x8b, 0x8b, 0x99];

/* ── a minimal 5x7 uppercase face, enough for the wordmark ───────────────── */
const GLYPHS = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#..##", "#...#", "#...#", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

/* ── signed distance fields ─────────────────────────────────────────────── */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Antialiased coverage for a distance value: <0 inside, >0 outside. */
const cover = (d) => clamp01(0.5 - d);

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function sdRing(px, py, cx, cy, r, thickness) {
  return Math.abs(Math.hypot(px - cx, py - cy) - r) - thickness / 2;
}

function sdSegment(px, py, ax, ay, bx, by, thickness) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : clamp01((wx * vx + wy * vy) / len2);
  return Math.hypot(wx - vx * t, wy - vy * t) - thickness / 2;
}

function sdRoundRect(px, py, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(px - cx) - (halfW - radius);
  const qy = Math.abs(py - cy) - (halfH - radius);
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    radius
  );
}

/* ── a float RGB canvas ─────────────────────────────────────────────────── */
class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Float64Array(width * height * 3);
  }

  blend(x, y, color, alpha) {
    if (alpha <= 0) return;
    const i = (y * this.width + x) * 3;
    const a = alpha > 1 ? 1 : alpha;
    this.data[i] += (color[0] - this.data[i]) * a;
    this.data[i + 1] += (color[1] - this.data[i + 1]) * a;
    this.data[i + 2] += (color[2] - this.data[i + 2]) * a;
  }

  /** Fill wherever `sdf(x, y) < 0`, antialiased over ~1px. */
  fill(sdf, color, alpha = 1) {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        this.blend(x, y, color, cover(sdf(x + 0.5, y + 0.5)) * alpha);
      }
    }
  }

  /** Vertical gradient across the whole canvas. */
  gradientV(from, to) {
    for (let y = 0; y < this.height; y += 1) {
      const t = y / (this.height - 1);
      const r = from[0] + (to[0] - from[0]) * t;
      const g = from[1] + (to[1] - from[1]) * t;
      const b = from[2] + (to[2] - from[2]) * t;
      for (let x = 0; x < this.width; x += 1) {
        const i = (y * this.width + x) * 3;
        this.data[i] = r;
        this.data[i + 1] = g;
        this.data[i + 2] = b;
      }
    }
  }

  /** Soft radial bloom, used sparingly behind the mark. */
  bloom(cx, cy, radius, color, strength) {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / radius;
        if (d >= 1) continue;
        const falloff = (1 - d) ** 2;
        this.blend(x, y, color, falloff * strength);
      }
    }
  }

  /** Draw uppercase text from the built-in 5x7 face. */
  text(str, x, y, scale, color, alpha = 1, tracking = 1) {
    const advance = (5 + tracking) * scale;
    let cursor = x;
    for (const raw of str.toUpperCase()) {
      const glyph = GLYPHS[raw] ?? GLYPHS[" "];
      for (let row = 0; row < 7; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          if (glyph[row][col] !== "#") continue;
          const px = cursor + col * scale;
          const py = y + row * scale;
          for (let sy = 0; sy < scale; sy += 1) {
            for (let sx = 0; sx < scale; sx += 1) {
              this.blend(Math.round(px + sx), Math.round(py + sy), color, alpha);
            }
          }
        }
      }
      cursor += advance;
    }
    return cursor - x - tracking * scale;
  }

  textWidth(str, scale, tracking = 1) {
    return str.length * (5 + tracking) * scale - tracking * scale;
  }
}

/* ── the mark: a pair of scissors, drawn from rings and tapered blades ──── */
function drawScissors(canvas, cx, cy, size, color, alpha = 1) {
  const u = size; // one unit == the full mark height
  const P = (x, y) => [cx + (x - 0.5) * u, cy + (y - 0.5) * u];
  const ring = u * 0.052;
  const blade = u * 0.062;

  // handle rings (annuli, so they read as finger holes)
  for (const hx of [0.235, 0.765]) {
    const [rx, ry] = P(hx, 0.735);
    canvas.fill((x, y) => sdRing(x, y, rx, ry, u * 0.105, ring), color, alpha);
  }

  // arms from the pivot down to each handle
  for (const [hx, topX] of [
    [0.235, 0.44],
    [0.765, 0.56],
  ]) {
    const [ax, ay] = P(topX, 0.5);
    const [bx, by] = P(hx, 0.66);
    canvas.fill((x, y) => sdSegment(x, y, ax, ay, bx, by, ring * 0.92), color, alpha);
  }

  // blades crossing at the pivot
  const [p0x, p0y] = P(0.5, 0.47);
  const [b1x, b1y] = P(0.86, 0.145);
  const [b2x, b2y] = P(0.14, 0.145);
  canvas.fill((x, y) => sdSegment(x, y, p0x, p0y, b1x, b1y, blade), color, alpha);
  canvas.fill((x, y) => sdSegment(x, y, p0x, p0y, b2x, b2y, blade), color, alpha);

  // pivot pin
  canvas.fill((x, y) => sdCircle(x, y, p0x, p0y, u * 0.052), color, alpha);
}

/* ── PNG encoding ───────────────────────────────────────────────────────── */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(canvas) {
  const { width, height, data } = canvas;
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < width; x += 1) {
      const s = (y * width + x) * 3;
      const d = y * (stride + 1) + 1 + x * 3;
      raw[d] = Math.round(Math.min(255, Math.max(0, data[s])));
      raw[d + 1] = Math.round(Math.min(255, Math.max(0, data[s + 1])));
      raw[d + 2] = Math.round(Math.min(255, Math.max(0, data[s + 2])));
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── the individual assets ──────────────────────────────────────────────── */
function buildOgImage() {
  const c = new Canvas(1200, 630);
  c.gradientV(INK, INK_LIFT);
  c.bloom(940, 300, 520, GOLD, 0.16);

  // gold hairline frame
  c.fill(
    (x, y) => sdRoundRect(x, y, 600, 315, 600 - 26, 315 - 26, 18),
    GOLD,
    0,
  );
  for (let i = 0; i < 3; i += 1) {
    const inset = 26 + i * 2;
    c.fill(
      (x, y) =>
        Math.abs(sdRoundRect(x, y, 600, 315, 600 - inset, 315 - inset, 18 + i)) - 0.9,
      GOLD,
      0.5 - i * 0.12,
    );
  }

  // mark, in a gold ring
  const markX = 930;
  const markY = 315;
  c.fill((x, y) => sdRing(x, y, markX, markY, 132, 3), GOLD, 0.55);
  drawScissors(c, markX, markY, 176, GOLD, 1);

  // wordmark
  const leftX = 96;
  c.text("SALON PRO", leftX, 246, 11, CREAM, 1);
  c.fill((x, y) => sdRoundRect(x, y, leftX + 96, 372, 96, 2.5, 2.5), GOLD, 1);
  c.text("MANAGEMENT SYSTEM", leftX, 404, 4, GOLD, 0.95);
  c.text("BOOK ONLINE 24/7", leftX, 452, 3, SLATE, 1);

  // corner ticks
  for (const [cx, cy] of [
    [26, 26],
    [1174, 26],
    [26, 604],
    [1174, 604],
  ]) {
    c.fill((x, y) => sdCircle(x, y, cx, cy, 4), GOLD, 0.8);
  }

  return c;
}

function buildIcon(size, { maskable = false } = {}) {
  const c = new Canvas(size, size);
  c.gradientV(INK, INK_LIFT);

  if (!maskable) {
    // rounded plate so the icon reads well in a browser tab strip
    const r = size * 0.22;
    c.fill(
      (x, y) =>
        Math.abs(
          sdRoundRect(x, y, size / 2, size / 2, size / 2 - 1, size / 2 - 1, r),
        ) - Math.max(1, size / 128),
      GOLD,
      0.85,
    );
  }

  // maskable icons must keep their content inside the middle 80%
  const markSize = size * (maskable ? 0.5 : 0.62);
  drawScissors(c, size / 2, size / 2, markSize, GOLD, 1);

  if (!maskable) {
    c.fill((x, y) => sdRing(x, y, size / 2, size / 2, size * 0.41, Math.max(1.5, size / 90)), GOLD, 0.5);
  }

  return c;
}

/* ── an ASCII preview, so the wordmark can be eyeballed without a browser ─ */
function preview(canvas, cols = 96) {
  const rows = Math.max(1, Math.round((canvas.height / canvas.width) * cols * 0.5));
  const ramp = " .:-=+*#%@";
  const lines = [];
  for (let r = 0; r < rows; r += 1) {
    let line = "";
    for (let cIdx = 0; cIdx < cols; cIdx += 1) {
      const x = Math.floor((cIdx / cols) * canvas.width);
      const y = Math.floor((r / rows) * canvas.height);
      const i = (y * canvas.width + x) * 3;
      const lum =
        (canvas.data[i] * 0.299 + canvas.data[i + 1] * 0.587 + canvas.data[i + 2] * 0.114) /
        255;
      line += ramp[Math.min(ramp.length - 1, Math.floor(lum * ramp.length))];
    }
    lines.push(line);
  }
  return lines.join("\n");
}

/* ── main ───────────────────────────────────────────────────────────────── */
const TARGETS = [
  { file: "og-image.png", build: () => buildOgImage() },
  { file: "icon-192.png", build: () => buildIcon(192) },
  { file: "icon-512.png", build: () => buildIcon(512) },
  { file: "icon-maskable-512.png", build: () => buildIcon(512, { maskable: true }) },
  { file: "apple-touch-icon.png", build: () => buildIcon(180) },
];

async function main() {
  await fs.mkdir(PUBLIC_DIR, { recursive: true });

  for (const target of TARGETS) {
    const canvas = target.build();
    const png = encodePng(canvas);
    await fs.writeFile(path.join(PUBLIC_DIR, target.file), png);
    const kb = (png.length / 1024).toFixed(1);
    console.log(`  ✓ ${target.file.padEnd(26)} ${canvas.width}x${canvas.height}  ${kb} kB`);
  }

  if (process.env.ASSET_PREVIEW === "1") {
    console.log("\n" + preview(buildOgImage()));
  }
}

main().catch((err) => {
  console.error("Asset generation failed:", err);
  process.exit(1);
});
