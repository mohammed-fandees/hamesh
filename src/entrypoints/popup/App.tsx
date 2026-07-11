import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react';
import { browser } from 'wxt/browser';
import { MarginMark } from '@/ui/MarginMark';
import { SettingsView } from '@/ui/SettingsView';
import { NotesBrowser } from '@/ui/NotesBrowser';
import { getStrings, resolveLang, dirForLang, type Lang } from '@/ui/i18n';
import { createPreferencesRepository } from '@/storage/preferences-repository';
import { createNotesRepository } from '@/storage/notes-repository';
import type { AppearanceMode } from '@/domain/preferences';
import type { PageStateResponse } from '@/messaging/types';
import type { Note } from '@/domain/note';
import { parsePreferences } from '@/domain/preferences';
import '@/ui/tokens.css';

const STORAGE_KEY = 'local:hamesh:preferences';
const prefersDark =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
const prefsRepo = createPreferencesRepository();
const notesRepo = createNotesRepository();

// Read stored preferences synchronously before React mounts so the popup
// opens with the correct theme and language on the first frame, avoiding
// a flash from the async fallback. Uses the `storage` global (WXT runtime)
// — same pattern as the repositories.
let initialAppearance: AppearanceMode = 'match-website';
let storedLang: Lang | null = null;
try {
  const raw = await (globalThis as any).storage?.getItem?.(STORAGE_KEY);
  const parsed = parsePreferences(raw);
  if (parsed.appearance) initialAppearance = parsed.appearance;
  if (parsed.language) storedLang = resolveLang(parsed.language);
} catch {
  // Storage read failed — fall back to defaults silently.
}

const initialLang = storedLang ?? resolveLang(browser.i18n?.getUILanguage?.());

type View = 'home' | 'browse' | 'settings';

export function App() {
  const [count, setCount] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const [view, setView] = useState<View>('home');
  const [lang, setLang] = useState<Lang>(initialLang);
  const [appearance, setAppearance] = useState<AppearanceMode>(initialAppearance);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const homePaneRef = useRef<HTMLDivElement>(null);
  const browsePaneRef = useRef<HTMLDivElement>(null);
  const settingsPaneRef = useRef<HTMLDivElement>(null);
  const skipFocusRef = useRef(true);
  const [paneHeight, setPaneHeight] = useState<number | null>(null);

  const strings = getStrings(lang);
  const dir = dirForLang(lang);
  const theme =
    appearance === 'light'
      ? 'light'
      : appearance === 'dark'
        ? 'dark'
        : prefersDark
          ? 'dark'
          : 'light';

  // Load stored preferences (if any) and stay subscribed — `storage.watch`
  // picks up changes made in the content script's own copy of Settings, or
  // another open popup, without extra messaging.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const prefs = await prefsRepo.get();
      if (!cancelled) {
        setLang(prefs.language ?? initialLang);
        setAppearance(prefs.appearance);
      }
    })();
    const unwatch = prefsRepo.watch((prefs) => {
      setLang(prefs.language ?? initialLang);
      setAppearance(prefs.appearance);
    });
    return () => {
      cancelled = true;
      unwatch();
    };
  }, []);

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

  function handleLanguageChange(next: Lang) {
    setLang(next); // immediate feedback; persisted below, and re-confirmed by watch()
    void prefsRepo.setLanguage(next);
  }

  function handleAppearanceChange(next: AppearanceMode) {
    setAppearance(next); // immediate feedback; persisted below, and re-confirmed by watch()
    void prefsRepo.setAppearance(next);
  }

  useEffect(() => {
    if (view !== 'browse') return;
    let cancelled = false;
    (async () => {
      try {
        const notes = await notesRepo.getAll();
        if (!cancelled) setAllNotes(notes);
      } catch {
        if (!cancelled) setAllNotes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view]);

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

  // Measure the active pane height and lock the viewport to it. This allows
  // the popup to shrink back down when returning to smaller panes (like Home),
  // and grow when entering larger panes (like Browse).
  useEffect(() => {
    const activeRef =
      view === 'home' ? homePaneRef : view === 'browse' ? browsePaneRef : settingsPaneRef;

    if (!activeRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPaneHeight(entry.target.scrollHeight);
      }
    });

    observer.observe(activeRef.current);
    return () => observer.disconnect();
  }, [view]);
  // convention used throughout Hamesh's content-script UI (selection mode,
  // composer, viewer).
  useEffect(() => {
    if (view !== 'settings' && view !== 'browse') return;
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
  const viewIndex = view === 'home' ? 0 : view === 'browse' ? 1 : 2;
  const trackStyle: CSSProperties = {
    transform: `translateX(${sign * viewIndex * (100 / 3)}%)`,
  };

  return (
    <div className="hm-scope hm-popup" dir={dir} data-hm-theme={theme}>
      <div
        className="hm-popup__viewport"
        style={
          paneHeight
            ? { height: paneHeight, transition: 'height 200ms cubic-bezier(0.16, 1, 0.3, 1)' }
            : undefined
        }
      >
        <div className="hm-popup__track" style={trackStyle}>
          <div
            ref={homePaneRef}
            className="hm-popup__pane"
            aria-hidden={view !== 'home'}
            inert={view !== 'home'}
          >
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

            <button
              type="button"
              className="hm-btn hm-btn-ghost"
              style={{ width: '100%', marginTop: 'var(--hm-space-2)', padding: '11px' }}
              onClick={() => setView('browse')}
            >
              {strings.browseNotesButton}
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
            ref={browsePaneRef}
            className="hm-popup__pane"
            aria-hidden={view !== 'browse'}
            inert={view !== 'browse'}
          >
            <NotesBrowser
              notes={allNotes}
              strings={strings}
              lang={lang}
              active={view === 'browse'}
              onBack={() => setView('home')}
            />
          </div>

          <div
            ref={settingsPaneRef}
            className="hm-popup__pane"
            aria-hidden={view !== 'settings'}
            inert={view !== 'settings'}
          >
            <SettingsView
              strings={strings}
              lang={lang}
              dir={dir}
              appearance={appearance}
              active={view === 'settings'}
              onBack={() => setView('home')}
              onLanguageChange={handleLanguageChange}
              onAppearanceChange={handleAppearanceChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
