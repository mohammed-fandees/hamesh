/**
 * System, light or dark.
 *
 * "System" is the absence of a choice: no attribute on the page, and the
 * stylesheet follows the visitor's setting. The saved choice is applied by a
 * blocking script in the head, before the first paint; this only changes it.
 */

const STORAGE_KEY = 'hamesh-theme';
const ORDER = ['system', 'light', 'dark'];
const PAPER = { light: '#f7f3ec', dark: '#16140f' };

const LABELS = {
  ar: {
    action: 'بدّل الوضع الفاتح والغامق',
    system: 'حسب النظام',
    light: 'فاتح',
    dark: 'غامق',
  },
  en: { action: 'Switch light and dark', system: 'system', light: 'light', dark: 'dark' },
};

export function createThemeToggle(button = document.getElementById('themeToggle')) {
  const root = document.documentElement;
  const metas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
  const current = () => root.dataset.theme ?? 'system';

  function describe() {
    const words = LABELS[root.lang === 'en' ? 'en' : 'ar'];
    const text = `${words.action} (${words[current()]})`;
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
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* Storage blocked: the page still switches. */
    }
    describe();
    paintChrome();
  }

  button?.addEventListener('click', () => {
    apply(ORDER[(ORDER.indexOf(current()) + 1) % ORDER.length]);
  });

  describe();
  paintChrome();
  return { describe };
}
