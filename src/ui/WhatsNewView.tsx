import { MarginMark } from './MarginMark';
import {
  RELEASE_NOTES,
  compareVersions,
  localizeReleaseNote,
  type ReleaseNote,
} from '@/domain/release-notes';
import type { Lang, Strings } from './i18n';

interface WhatsNewViewProps {
  strings: Strings;
  lang: Lang;
  /** The version currently installed, from the manifest — so the entry the
   *  user is actually running is marked, rather than assuming it's the
   *  newest one listed (a build can be behind the notes, or ahead of them). */
  currentVersion: string;
  /** The newest version the user has already read, or `null` if they have
   *  never opened this page. Everything above it is marked as new. */
  lastSeenVersion: string | null;
}

/** How many of the newest releases are open whatever the reader has seen. */
const OPEN_ALWAYS = 2;

/**
 * What's New — Hamesh's own history, told to the person using it.
 *
 * A plain reverse-chronological list: this is a page someone reads once after
 * an update and then leaves, so what they have not read is open and the rest of
 * the history waits in a panel that is shut until it is wanted. Content
 * comes from `domain/release-notes.ts` in whichever language the interface
 * is set to, so an Arabic reader gets Arabic release notes, not translated
 * chrome around English text.
 */
export function WhatsNewView({
  strings,
  lang,
  currentVersion,
  lastSeenVersion,
}: WhatsNewViewProps) {
  const isUnseen = (release: ReleaseNote) =>
    lastSeenVersion === null || compareVersions(release.version, lastSeenVersion) > 0;
  // Two are always open; more if more than two have gone unread — someone who
  // skipped three updates should not have to open a panel to see the third.
  const openCount =
    lastSeenVersion === null
      ? OPEN_ALWAYS
      : Math.max(OPEN_ALWAYS, RELEASE_NOTES.filter(isUnseen).length);
  const recent = RELEASE_NOTES.slice(0, openCount);
  const earlier = RELEASE_NOTES.slice(openCount);

  const renderList = (releases: readonly ReleaseNote[], offset: number) => (
    <ol className="hm-whats-new__list">
      {releases.map((release, i) => (
        <li
          key={release.version}
          className="hm-whats-new__release hm-fade-in"
          style={{ animationDelay: `${Math.min((offset + i) * 40, 240)}ms` }}
        >
          <ReleaseEntry
            release={release}
            strings={strings}
            lang={lang}
            installed={compareVersions(release.version, currentVersion) === 0}
            unseen={isUnseen(release)}
          />
        </li>
      ))}
    </ol>
  );

  return (
    <div className="hm-notes-main">
      <div className="hm-notes-page__inner">
        <header className="hm-notes-page__header">
          <MarginMark size={20} strokeWidth={3.5} style={{ color: 'var(--hm-accent)' }} />
          <h1 className="hm-notes-page__title">{strings.whatsNew}</h1>
        </header>
        <p className="hm-whats-new__intro">{strings.whatsNewIntro}</p>

        {renderList(recent, 0)}
        {earlier.length > 0 && (
          <details className="hm-panel hm-panel--releases">
            <summary className="hm-panel__summary">
              <span className="hm-panel__title">{strings.whatsNewEarlier}</span>
              <span className="hm-panel__hint">{strings.whatsNewEarlierHint(earlier.length)}</span>
            </summary>
            <div className="hm-panel__body">{renderList(earlier, recent.length)}</div>
          </details>
        )}
      </div>
    </div>
  );
}

function ReleaseEntry({
  release,
  strings,
  lang,
  installed,
  unseen,
}: {
  release: ReleaseNote;
  strings: Strings;
  lang: Lang;
  installed: boolean;
  unseen: boolean;
}) {
  return (
    <>
      <div className="hm-whats-new__head">
        <span className="hm-whats-new__version">{release.version}</span>
        {installed && (
          <span className="hm-whats-new__badge hm-whats-new__badge--installed">
            {strings.whatsNewCurrentBadge}
          </span>
        )}
        {!installed && unseen && (
          <span className="hm-whats-new__badge">{strings.whatsNewNewBadge}</span>
        )}
        <time className="hm-whats-new__date" dateTime={release.date}>
          {strings.whatsNewReleaseDate(release.date)}
        </time>
      </div>
      <h2 className="hm-whats-new__title">{localizeReleaseNote(release.title, lang)}</h2>
      <ul className="hm-whats-new__items">
        {release.items.map((item, i) => (
          <li key={i} className="hm-whats-new__item">
            {localizeReleaseNote(item, lang)}
          </li>
        ))}
      </ul>
    </>
  );
}
