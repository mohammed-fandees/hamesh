import { Page, PageHeader } from './kit/Page';
import { Panel } from './kit/Section';
import { stagger } from './kit/motion';
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
          style={stagger(offset + i)}
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
    <Page>
      <PageHeader title={strings.whatsNew} />
      <p className="hm-whats-new__intro">{strings.whatsNewIntro}</p>

      {renderList(recent, 0)}
      {earlier.length > 0 && (
        <Panel title={strings.whatsNewEarlier} hint={strings.whatsNewEarlierHint(earlier.length)}>
          {renderList(earlier, recent.length)}
        </Panel>
      )}
    </Page>
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
          <li key={i} className="hm-whats-new__item hm-serif">
            {localizeReleaseNote(item, lang)}
          </li>
        ))}
      </ul>
    </>
  );
}
