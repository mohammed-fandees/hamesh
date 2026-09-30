import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Hamesh asks in place — on the note, on the row, in the card — and never in the
 * browser's own box. The Teams work removed the last eight native confirmations;
 * this is what keeps a ninth from arriving in a review nobody remembers.
 */
const SRC = resolve(__dirname, '../../src');

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(ts|tsx)$/.test(name)) yield path;
  }
}

describe('native dialogs', () => {
  it('are not used anywhere in the extension', () => {
    const offenders: string[] = [];
    for (const file of files(SRC)) {
      const text = readFileSync(file, 'utf8')
        // Comments may talk about them; code may not call them.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      if (/\b(window\.|globalThis\.)?(confirm|alert|prompt)\s*\(/.test(text)) {
        // `.confirm(` on something that is not the window is a method of ours.
        for (const match of text.matchAll(
          /(?<![.\w])(?:window\.|globalThis\.)?(confirm|alert|prompt)\s*\(/g,
        )) {
          offenders.push(`${file}: ${match[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
