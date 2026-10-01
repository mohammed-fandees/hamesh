import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The design tokens are a contract between four stylesheets, and most of what
 * goes wrong with one is silent: a hand-flattened colour that drifted from the
 * accent, a translucent layer on something painted over a host page, a size
 * typed as a number again. These read the CSS itself, so they fail the moment
 * one of those happens rather than in a screenshot a month later.
 */

const root = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const SHEETS = {
  'src/ui/tokens.css': read('src/ui/tokens.css'),
  'src/ui/pages.css': read('src/ui/pages.css'),
  'src/ui/notes-library.css': read('src/ui/notes-library.css'),
  'src/ui/teams/teams.css': read('src/ui/teams/teams.css'),
  'src/ui/teams/page.css': read('src/ui/teams/page.css'),
  'src/ui/teams/consent.css': read('src/ui/teams/consent.css'),
  'src/entrypoints/popup/App.css': read('src/entrypoints/popup/App.css'),
};
const tokens = SHEETS['src/ui/tokens.css'];

/** One rule: its selector list and its body. Enough for these sheets, which
 *  nest nothing but at-rules whose inner rules this also visits. */
function rules(css: string): { selector: string; body: string }[] {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: { selector: string; body: string }[] = [];
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: match[1].trim(), body: match[2] });
  }
  return out;
}

/** The value a custom property is given inside the rule whose selector matches. */
function themeValue(name: string, theme: 'light' | 'dark'): string {
  const wanted = theme === 'dark' ? /data-hm-theme='dark'/ : /^:host,\s*\.hm-scope$/;
  for (const rule of rules(tokens)) {
    if (!wanted.test(rule.selector)) continue;
    const found = rule.body.match(new RegExp(`${name}:\\s*([^;]+);`));
    if (found) return found[1].trim();
  }
  throw new Error(`${name} is not set for ${theme}`);
}

const hex = (value: string): [number, number, number] => {
  const v = value.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
};

/** `top` laid over `base` at `alpha`, as the browser would flatten it. */
const composite = (top: number[], base: number[], alpha: number) =>
  top.map((t, i) => Math.round(base[i] + (t - base[i]) * alpha));

describe('the accent, as channels', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`matches --hm-accent in ${theme}`, () => {
      const channels = themeValue('--hm-accent-rgb', theme).split(/\s+/).map(Number);
      expect(channels).toEqual(hex(themeValue('--hm-accent', theme)));
    });
  }
});

describe('the opaque state colours', () => {
  const opacity = (name: string) => Number(themeValue(name, 'light'));

  for (const theme of ['light', 'dark'] as const) {
    it(`are the accent laid over --hm-surface, in ${theme}`, () => {
      const accent = hex(themeValue('--hm-accent', theme));
      const surface = hex(themeValue('--hm-surface', theme));
      // Off by one channel value is rounding in the hand-computed hex, not drift.
      const near = (actual: number[], expected: number[]) =>
        actual.forEach((v, i) => expect(Math.abs(v - expected[i])).toBeLessThanOrEqual(1));

      near(
        hex(themeValue('--hm-surface-hover', theme)),
        composite(accent, surface, opacity('--hm-state-hover')),
      );
      near(
        hex(themeValue('--hm-surface-pressed', theme)),
        composite(accent, surface, opacity('--hm-state-pressed')),
      );
    });
  }

  it('keep the ladder in order, so each step is told apart from the next', () => {
    expect(opacity('--hm-state-hover')).toBeLessThan(opacity('--hm-state-focus'));
    expect(opacity('--hm-state-focus')).toBeLessThan(opacity('--hm-state-pressed'));
  });
});

/**
 * Painted straight over a host page. A translucent layer as the background of
 * any of these lets the page show through, in whichever theme the accent is
 * translucent in — which is how `.hm-marker:hover` broke once already.
 */
const OVER_THE_PAGE = [
  '.hm-marker',
  '.hm-text-action',
  '.hm-video-marker',
  '.hm-video-preview',
  '.hm-text-popup',
  '.hm-hint',
  '.hm-hover-outline',
];

describe('what is painted over a host page', () => {
  it('never takes a translucent state layer as its own background', () => {
    const offenders: string[] = [];
    for (const { selector, body } of rules(tokens)) {
      const touchesPage = selector
        .split(',')
        .some((part) =>
          OVER_THE_PAGE.some((cls) =>
            new RegExp(`${cls.replace('.', '\\.')}(?![\\w-])`).test(part),
          ),
        );
      if (!touchesPage) continue;
      if (/background[^:]*:[^;]*var\(--hm-(layer|accent-tint)/.test(body)) offenders.push(selector);
    }
    expect(offenders).toEqual([]);
  });
});

describe('the type scale', () => {
  it('is the only place a font size is written as a number', () => {
    const offenders: string[] = [];
    for (const [file, css] of Object.entries(SHEETS)) {
      for (const { selector, body } of rules(css)) {
        // The scale itself is defined on the theme rule, as `--hm-text-*`.
        if (/^:host,\s*\.hm-scope$/.test(selector)) continue;
        for (const found of body.matchAll(/(?<![-\w])font-size:\s*([^;]+);/g)) {
          if (!/^var\(--hm-text-[\w-]+\)$/.test(found[1].trim())) {
            offenders.push(`${file}: ${selector} → ${found[1].trim()}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never sets a size through the `font` shorthand, which would reset the family', () => {
    const offenders: string[] = [];
    for (const [file, css] of Object.entries(SHEETS)) {
      for (const { selector, body } of rules(css)) {
        // `font: inherit` is the one safe use — it takes the parent's family too.
        for (const found of body.matchAll(/(?<![-\w])font:\s*([^;]+);/g)) {
          if (found[1].trim() !== 'inherit') offenders.push(`${file}: ${selector} → ${found[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('custom properties', () => {
  it('never refer to themselves — a cycle resolves to nothing and silently kills every consumer', () => {
    // How the motion intents broke once: `--hm-motion-state: var(--hm-motion-state)`
    // left every hover transition, the popup slide and every entrance animation
    // resolving to their initial values, repo-wide, with nothing failing.
    const offenders: string[] = [];
    for (const [file, css] of Object.entries(SHEETS)) {
      for (const { body } of rules(css)) {
        for (const found of body.matchAll(/(--hm-[\w-]+)\s*:\s*([^;]+);/g)) {
          if (found[2].includes(`var(${found[1]})`) || found[2].includes(`var(${found[1]},`)) {
            offenders.push(`${file}: ${found[1]}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('give every motion intent a duration and a curve', () => {
    for (const intent of ['state', 'enter', 'exit', 'emphasized', 'pop']) {
      expect(themeValue(`--hm-motion-${intent}`, 'light')).toMatch(
        /^var\(--hm-dur-\w+\) var\(--hm-ease-\w+\)$/,
      );
    }
  });
});

describe('selectors the build can keep', () => {
  it('never uses :dir(), which the CSS pipeline lowers to :lang() — matching nothing here', () => {
    for (const [file, css] of Object.entries(SHEETS)) {
      expect(css.replace(/\/\*[\s\S]*?\*\//g, ''), file).not.toMatch(/:dir\(/);
    }
  });
});
