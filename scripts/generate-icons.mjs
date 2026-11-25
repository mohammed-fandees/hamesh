/**
 * Generates Hamesh extension icons from the "margin mark" glyph.
 *
 * No external dependencies: rasterizes the glyph with 4x supersampled
 * anti-aliasing and encodes PNG using Node's built-in zlib.
 *
 * The glyph is the brand mark from the approved Hamesh design system:
 * a full-height vertical rule with a short tick reaching off it.
 * viewBox 0 0 32 32, stroke-width 3, round caps.
 *
 * The extension's own icons are the store icon's clay tile with the mark in
 * paper (docs/chrome-web-store/source/store-icon.html), so what someone installs
 * looks like what they saw in the store. The landing's favicons stay the bare
 * mark.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'icon');
const LANDING_DIR = resolve(__dirname, '..', 'landing', 'assets');
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(LANDING_DIR, { recursive: true });

// Margin-mark strokes in the 32x32 viewBox.
const STROKES = [
  [10, 5, 10, 27], // vertical rule
  [10, 14, 20, 14], // tick
  [20, 10.5, 20, 17.5], // end vertical
];
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** How far (x, y) is inside a rounded square, in [0,1], from a signed distance. */
function insideRoundedSquare(x, y, from, to, radius) {
  const qx = Math.abs(x - (from + to) / 2) - ((to - from) / 2 - radius);
  const qy = Math.abs(y - (from + to) / 2) - ((to - from) / 2 - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius <= 0;
}

// The store icon's own numbers, per pixel of a 96px tile.
const TILE_RADIUS = 22 / 96;
const MARK_SCALE = 2.6 / 96;
const TILE_TOP = { r: 0xbf, g: 0x58, b: 0x33 };
const TILE_BOTTOM = { r: 0xa9, g: 0x49, b: 0x2a };
const PAPER = { r: 0xf7, g: 0xf3, b: 0xec };

/**
 * The clay tile with the mark on it.
 *
 * `padding` is the clear edge around the tile, in pixels. Chrome's guidelines
 * ask for it on the large icons, where the browser draws them as artwork; on the
 * toolbar's small ones every pixel of padding is a pixel the mark can't use, so
 * those fill the canvas.
 */
function renderTile(size, { padding, strokeWidth = 3.4 }) {
  const ss = 4;
  const tile = size - padding * 2;
  const markScale = tile * MARK_SCALE;
  const half = strokeWidth / 2;
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let tileHits = 0;
      let markHits = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;
          if (!insideRoundedSquare(px, py, padding, size - padding, tile * TILE_RADIUS)) continue;
          tileHits += 1;
          // The mark's box (x 10–20, y 5–27, centre 15,16) on the tile's centre.
          const vx = (px - size / 2) / markScale + 15;
          const vy = (py - size / 2) / markScale + 16;
          if (STROKES.some(([ax, ay, bx, by]) => distToSegment(vx, vy, ax, ay, bx, by) <= half)) {
            markHits += 1;
          }
        }
      }
      if (tileHits === 0) continue;
      const fall = Math.max(0, Math.min(1, (y + 0.5 - padding) / tile));
      const paper = markHits / tileHits;
      const i = (y * size + x) * 4;
      for (const [offset, channel] of [
        [0, 'r'],
        [1, 'g'],
        [2, 'b'],
      ]) {
        const clay = TILE_TOP[channel] + (TILE_BOTTOM[channel] - TILE_TOP[channel]) * fall;
        data[i + offset] = Math.round(clay + (PAPER[channel] - clay) * paper);
      }
      data[i + 3] = Math.round((tileHits / (ss * ss)) * 255);
    }
  }
  return encodePng(size, size, data);
}

/**
 * An .ico wrapping PNG payloads — allowed since Vista and understood by every
 * browser that still asks for `favicon.ico` at all. It exists for the
 * requests that bypass the document entirely (a bare hit to /favicon.ico,
 * bookmark bars, some feed readers); modern browsers take the SVG below.
 */
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // 0 means 256
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // palette size
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rows with filter byte 0
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 128 and 96 keep the guidelines' one-eighth of padding; the smaller the icon,
// the less of it can be spared, and the heavier the mark has to be to survive.
const SIZES = [
  { size: 16, padding: 0, strokeWidth: 4.2 },
  { size: 32, padding: 1, strokeWidth: 3.8 },
  { size: 48, padding: 3 },
  { size: 96, padding: 12 },
  { size: 128, padding: 16 },
];
for (const { size, ...tile } of SIZES) {
  const png = renderTile(size, tile);
  writeFileSync(resolve(OUT_DIR, `${size}.png`), png);
  console.log(`icon/${size}.png (${png.length} bytes)`);
}

/* ---- The landing page's favicons --------------------------------------
 *
 * Generated from the same glyph as the extension's icons rather than drawn
 * by hand, so the tab, the toolbar and the store listing cannot drift apart.
 */

// The scalable one, which is what every current browser actually uses: the
// store icon's own clay tile with the mark in paper, so the tab shows what
// the toolbar and the store show. The tile carries its own ground, so it
// reads on a light tab strip and a dark one alike.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="clay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#BF5833" />
      <stop offset="1" stop-color="#A9492A" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7.3" fill="url(#clay)" />
  <g transform="translate(3 2.133) scale(0.8667)" fill="none" stroke="#F7F3EC" stroke-width="3.8" stroke-linecap="round">
    <path d="M10 5V27" />
    <path d="M10 14H20" />
    <path d="M20 10.5V17.5" />
  </g>
</svg>
`;
writeFileSync(resolve(LANDING_DIR, 'favicon.svg'), faviconSvg);
console.log(`landing/assets/favicon.svg (${faviconSvg.length} bytes)`);

// The same tiles the toolbar uses at these sizes, so the tab and the toolbar
// draw one icon.
const ico = encodeIco(
  SIZES.filter(({ size }) => size <= 48).map(({ size, ...tile }) => ({
    size,
    png: renderTile(size, tile),
  })),
);
writeFileSync(resolve(LANDING_DIR, 'favicon.ico'), ico);
console.log(`landing/assets/favicon.ico (${ico.length} bytes)`);

// Browsers and crawlers request `/favicon.ico` without reading the document,
// so a copy sits at the page's own directory root for that path to resolve.
writeFileSync(resolve(__dirname, '..', 'landing', 'favicon.ico'), ico);
console.log(`landing/favicon.ico (${ico.length} bytes)`);

// The tile to the edge: iOS rounds the corners itself.
const apple = renderTile(180, { padding: 0 });
writeFileSync(resolve(LANDING_DIR, 'apple-touch-icon.png'), apple);
console.log(`landing/assets/apple-touch-icon.png (${apple.length} bytes)`);
