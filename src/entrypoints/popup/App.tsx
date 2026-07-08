import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { MarginMark } from '@/ui/MarginMark';
import { getStrings, resolveLang, dirForLang } from '@/ui/i18n';
import type { PageStateResponse } from '@/messaging/types';
import '@/ui/tokens.css';

const lang = resolveLang(browser.i18n?.getUILanguage?.());
const strings = getStrings(lang);
const dir = dirForLang(lang);
const prefersDark =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;

export function App() {
  const [count, setCount] = useState<number | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id == null) return;
      try {
        const res = (await browser.tabs.sendMessage(tab.id, {
          type: 'GET_PAGE_STATE',
        })) as PageStateResponse | undefined;
        if (res?.type === 'PAGE_STATE') {
          setCount(res.count);
          setActive(true);
        }
      } catch {
        setActive(false); // no content script on this page
      }
    })();
  }, []);

  async function handleAdd() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id == null) return;
    try {
      await browser.tabs.sendMessage(tab.id, { type: 'ENABLE_SELECTION' });
      window.close();
    } catch {
      setActive(false);
    }
  }

  return (
    <div className="hm-scope hm-popup" dir={dir} data-hm-theme={prefersDark ? 'dark' : 'light'}>
      <div className="hm-popup__head">
        <MarginMark size={16} strokeWidth={3.5} style={{ color: 'var(--hm-accent)' }} />
        {lang === 'ar' ? (
          <span className="hm-popup__brand-ar">{strings.brand}</span>
        ) : (
          <span className="hm-popup__brand">{strings.brand}</span>
        )}
        <span className="hm-popup__shortcut">Alt+H</span>
      </div>

      <div className="hm-popup__count">
        {count ?? '—'} <span>{strings.notesOnPage(count ?? 0)}</span>
      </div>

      <button
        type="button"
        className="hm-btn hm-btn-primary"
        style={{ width: '100%', marginTop: 'var(--hm-space-4)', padding: '11px' }}
        onClick={handleAdd}
        disabled={!active}
      >
        + {strings.addNote}
      </button>

      <div
        className={`hm-status ${active ? 'hm-status--success' : 'hm-status--warning'}`}
        style={{ marginTop: 'var(--hm-space-3)', marginBottom: 0 }}
      >
        <span className="hm-dot" />
        {active ? strings.activeOnPage : lang === 'ar' ? 'غير متاح هنا' : 'Not available here'}
      </div>
    </div>
  );
}
