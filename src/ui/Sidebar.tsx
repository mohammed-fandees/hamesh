import { MarginMark } from './MarginMark';
import type { Strings } from './i18n';

export type LibraryView = 'library' | 'settings';

interface SidebarProps {
  view: LibraryView;
  strings: Strings;
  onNavigate: (view: LibraryView) => void;
}

/**
 * Permanent nav column for the Notes Library page — Library and Settings
 * live here as separate views instead of Settings being popup-only. Flexbox
 * row direction mirrors automatically under `dir="rtl"` on an ancestor, so
 * no separate RTL layout is needed here.
 */
export function Sidebar({ view, strings, onNavigate }: SidebarProps) {
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
    </nav>
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
