import { useEffect, useState } from 'react';
import type { MentionEntry } from '@hamesh/teams-contract';
import type { TeamsClient } from '@/teams/client';
import type { Lang } from '../i18n';
import { relativeTime } from '../i18n';
import { MarginMark } from '../MarginMark';
import { getTeamsStrings } from './strings';
import './styles';
import { useTeams } from './useTeams';
import { splitBody } from './mentions';

interface MentionsInboxProps {
  lang: Lang;
  client: TeamsClient;
  /** The newest entry shown, so the sidebar's dot can be put out. */
  onRead: (commentId: string) => void;
  /** Opens the note an entry was written about, and its discussion. */
  onOpenNote?: (teamId: string, noteId: string) => void;
}

/**
 * Where this account has been named, newest first, across every team it is in.
 *
 * A destination of its own, not a section inside one team's page: being named
 * is the one thing in Teams addressed to this person rather than to a team, and
 * it can come from any of them.
 *
 * The server keeps the list, because only it sees every team at once. The names
 * inside each entry are ids, as they are everywhere else, so the member list of
 * each team an entry came from is fetched to read them — the same request that
 * team's own page makes, and only for teams this reader is in.
 */
export function MentionsInbox({ lang, client, onRead, onOpenNote }: MentionsInboxProps) {
  const strings = getTeamsStrings(lang);
  const page = useTeams(client);
  const [entries, setEntries] = useState<MentionEntry[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const myUserId = page.me?.user.id ?? null;

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
      const result = await page.run('mentions.list', {}, 'mentions.list');
      if (cancelled || !result) return;
      setEntries(result.mentions);
      setNextBefore(result.nextBefore);
      // Opening this page is reading it, so the dot goes out now rather than
      // behind some "mark as read" nobody would press.
      const newest = result.mentions[0]?.commentId;
      if (newest) onRead(newest);
      const learned = await learnNames(result.mentions, {});
      if (!cancelled) setNames(learned);
    })();
    return () => {
      cancelled = true;
    };
    // `page` is rebuilt on every render; this runs once, for this client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  async function more() {
    if (!nextBefore) return;
    const result = await page.run('mentions.list', { before: nextBefore }, 'mentions.more');
    if (!result) return;
    setEntries((prev) => [...(prev ?? []), ...result.mentions]);
    setNextBefore(result.nextBefore);
    setNames(await learnNames(result.mentions, names));
  }

  const nameOf = (userId: string) => (userId === myUserId ? strings.youMarker : names[userId]);

  if (page.status && page.status.state !== 'signed_in') {
    return (
      <div className="hm-empty hm-fade-in">
        <MarginMark size={28} strokeWidth={3} />
        <p className="hm-empty__title">{strings.signedOutTitle}</p>
        <p className="hm-empty__body">{strings.signedOutBody}</p>
      </div>
    );
  }

  if (entries === null) {
    return (
      <div className="hm-skeleton" aria-hidden="true">
        <div className="hm-skeleton__row" />
        <div className="hm-skeleton__row" />
        <div className="hm-skeleton__row" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="hm-empty hm-fade-in">
        <MarginMark size={28} strokeWidth={3} />
        <p className="hm-empty__title">{strings.emptyMentionsTitle}</p>
        <p className="hm-empty__body">{strings.emptyMentionsBody}</p>
      </div>
    );
  }

  return (
    <>
      <ul className="hm-mentions">
        {entries.map((entry) => (
          <li key={entry.commentId} className="hm-mention-entry">
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
            {onOpenNote && (
              <button
                type="button"
                className="hm-link hm-link--accent hm-mention-entry__open"
                onClick={() => onOpenNote(entry.teamId, entry.noteId)}
              >
                {strings.openNote}
              </button>
            )}
          </li>
        ))}
      </ul>
      {nextBefore && (
        <button
          type="button"
          className="hm-link"
          disabled={page.working('mentions.more')}
          onClick={() => void more()}
          aria-busy={page.working('mentions.more')}
        >
          {strings.moreMentions}
        </button>
      )}
    </>
  );
}
