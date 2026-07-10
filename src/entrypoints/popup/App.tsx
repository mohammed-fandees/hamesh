import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { browser } from 'wxt/browser';
import { MarginMark } from '@/ui/MarginMark';
import { SettingsView } from '@/ui/SettingsView';
import { getStrings, resolveLang, dirForLang } from '@/ui/i18n';
import type { PageStateResponse } from '@/messaging/types';
import '@/ui/tokens.css';

const lang = resolveLang(browser.i18n?.getUILanguage?.());
const strings = getStrings(lang);
const dir = dirForLang(lang);
const prefersDark =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;

type View = 'home' | 'settings';

export function App() {
  const [count, setCount] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const [view, setView] = useState<View>('home');
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const skipFocusRef = useRef(true);

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

  // Return focus to the trigger that opened Settings when navigating back.
  // Settings' own heading grabs focus on its side when navigating in (see
  // SettingsView) — skip the very first run so mounting on "home" doesn't
  // steal focus from the page.
  useEffect(() => {
    if (skipFocusRef.current) {
      skipFocusRef.current = false;
      return;
    }
    if (view === 'home') settingsBtnRef.current?.focus({ preventScroll: true });
  }, [view]);

  // Escape backs out of Settings, matching the Escape-to-close convention
  // used throughout Hamesh's content-script UI (selection mode, composer,
  // viewer).
  useEffect(() => {
    if (view !== 'settings') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setView('home');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [view]);

  // Slide direction is spatially mirrored for RTL: forward navigation moves
  // toward the reading direction's "in" side (left in LTR, right in RTL).
  const sign = dir === 'rtl' ? 1 : -1;
  const trackStyle: CSSProperties = {
    transform: `translateX(${view === 'settings' ? sign * 50 : 0}%)`,
  };

  return (
    <div className="hm-scope hm-popup" dir={dir} data-hm-theme={prefersDark ? 'dark' : 'light'}>
      <div className="hm-popup__viewport">
        <div className="hm-popup__track" style={trackStyle}>
          <div className="hm-popup__pane" aria-hidden={view !== 'home'} inert={view !== 'home'}>
            <div className="hm-popup__head">
              <MarginMark size={16} strokeWidth={3.5} style={{ color: 'var(--hm-accent)' }} />
              {lang === 'ar' ? (
                <span className="hm-popup__brand-ar">{strings.brand}</span>
              ) : (
                <span className="hm-popup__brand">{strings.brand}</span>
              )}
              <span className="hm-popup__shortcut">Alt+H</span>
              <button
                ref={settingsBtnRef}
                type="button"
                className="hm-icon-btn"
                aria-label={strings.settings}
                onClick={() => setView('settings')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <line x1="2" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1.4" />
                  <circle
                    cx="10"
                    cy="5"
                    r="1.8"
                    fill="var(--hm-surface)"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <line x1="2" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.4" />
                  <circle
                    cx="6"
                    cy="11"
                    r="1.8"
                    fill="var(--hm-surface)"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
              </button>
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
              {active
                ? strings.activeOnPage
                : lang === 'ar'
                  ? 'غير متاح هنا'
                  : 'Not available here'}
            </div>
          </div>

          <div
            className="hm-popup__pane"
            aria-hidden={view !== 'settings'}
            inert={view !== 'settings'}
          >
            <SettingsView
              strings={strings}
              lang={lang}
              dir={dir}
              active={view === 'settings'}
              onBack={() => setView('home')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
