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
mkdirSync(OUT_DIR, { recursive: true });

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

function renderIcon(size) {
  const ss = 4; // supersample factor
  const scale = size / 32;
  const data = Buffer.alloc(size * size * 4); // RGBA
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const vx = (x + (sx + 0.5) / ss) / scale;
          const vy = (y + (sy + 0.5) / ss) / scale;
          acc += coverageAt(vx, vy);
        }
      }
      const alpha = Math.round((acc / (ss * ss)) * 255);
      const i = (y * size + x) * 4;
      data[i] = GLYPH.r;
      data[i + 1] = GLYPH.g;
      data[i + 2] = GLYPH.b;
      data[i + 3] = alpha;
    }
  }
  return encodePng(size, size, data);
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
