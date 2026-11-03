import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The pixels of one of our own PNGs: 8-bit RGBA, every row unfiltered. */
function pixels(file: string) {
  const png = readFileSync(resolve(file));
  const size = png.readUInt32BE(16);
  const chunks: Buffer[] = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    if (png.toString('ascii', at + 4, at + 8) === 'IDAT') {
      chunks.push(png.subarray(at + 8, at + 8 + length));
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const at = (x: number, y: number) => {
    const i = y * (size * 4 + 1) + 1 + x * 4;
    return { r: raw[i], g: raw[i + 1], b: raw[i + 2], a: raw[i + 3] };
  };
  return { size, at };
}

describe('the icons the browser shows', () => {
  it.each([16, 32, 48, 96, 128])('%dpx is the store’s clay tile, not the bare mark', (size) => {
    const icon = pixels(`public/icon/${size}.png`);
    expect(icon.size).toBe(size);
    // Just inside the tile's lower edge, clear of the mark.
    const clay = icon.at(Math.round(size * 0.75), Math.round(size * 0.8));
    expect(clay.a).toBe(255);
    expect(clay.r).toBeGreaterThan(clay.b + 80);
  });

  it('draws the mark in paper on it', () => {
    const icon = pixels('public/icon/128.png');
    // On the stem: x 10 of the mark's 32, scaled and centred on the tile.
    const stem = icon.at(Math.round(64 + (10 - 15) * 2.6), 64);
    expect(stem).toMatchObject({ r: 0xf7, g: 0xf3, b: 0xec, a: 255 });
  });

  it('leaves the guidelines’ clear edge on the large one', () => {
    expect(pixels('public/icon/128.png').at(4, 64).a).toBe(0);
  });
});
