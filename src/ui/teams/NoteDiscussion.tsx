import { useCallback, useEffect, useState } from 'react';
import type { Note } from '@/domain/note';
import type { TeamNotesSource } from '@/teams/page-notes';
import { MAX_COMMENT_LENGTH } from '@hamesh/teams-contract/mentions';
import type { ThreadPreview } from '@/teams/page-channel';
import type { TeamsErrorCode } from '@/teams/errors';
import { relativeTime } from '../format';
import type { Lang } from '../i18n';
import { Avatar } from '../kit/Avatar';
import { InlineError } from '../kit/Feedback';
import { ChevronIcon } from '../kit/icons';
import { getTeamsStrings } from './strings';
import css from './page.css?inline';

interface NoteDiscussionProps {
  /** A team's note — the one whose popup this sits in. */
  note: Note & { team: NonNullable<Note['team']> };
  lang: Lang;
  source: TeamNotesSource;
}

/**
 * A shared note's discussion, at the foot of its popup on the page: the latest
 * of what was said, a field to add to it, and the way to the whole of it.
 *
 * The page holds no session and no member list; what it shows and sends goes
 * through the worker's narrow page channel, which answers only for a note
 * cached for this very page. The field is plain text — naming people with @
 * is done where the whole discussion is.
 */
export function NoteDiscussion({ note, lang, source }: NoteDiscussionProps) {
  const strings = getTeamsStrings(lang);
  const { id: teamId } = note.team;
  const [preview, setPreview] = useState<ThreadPreview | null>(null);
  const [failed, setFailed] = useState<TeamsErrorCode | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const result = await source.thread(teamId, note.id);
    if (result.ok) setPreview(result.data);
    else setFailed(result.error);
  }, [source, teamId, note.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await source.thread(teamId, note.id);
      if (cancelled) return;
      if (result.ok) setPreview(result.data);
      else setFailed(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [source, teamId, note.id]);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setFailed(null);
    const result = await source.reply(teamId, note.id, body);
    setSending(false);
    if (!result.ok) {
      setFailed(result.error);
      return;
    }
    setDraft('');
    await load();
  }

  return (
    <section className="hm-thread" aria-label={strings.comments}>
      <style>{css}</style>
      {preview && preview.latest.length > 0 && (
        <ol className="hm-thread__lines">
          {preview.latest.map((line) => (
            <li key={line.id} className="hm-thread__line">
              <Avatar name={line.author} />
              <span className="hm-thread__said">
                <span className="hm-thread__meta">
                  <bdi className="hm-thread__author">{line.author ?? strings.formerMember}</bdi>
                  {' · '}
                  {relativeTime(line.createdAt, lang)}
                </span>
                <p className="hm-thread__body" dir="auto">
                  {line.body}
                </p>
              </span>
            </li>
          ))}
        </ol>
      )}
      {preview && preview.total === 0 && (
        <p className="hm-thread__empty">{strings.emptyCommentsTitle}</p>
      )}
      {preview && (
        <button
          type="button"
          className="hm-link hm-link--accent hm-thread__open"
          onClick={() => void source.openDiscussion(teamId, note.id)}
        >
          {strings.openWholeDiscussion(preview.total)}
        </button>
      )}

      <form
        className="hm-reply"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          className="hm-reply__field"
          rows={1}
          dir="auto"
          maxLength={MAX_COMMENT_LENGTH}
          placeholder={strings.quickReplyPlaceholder}
          aria-label={strings.quickReplyPlaceholder}
          value={draft}
          disabled={sending}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter starts a new line — as every comment field.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.stopPropagation();
              void send();
            }
          }}
        />
        <button
          type="submit"
          className="hm-reply__send"
          aria-label={strings.postComment}
          disabled={sending || !draft.trim()}
          aria-busy={sending}
        >
          <ChevronIcon direction="forward" size={14} />
        </button>
      </form>
      {failed && <InlineError>{strings.error(failed)}</InlineError>}
    </section>
  );
}
