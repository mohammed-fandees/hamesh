import type { AnnouncementPreferences } from './preferences';

/**
 * Something Hamesh wants to tell its readers: a new feature, Teams. Written in
 * the admin panel and handed out by the server, in both languages.
 *
 * Plain text and one optional action. Where an action leads is a name from this
 * list or an https link, so an announcement can't do more than a link on a page.
 */
export type AnnouncementDestination = 'teams' | 'plan' | 'settings' | 'whats-new' | 'start';

export interface Localized {
  en: string;
  ar: string;
}

export interface Announcement {
  id: string;
  title: Localized;
  body: Localized | null;
  action: {
    label: Localized;
    to: { open: AnnouncementDestination } | { url: string };
  } | null;
  audience: 'everyone' | 'not_in_a_team' | 'in_a_team';
}

/**
 * How long one stays away once closed with the "×". "Don't show again" is what
 * makes it permanent; closing is only "not now".
 */
export const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The most that are ever waiting. They take turns in one slot rather than
 * stacking: every one stacked is a row of notes pushed down on every visit, and
 * the third banner is the one nobody reads.
 */
export const MAX_ANNOUNCEMENTS = 3;

/** What this reader should see, in the order the server gave. */
export function announcementsToShow(
  all: readonly Announcement[],
  prefs: AnnouncementPreferences,
  now: number,
  reader: { inTeam: boolean },
): Announcement[] {
  if (!prefs.enabled) return [];
  return all
    .filter((item) => !prefs.dismissed.includes(item.id))
    .filter((item) => (prefs.snoozedUntil[item.id] ?? 0) <= now)
    .filter((item) => {
      if (item.audience === 'everyone') return true;
      return item.audience === 'in_a_team' ? reader.inTeam : !reader.inTeam;
    })
    .slice(0, MAX_ANNOUNCEMENTS);
}
