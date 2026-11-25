import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../../landing/css/variables.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

/** The custom properties declared in the first rule with this exact selector. */
function tokensOf(selector: string): string[] {
  const at = css.indexOf(`${selector} {`);
  expect(at, `no rule for ${selector}`).toBeGreaterThan(-1);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  return body
    .split(';')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('--'));
}

describe('the landing page’s dark tokens', () => {
  it('are the same when chosen as when the system asks', () => {
    const system = tokensOf(":root:not([data-theme='light'])");
    expect(system.length).toBeGreaterThan(10);
    expect(tokensOf(":root[data-theme='dark']")).toEqual(system);
  });
});
