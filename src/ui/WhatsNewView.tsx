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

/**
 * What's New — Hamesh's own history, told to the person using it.
 *
 * A plain reverse-chronological list rather than anything interactive: this
 * is a page someone reads once after an update and then leaves. Content
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
  return (
    <div className="hm-notes-main">
      <div className="hm-notes-page__inner">
        <header className="hm-notes-page__header">
          <MarginMark size={20} strokeWidth={3.5} style={{ color: 'var(--hm-accent)' }} />
          <h1 className="hm-notes-page__title">{strings.whatsNew}</h1>
        </header>
        <p className="hm-whats-new__intro">{strings.whatsNewIntro}</p>

        <ol className="hm-whats-new__list">
          {RELEASE_NOTES.map((release, i) => (
            <li
              key={release.version}
              className="hm-whats-new__release hm-fade-in"
              style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}
            >
              <ReleaseEntry
                release={release}
                strings={strings}
                lang={lang}
                installed={compareVersions(release.version, currentVersion) === 0}
                unseen={
                  lastSeenVersion === null || compareVersions(release.version, lastSeenVersion) > 0
                }
              />
            </li>
          ))}
        </ol>
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
