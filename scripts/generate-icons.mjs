/**
 * Generates Hamesh extension icons from the "margin mark" glyph.
 *
 * No external dependencies: rasterizes the glyph with 4x supersampled
 * anti-aliasing and encodes PNG using Node's built-in zlib.
 *
 * The glyph is the brand mark from the approved Hamesh design system:
 * a full-height vertical rule with a short tick reaching off it.
 * viewBox 0 0 32 32, stroke-width 3, round caps.
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
const STROKE_WIDTH = 3;

// Muted clay — legible on both light and dark toolbars.
const GLYPH = { r: 0xb5, g: 0x50, b: 0x2f };

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

/** Coverage in [0,1] of the glyph at a viewBox coordinate (supersampled). */
function coverageAt(vx, vy) {
  const half = STROKE_WIDTH / 2;
  let inside = false;
  for (const [ax, ay, bx, by] of STROKES) {
    if (distToSegment(vx, vy, ax, ay, bx, by) <= half) {
      inside = true;
      break;
    }
  }
  return inside ? 1 : 0;
}

/**
 * @param size    edge length in pixels
 * @param inset   fraction of the canvas to leave clear on each side
 * @param background  opaque backdrop, or null for transparency. Apple's home
 *                    screen composites onto white and squares the corners
 *                    itself, so that icon needs paper under the glyph rather
 *                    than an alpha channel.
 */
function renderIcon(size, { inset = 0, background = null } = {}) {
  const ss = 4; // supersample factor
  const pad = size * inset;
  const scale = (size - pad * 2) / 32;
  const data = Buffer.alloc(size * size * 4); // RGBA
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const vx = (x - pad + (sx + 0.5) / ss) / scale;
          const vy = (y - pad + (sy + 0.5) / ss) / scale;
          acc += coverageAt(vx, vy);
        }
      }
      const coverage = acc / (ss * ss);
      const i = (y * size + x) * 4;
      if (background) {
        // Composite the glyph over the backdrop rather than leaving alpha.
        data[i] = Math.round(background.r + (GLYPH.r - background.r) * coverage);
        data[i + 1] = Math.round(background.g + (GLYPH.g - background.g) * coverage);
        data[i + 2] = Math.round(background.b + (GLYPH.b - background.b) * coverage);
        data[i + 3] = 255;
      } else {
        data[i] = GLYPH.r;
        data[i + 1] = GLYPH.g;
        data[i + 2] = GLYPH.b;
        data[i + 3] = Math.round(coverage * 255);
      }
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

const SIZES = [16, 32, 48, 96, 128];
for (const size of SIZES) {
  const png = renderIcon(size);
  writeFileSync(resolve(OUT_DIR, `${size}.png`), png);
  console.log(`icon/${size}.png (${png.length} bytes)`);
}

/* ---- The landing page's favicons --------------------------------------
 *
 * Generated from the same glyph as the extension's icons rather than drawn
 * by hand, so the tab, the toolbar and the store listing cannot drift apart.
 */

// The scalable one, which is what every current browser actually uses. The
// media query keeps the mark legible on a dark tab strip: clay on paper is
// the brand, but clay alone disappears against near-black.
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>
    .glyph { stroke: #B5502F; }
    @media (prefers-color-scheme: dark) { .glyph { stroke: #E08B5C; } }
  </style>
  <g class="glyph" fill="none" stroke-width="3.4" stroke-linecap="round">
    <path d="M10 5V27" />
    <path d="M10 14H20" />
    <path d="M20 10.5V17.5" />
  </g>
</svg>
`;
writeFileSync(resolve(LANDING_DIR, 'favicon.svg'), faviconSvg);
console.log(`landing/assets/favicon.svg (${faviconSvg.length} bytes)`);

const ico = encodeIco([16, 32, 48].map((size) => ({ size, png: renderIcon(size) })));
writeFileSync(resolve(LANDING_DIR, 'favicon.ico'), ico);
console.log(`landing/assets/favicon.ico (${ico.length} bytes)`);

// Browsers and crawlers request `/favicon.ico` without reading the document,
// so a copy sits at the page's own directory root for that path to resolve.
writeFileSync(resolve(__dirname, '..', 'landing', 'favicon.ico'), ico);
console.log(`landing/favicon.ico (${ico.length} bytes)`);

// Paper behind the glyph, and inset so iOS's rounded mask does not clip it.
const apple = renderIcon(180, { inset: 0.2, background: { r: 0xf7, g: 0xf3, b: 0xec } });
writeFileSync(resolve(LANDING_DIR, 'apple-touch-icon.png'), apple);
console.log(`landing/assets/apple-touch-icon.png (${apple.length} bytes)`);
