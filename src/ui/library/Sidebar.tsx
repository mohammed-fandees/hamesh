import type { ReactNode } from 'react';
import { MarginMark } from '../kit/MarginMark';
import { LibraryIcon, MentionsIcon, SettingsIcon, TeamIcon, WhatsNewIcon } from '../kit/icons';
import type { Lang, Strings } from '../i18n';
import { getTeamsStrings } from '../teams/strings';

export type LibraryView = 'library' | 'settings' | 'teams' | 'mentions' | 'whats-new';

interface SidebarProps {
  view: LibraryView;
  lang: Lang;
  strings: Strings;
  onNavigate: (view: LibraryView) => void;
  /** Marks What's New with a dot when there are releases the user hasn't
   *  read. The page opens itself once after an update, so this is for
   *  anyone who closed that tab before reading it. */
  whatsNewUnseen?: boolean;
  /** Teams gets a destination of its own only in builds that have it. */
  showTeams?: boolean;
  /** Marks Mentions with a dot when someone has named the reader since they
   *  last looked. Being named is the one thing in Teams that is addressed to
   *  this person rather than to a team, which is why it is a destination of
   *  its own rather than a section inside one team's page. */
  mentionsUnseen?: boolean;
}

interface Destination {
  view: LibraryView;
  label: string;
  icon: ReactNode;
  unseen?: boolean;
}

/**
 * The column beside every one of Hamesh's own pages: where the reader is, and
 * everywhere else they can go. Switching is not navigating — the address stays
 * the same, and a reload opens the Library.
 *
 * What's New sits apart at the foot: it isn't somewhere anyone works, it's
 * somewhere they go once after an update.
 */
export function Sidebar({
  view,
  lang,
  strings,
  onNavigate,
  whatsNewUnseen = false,
  showTeams = false,
  mentionsUnseen = false,
}: SidebarProps) {
  const main: Destination[] = [
    { view: 'library', label: strings.notesLibrary, icon: <LibraryIcon /> },
  ];
  // The build-time constant inside the body, so a build without Teams drops
  // both destinations and the Teams strings with them.
  if (import.meta.env.WXT_TEAMS_API_ORIGIN && showTeams) {
    const teams = getTeamsStrings(lang);
    main.push(
      { view: 'teams', label: teams.teams, icon: <TeamIcon size={15} /> },
      { view: 'mentions', label: teams.mentions, icon: <MentionsIcon />, unseen: mentionsUnseen },
    );
  }
  main.push({ view: 'settings', label: strings.settings, icon: <SettingsIcon /> });
  const foot: Destination[] = [
    { view: 'whats-new', label: strings.whatsNew, icon: <WhatsNewIcon />, unseen: whatsNewUnseen },
  ];

  const list = (items: Destination[], className: string) => (
    <ul className={className}>
      {items.map((item) => (
        <li key={item.view}>
          <button
            type="button"
            className="hm-sidebar__nav-item"
            aria-current={view === item.view ? 'page' : undefined}
            onClick={() => onNavigate(item.view)}
          >
            {item.icon}
            {item.label}
            {item.unseen && <span className="hm-sidebar__dot" aria-hidden="true" />}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <nav className="hm-sidebar" aria-label={strings.notesLibrary}>
      <div className="hm-sidebar__brand">
        <MarginMark size={18} strokeWidth={3.5} />
        <span className="hm-sidebar__brand-text">{strings.brand}</span>
      </div>
      {list(main, 'hm-sidebar__nav')}
      {list(foot, 'hm-sidebar__nav hm-sidebar__nav--foot')}
    </nav>
  );
}
