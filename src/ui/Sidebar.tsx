import { MarginMark } from './MarginMark';
import type { Strings } from './i18n';

export type LibraryView = 'library' | 'settings' | 'whats-new';

interface SidebarProps {
  view: LibraryView;
  strings: Strings;
  onNavigate: (view: LibraryView) => void;
  /** Marks What's New with a dot when there are releases the user hasn't
   *  read. The page opens itself once after an update, so this is for
   *  anyone who closed that tab before reading it. */
  whatsNewUnseen?: boolean;
}

/**
 * Permanent nav column for the Notes Library page — Library, Settings, and
 * What's New live here as separate views instead of Settings being
 * popup-only. Flexbox row direction mirrors automatically under `dir="rtl"`
 * on an ancestor, so no separate RTL layout is needed here.
 *
 * What's New sits apart at the bottom: it isn't somewhere you work, it's
 * somewhere you go once after an update, so it shouldn't share weight with
 * the two destinations you actually use.
 */
export function Sidebar({ view, strings, onNavigate, whatsNewUnseen = false }: SidebarProps) {
  return (
    <nav className="hm-sidebar" aria-label={strings.notesLibrary}>
      <div className="hm-sidebar__brand">
        <MarginMark size={18} strokeWidth={3.5} style={{ color: 'var(--hm-accent)' }} />
        <span className="hm-sidebar__brand-text">{strings.brand}</span>
      </div>
      <ul className="hm-sidebar__nav">
        <li>
          <button
            type="button"
            className="hm-sidebar__nav-item"
            aria-current={view === 'library' ? 'page' : undefined}
            onClick={() => onNavigate('library')}
          >
            <LibraryIcon />
            {strings.notesLibrary}
          </button>
        </li>
        <li>
          <button
            type="button"
            className="hm-sidebar__nav-item"
            aria-current={view === 'settings' ? 'page' : undefined}
            onClick={() => onNavigate('settings')}
          >
            <SettingsIcon />
            {strings.settings}
          </button>
        </li>
      </ul>

      <ul className="hm-sidebar__nav hm-sidebar__nav--foot">
        <li>
          <button
            type="button"
            className="hm-sidebar__nav-item"
            aria-current={view === 'whats-new' ? 'page' : undefined}
            onClick={() => onNavigate('whats-new')}
          >
            <WhatsNewIcon />
            {strings.whatsNew}
            {whatsNewUnseen && <span className="hm-sidebar__dot" aria-hidden="true" />}
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** A gift/parcel outline — "here's something new", without borrowing the
 *  margin mark, which already means "a note" everywhere else in Hamesh. */
function WhatsNewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
      <path
        d="M2.5 6.5 H12.5 V12.5 H2.5 Z M1.5 4 H13.5 V6.5 H1.5 Z M7.5 4 V12.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M7.5 4 C7.5 4 5 4 4.4 3.4 C3.9 2.9 4.2 2 5 2 C6.2 2 7.5 4 7.5 4 Z M7.5 4 C7.5 4 10 4 10.6 3.4 C11.1 2.9 10.8 2 10 2 C8.8 2 7.5 4 7.5 4 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
      <path
        d="M3 2.5 H12 V12.5 L7.5 10 L3 12.5 Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
      <line x1="2" y1="5" x2="14" y2="5" stroke="currentColor" strokeWidth="1.4" />
      <circle
        cx="10"
        cy="5"
        r="1.8"
        fill="var(--hm-paper)"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <line x1="2" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.4" />
      <circle
        cx="6"
        cy="11"
        r="1.8"
        fill="var(--hm-paper)"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
