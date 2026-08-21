/**
 * Arabic and English, one page.
 *
 * Hamesh is Arabic-first — هامش means margin — so Arabic is what the document
 * ships as, and the toggle moves to English rather than the other way round.
 * Every translatable node carries both strings as `data-ar` / `data-en`, which
 * keeps the copy beside the markup it belongs to instead of in a dictionary
 * that drifts out of step with it.
 *
 * Switching flips `dir`, and the demos are rebuilt afterwards: their positions
 * are measured, and in RTL every one of them mirrors.
 */

const STORAGE_KEY = 'hamesh-lang';

export function createLanguageToggle({ onChange } = {}) {
  const html = document.documentElement;
  const button = document.getElementById('langToggle');
  const nodes = Array.from(document.querySelectorAll('[data-ar]'));

  function apply(lang, { notify = true } = {}) {
    const arabic = lang === 'ar';

    html.lang = lang;
    html.dir = arabic ? 'rtl' : 'ltr';

    for (const node of nodes) {
      const value = node.getAttribute(arabic ? 'data-ar' : 'data-en');
      if (value !== null) node.textContent = value;
    }

    if (button) {
      button.textContent = arabic ? 'EN' : 'ع';
      button.setAttribute('aria-pressed', String(!arabic));
      button.setAttribute('aria-label', arabic ? 'Switch to English' : 'التبديل إلى العربية');
    }

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* Private mode, or storage disabled. The page still switches. */
    }

    if (notify) onChange?.(lang);
  }

  let saved = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (saved === 'en') apply('en', { notify: false });

  button?.addEventListener('click', () => apply(html.lang === 'ar' ? 'en' : 'ar'));

  return { apply };
}
