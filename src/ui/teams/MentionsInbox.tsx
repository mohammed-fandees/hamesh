import { useEffect, useState } from 'react';
import type { MentionEntry } from '@hamesh/teams-contract';
import type { Lang } from '../i18n';
import { relativeTime } from '../i18n';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import { splitBody } from './mentions';

interface MentionsInboxProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  myUserId: string;
}

/**
 * Where this account has been named, newest first, across every team it is in.
 *
 * The server keeps this list, because only it knows every team at once — and it
 * is the one place in Teams the extension asks about the account rather than
 * about one team. Each entry names its team and carries the comment's text.
 *
 * The names in that text are ids, as they are everywhere else, so the member
 * list of each team an entry came from is fetched to read them — the same
 * request the team's own page makes, and only for teams this reader is in.
 */
export function MentionsInbox({ strings, lang, page, myUserId }: MentionsInboxProps) {
  const [entries, setEntries] = useState<MentionEntry[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  /** Learns the names of whoever these entries involve, one team at a time. */
  async function learnNames(from: MentionEntry[], known: Record<string, string>) {
    const teams = [...new Set(from.map((entry) => entry.teamId))];
    const lists = await Promise.all(teams.map((teamId) => page.run('members.list', { teamId })));
    const next = { ...known };
    for (const list of lists) {
      for (const member of list?.members ?? []) next[member.userId] = member.displayName;
    }
    return next;
  }

  // The awaits are inlined rather than calling a loader, as everywhere else on
  // this page: state set on an effect's synchronous path cascades a render.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await page.run('mentions.list', {});
      if (cancelled || !result) return;
      setEntries(result.mentions);
      setNextBefore(result.nextBefore);
      const learned = await learnNames(result.mentions, {});
      if (!cancelled) setNames(learned);
    })();
    return () => {
      cancelled = true;
    };
    // `page` is rebuilt on every render of the page above; this runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function more() {
    if (!nextBefore) return;
    const result = await page.run('mentions.list', { before: nextBefore });
    if (!result) return;
    setEntries((prev) => [...(prev ?? []), ...result.mentions]);
    setNextBefore(result.nextBefore);
    setNames(await learnNames(result.mentions, names));
  }

  const nameOf = (userId: string) => (userId === myUserId ? strings.youMarker : names[userId]);

  if (entries === null) return <p className="hm-setting-row__hint">{strings.working}</p>;
  if (entries.length === 0) return <p className="hm-setting-row__hint">{strings.noMentions}</p>;

  return (
    <>
      <ul className="hm-team-members">
        {entries.map((entry) => (
          <li key={entry.commentId} className="hm-team-member">
            <div className="hm-team-member__who">
              <span className="hm-team-member__meta">
                <bdi>
                  {(entry.authorId ? nameOf(entry.authorId) : undefined) ?? strings.formerMember}
                </bdi>{' '}
                <bdi>{strings.mentionIn(entry.teamName)}</bdi> ·{' '}
                {strings.commentedAgo(relativeTime(new Date(entry.createdAt).toISOString(), lang))}
              </span>
              <p className="hm-comment__body" dir="auto">
                {splitBody(entry.body, nameOf).map((part, i) =>
                  part.kind === 'text' ? (
                    <span key={i}>{part.text}</span>
                  ) : (
                    <span key={i} className="hm-mention" data-me={part.userId === myUserId}>
                      @<bdi>{part.name ?? strings.formerMember}</bdi>
                    </span>
                  ),
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {nextBefore && (
        <button type="button" className="hm-link" disabled={page.busy} onClick={() => void more()}>
          {strings.moreMentions}
        </button>
      )}
    </>
  );
}
