import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { browser } from 'wxt/browser';
import { MarginMark } from '@/ui/kit/MarginMark';
import { EmptyState } from '@/ui/kit/EmptyState';
import { Skeleton } from '@/ui/kit/Skeleton';
import { StatusLine } from '@/ui/kit/Feedback';
import { ChevronIcon, PlusIcon, SettingsIcon } from '@/ui/kit/icons';
import { SettingsView } from '@/ui/settings/SettingsView';
import { getStrings, resolveLang, dirForLang } from '@/ui/i18n';
import { usePreferences, systemTheme } from '@/ui/hooks/usePreferences';
import { COMMANDS, useShortcuts } from '@/ui/hooks/useShortcuts';
import { usePageBackground } from '@/ui/hooks/usePageBackground';
import { createPreferencesRepository } from '@/storage/preferences-repository';
import { resolveTheme } from '@/domain/preferences';
import type { PageStateResponse } from '@/messaging/types';
import '@/ui/tokens.css';
import '@/ui/pages.css';

const initialLang = resolveLang(browser.i18n?.getUILanguage?.());
/** The popup has no web page of its own to match — the system's scheme is the
 *  closest thing to "Match website" for Hamesh's own chrome. */
const matched = systemTheme();
const prefsRepo = createPreferencesRepository();

type View = 'home' | 'settings';

/**
 * The toolbar popup — a doorway, not a dashboard: how many notes this page
 * has, the one button that starts a new one, the way to the Library, and the
 * two settings worth changing in a hurry on a second pane that slides in.
 */
export function App() {
  const [count, setCount] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  /** False until the page has answered (or refused to), so the popup shows a
   *  skeleton while it is finding out rather than a dash that reads as "none". */
  const [checked, setChecked] = useState(false);
  const [view, setView] = useState<View>('home');
  const preferences = usePreferences(prefsRepo);
  const shortcuts = useShortcuts();
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const skipFocusRef = useRef(true);
  const scopeRef = useRef<HTMLDivElement>(null);

  const lang = preferences.prefs?.language ?? initialLang;
  const appearance = preferences.prefs?.appearance ?? 'match-website';
  const strings = getStrings(lang);
  const dir = dirForLang(lang);
  const theme = resolveTheme(appearance, matched);
  usePageBackground(scopeRef, '--hm-surface', theme);

  useEffect(() => {
    void (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id == null) {
        setChecked(true);
        return;
      }
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
      setChecked(true);
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

  async function open(path: string) {
    await browser.tabs.create({ url: browser.runtime.getURL(path as '/notes.html') });
    window.close();
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

  // Escape backs out of Settings, as it backs out of every layer in Hamesh.
  useEffect(() => {
    if (view !== 'settings') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setView('home');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [view]);

  // Slide direction is mirrored for RTL: forward moves toward the reading
  // direction's "in" side (left in LTR, right in RTL).
  const sign = dir === 'rtl' ? 1 : -1;
  const trackStyle: CSSProperties = {
    transform: `translateX(${view === 'settings' ? sign * 50 : 0}%)`,
  };
  const addShortcut = shortcuts[COMMANDS.addNote];

  return (
    <div ref={scopeRef} className="hm-scope hm-popup" dir={dir} data-hm-theme={theme}>
      <div className="hm-popup__viewport">
        <div className="hm-popup__track" style={trackStyle}>
          <div className="hm-popup__pane" aria-hidden={view !== 'home'} inert={view !== 'home'}>
            <div className="hm-popup__head">
              <MarginMark size={16} strokeWidth={3.5} className="hm-mark hm-popup__mark" />
              <span
                className={
                  lang === 'ar' ? 'hm-popup__brand hm-popup__brand--ar' : 'hm-popup__brand'
                }
              >
                {strings.brand}
              </span>
              {addShortcut && <kbd className="hm-kbd hm-popup__shortcut">{addShortcut}</kbd>}
              <button
                ref={settingsBtnRef}
                type="button"
                className="hm-icon-btn"
                aria-label={strings.settings}
                onClick={() => setView('settings')}
              >
                <SettingsIcon size={16} />
              </button>
            </div>

            {!checked ? (
              // Asking the page: the shape of what is coming, not a placeholder dash.
              <div className="hm-popup__body">
                <Skeleton rows={2} />
              </div>
            ) : !active ? (
              // A page Hamesh cannot work on: what happened, and the control that
              // still does something useful from here.
              <EmptyState
                size="compact"
                title={strings.popupUnavailableTitle}
                body={strings.popupUnavailableBody}
              />
            ) : (
              <div className="hm-popup__body">
                <p className="hm-popup__count">
                  {count ?? 0} <span>{strings.notesOnPage(count ?? 0)}</span>
                </p>
                <button
                  type="button"
                  className="hm-btn hm-btn-primary hm-popup__add"
                  onClick={handleAdd}
                >
                  <PlusIcon size={12} />
                  {strings.addNote}
                </button>
                <StatusLine tone="success">{strings.activeOnPage}</StatusLine>
              </div>
            )}

            <button
              type="button"
              className="hm-popup__link"
              onClick={() => void open('/notes.html')}
            >
              {strings.openNotesLibrary}
              <ChevronIcon direction="forward" />
            </button>
          </div>

          <div
            className="hm-popup__pane"
            aria-hidden={view !== 'settings'}
            inert={view !== 'settings'}
          >
            <SettingsView
              strings={strings}
              lang={lang}
              appearance={appearance}
              active={view === 'settings'}
              onBack={() => setView('home')}
              onLanguageChange={preferences.setLanguage}
              onAppearanceChange={preferences.setAppearance}
              onOpenFullSettings={() => void open('/notes.html?view=settings')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
