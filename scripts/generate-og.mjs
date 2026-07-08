/**
 * Generates the landing-page social-preview image (og.png, 1200×630) from the
 * Hamesh margin mark on a paper background with a margin-rule motif. No deps —
 * supersampled rasterizer + zlib PNG encoder (shared approach with icons).
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'landing', 'assets');
mkdirSync(OUT, { recursive: true });

const W = 1200;
const H = 630;
const PAPER = { r: 0xf7, g: 0xf3, b: 0xec };
const CLAY = { r: 0xb5, g: 0x50, b: 0x2f };
const INK20 = { r: 0xd8, g: 0xd2, b: 0xc6 }; // faint rule

// Mark strokes, scaled/placed into the 1200×630 canvas.
const MARK_VB = 32;
const markScale = 300 / MARK_VB; // ~300px tall mark
const markX = 150;
const markY = H / 2 - (MARK_VB * markScale) / 2;
const markStrokes = [
  [10, 5, 10, 27],
  [10, 14, 20, 14],
  [20, 10.5, 20, 17.5],
].map(([ax, ay, bx, by]) => [
  markX + ax * markScale,
  markY + ay * markScale,
  markX + bx * markScale,
  markY + by * markScale,
]);
const markHalf = (3 * markScale) / 2;

// Vertical margin rule down the right portion (the "margin" motif).
const ruleX = 760;

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function sample(x, y) {
  for (const [ax, ay, bx, by] of markStrokes) {
    if (distSeg(x, y, ax, ay, bx, by) <= markHalf) return CLAY;
  }
  if (Math.abs(x - ruleX) <= 1 && y > 150 && y < H - 150) return INK20;
  return null;
}

const ss = 3;
const data = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let rAcc = 0,
      gAcc = 0,
      bAcc = 0;
    for (let sy = 0; sy < ss; sy++) {
      for (let sx = 0; sx < ss; sx++) {
        const c = sample(x + (sx + 0.5) / ss, y + (sy + 0.5) / ss) ?? PAPER;
        rAcc += c.r;
        gAcc += c.g;
        bAcc += c.b;
      }
    }
    const n = ss * ss;
    const i = (y * W + x) * 4;
    data[i] = Math.round(rAcc / n);
    data[i + 1] = Math.round(gAcc / n);
    data[i + 2] = Math.round(bAcc / n);
    data[i + 3] = 255;
  }
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, d) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(d.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, d])), 0);
  return Buffer.concat([len, t, d, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const stride = W * 4;
const raw = Buffer.alloc((stride + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (stride + 1)] = 0;
  data.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(resolve(OUT, 'og.png'), png);
console.log(`landing/assets/og.png (${png.length} bytes)`);
