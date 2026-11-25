/**
 * Light or dark.
 *
 * Until the visitor chooses, the page follows their system: no attribute on
 * the page, and the stylesheet answers the media query. Every click turns the
 * page to the opposite of what it shows and remembers that. A third, "system"
 * step used to sit in the cycle, and on a dark system it changed nothing on
 * screen, which read as a click that went missing.
 *
 * The saved choice is applied by a blocking script in the head, before the
 * first paint; this only changes it.
 */

const STORAGE_KEY = 'hamesh-theme';
const PAPER = { light: '#f7f3ec', dark: '#16140f' };

const LABELS = {
  ar: { light: 'التبديل إلى الوضع الفاتح', dark: 'التبديل إلى الوضع الغامق' },
  en: { light: 'Switch to light', dark: 'Switch to dark' },
};

/** What the page shows now, chosen or inherited from the system. */
export function shownTheme(root = document.documentElement) {
  if (root.dataset.theme === 'light' || root.dataset.theme === 'dark') return root.dataset.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** The theme a click turns to: always the other one. */
export function nextTheme(shown) {
  return shown === 'dark' ? 'light' : 'dark';
}

export function createThemeToggle(button = document.getElementById('themeToggle')) {
  const root = document.documentElement;
  const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));

  /* The label names what the button will do, not what the page is. */
  function describe() {
    const words = LABELS[root.lang === 'en' ? 'en' : 'ar'];
    const text = words[nextTheme(shownTheme(root))];
    button?.setAttribute('aria-label', text);
    button?.setAttribute('title', text);
  }

  /* The browser's own bar follows the choice too, not only the system. */
  function paintChrome() {
    for (const meta of metas) {
      const own = meta.media.includes('dark') ? 'dark' : 'light';
      meta.content = PAPER[root.dataset.theme ?? own];
    }
  }

  function apply(theme) {
    root.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* Storage blocked: the page still switches. */
    }
    describe();
    paintChrome();
  }

  button?.addEventListener('click', () => apply(nextTheme(shownTheme(root))));

  /* Someone who has not chosen sees the label follow their system. */
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', describe);

  describe();
  paintChrome();
  return { describe };
}
