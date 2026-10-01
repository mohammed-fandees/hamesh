import { useCallback, useEffect, useState } from 'react';
import type { Comment, TeamMember, TeamResponse } from '@hamesh/teams-contract';
import { newRequestId } from '@/teams/operation-names';
import { relativeTime } from '../format';
import type { Lang } from '../i18n';
import { Avatar } from '../kit/Avatar';
import { EmptyState } from '../kit/EmptyState';
import { InlineError } from '../kit/Feedback';
import { InlineConfirm } from '../kit/InlineConfirm';
import { Skeleton } from '../kit/Skeleton';
import { CommentComposer } from './CommentComposer';
import { MentionText } from './MentionText';
import { commentRights, teamCan } from './permissions';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';

interface CommentThreadProps {
  strings: TeamsStrings;
  lang: Lang;
  page: TeamsPage;
  team: TeamResponse;
  noteId: string;
  myUserId: string;
  members: TeamMember[] | null;
}

/**
 * One note's discussion.
 *
 * Comments are read where they are written — here, in Hamesh's own page — and
 * never on the web page the note is attached to: the background worker answers
 * Teams messages only from the extension's own pages, and a content script runs
 * inside whatever page it is on.
 *
 * The socket says only that a note's comments moved on; this is where that is
 * acted upon, by fetching them again through the ordinary authorized path. So a
 * poke that arrives for someone who has just lost access shows them nothing.
 */
export function CommentThread({
  strings,
  lang,
  page,
  team,
  noteId,
  myUserId,
  members,
}: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [nextAfter, setNextAfter] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  /** Replies fetched in full for a thread whose inline few were not all of them. */
  const [expanded, setExpanded] = useState<Record<string, Comment[]>>({});
  /** The one comment waiting to be confirmed gone. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const teamId = team.team.id;

  const nameOf = useCallback(
    (userId: string) => members?.find((m) => m.userId === userId)?.displayName,
    [members],
  );

  /** Reads the thread from the start: short, and always the server's version. */
  const load = useCallback(async () => {
    const result = await page.run('comments.list', { teamId, noteId });
    if (!result) return;
    setComments(result.comments);
    setNextAfter(result.nextAfter);
    setExpanded({});
    // `page` is rebuilt on every render of the page above; the note is what
    // decides whose comments these are.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, noteId]);

  // The await is inlined rather than calling `load()`, for the same reason as
  // everywhere else on this page: state set on an effect's synchronous path
  // cascades an extra render.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await page.run('comments.list', { teamId, noteId });
      if (cancelled || !result) return;
      setComments(result.comments);
      setNextAfter(result.nextAfter);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, noteId]);

  // Somebody else said something. The notice carries ids and nothing else, so
  // this reads the thread again rather than trusting what arrived.
  useEffect(() => {
    return page.onEvent((event) => {
      if (event.teamId === teamId && event.noteId === noteId) void load();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, noteId, load]);

  async function more() {
    if (!nextAfter) return;
    const result = await page.run(
      'comments.list',
      { teamId, noteId, after: nextAfter },
      'comments.more',
    );
    if (!result) return;
    setComments((prev) => [...(prev ?? []), ...result.comments]);
    setNextAfter(result.nextAfter);
  }

  async function showReplies(comment: Comment) {
    const result = await page.run(
      'comments.replies',
      { teamId, commentId: comment.id },
      `comment:${comment.id}`,
    );
    if (!result) return;
    setExpanded((prev) => ({ ...prev, [comment.id]: result.replies }));
  }

  async function post(body: string, mentions: string[], parentId?: string) {
    const created = await page.run(
      'comments.create',
      {
        teamId,
        noteId,
        requestId: newRequestId(),
        body,
        ...(parentId ? { parentId } : {}),
        ...(mentions.length > 0 ? { mentions } : {}),
      },
      parentId ? `comment:${parentId}` : 'comments.create',
    );
    if (!created) return;
    setReplyingTo(null);
    await load();
  }

  async function saveEdit(commentId: string, body: string, mentions: string[]) {
    const saved = await page.run(
      'comments.update',
      { teamId, commentId, body, ...(mentions.length > 0 ? { mentions } : {}) },
      `comment:${commentId}`,
    );
    setEditing(null);
    if (saved) await load();
  }

  async function remove(comment: Comment) {
    const gone = await page.run(
      'comments.delete',
      { teamId, commentId: comment.id },
      `comment:${comment.id}`,
    );
    setConfirming(null);
    if (gone !== null) await load();
  }

  const mayComment = teamCan(team, 'comments.create');

  function one(comment: Comment, isReply: boolean) {
    const key = `comment:${comment.id}`;
    const author = comment.authorId ? nameOf(comment.authorId) : undefined;
    const may = commentRights(team, comment.authorId, myUserId);
    return (
      <li key={comment.id} className="hm-comment" data-reply={isReply}>
        <Avatar name={comment.deleted ? null : author} />
        <div className="hm-comment__content">
          <span className="hm-comment__meta">
            <bdi className="hm-comment__author">{author ?? strings.formerMember}</bdi> ·{' '}
            {strings.commentedAgo(relativeTime(comment.createdAt, lang))}
            {comment.editedAt !== null && ` · ${strings.commentEdited}`}
          </span>
          {editing === comment.id && members ? (
            <CommentComposer
              strings={strings}
              members={members}
              placeholder={strings.commentPlaceholder}
              submitLabel={strings.save}
              initialBody={comment.body}
              busy={page.working(key)}
              autoFocus
              onSubmit={(next, mentions) => void saveEdit(comment.id, next, mentions)}
              onCancel={() => setEditing(null)}
            />
          ) : comment.deleted ? (
            <p className="hm-comment__gone">{strings.commentDeleted}</p>
          ) : (
            <p className="hm-comment__body" dir="auto">
              <MentionText
                body={comment.body}
                nameOf={nameOf}
                myUserId={myUserId}
                strings={strings}
              />
            </p>
          )}
          {page.failed(key) && <InlineError>{strings.error(page.failed(key)!)}</InlineError>}
          {confirming === comment.id ? (
            <InlineConfirm
              question={strings.deleteCommentConfirm}
              confirmLabel={strings.delete}
              cancelLabel={strings.keepIt}
              working={page.working(key)}
              onConfirm={() => void remove(comment)}
              onCancel={() => setConfirming(null)}
            />
          ) : (
            editing !== comment.id &&
            !comment.deleted && (
              <div className="hm-comment__actions">
                {/* Replies are one level deep, so a reply is not replied to. */}
                {!isReply && mayComment && (
                  <button
                    type="button"
                    className="hm-link"
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  >
                    {strings.replyTo}
                  </button>
                )}
                {may.edit && (
                  <button type="button" className="hm-link" onClick={() => setEditing(comment.id)}>
                    {strings.edit}
                  </button>
                )}
                {may.delete && (
                  <button
                    type="button"
                    className="hm-link hm-link--danger"
                    onClick={() => setConfirming(comment.id)}
                  >
                    {strings.delete}
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </li>
    );
  }

  function thread(comment: Comment) {
    const shown = expanded[comment.id] ?? comment.replies ?? [];
    const total = comment.replyCount ?? shown.length;
    return (
      <li key={comment.id}>
        <ul className="hm-comments">
          {one(comment, false)}
          {shown.map((reply) => one(reply, true))}
          {total > shown.length && (
            <li className="hm-comment hm-comment--more" data-reply="true">
              <button
                type="button"
                className="hm-link hm-link--accent"
                onClick={() => void showReplies(comment)}
              >
                {strings.showReplies(total)}
              </button>
            </li>
          )}
          {replyingTo === comment.id && members && (
            <li className="hm-comment hm-comment--compose" data-reply="true">
              <CommentComposer
                strings={strings}
                members={members}
                placeholder={strings.replyPlaceholder}
                submitLabel={strings.postReply}
                busy={page.working(`comment:${comment.id}`)}
                autoFocus
                onSubmit={(next, mentions) => void post(next, mentions, comment.id)}
                onCancel={() => setReplyingTo(null)}
              />
            </li>
          )}
        </ul>
      </li>
    );
  }

  if (comments === null) return <Skeleton rows={2} />;

  return (
    <div className="hm-section hm-discussion">
      {comments.length === 0 && (
        <EmptyState
          size="inline"
          title={strings.emptyCommentsTitle}
          body={strings.emptyCommentsBody}
        />
      )}
      {comments.length > 0 && <ul className="hm-comments">{comments.map(thread)}</ul>}
      {nextAfter && (
        <button
          type="button"
          className="hm-link hm-link--accent"
          disabled={page.working('comments.more')}
          onClick={() => void more()}
          aria-busy={page.working('comments.more')}
        >
          {strings.showMore}
        </button>
      )}
      {mayComment && members && (
        <div className="hm-discussion__compose">
          <CommentComposer
            strings={strings}
            members={members}
            placeholder={strings.commentPlaceholder}
            submitLabel={strings.postComment}
            busy={page.working('comments.create')}
            hint={strings.composeHint}
            onSubmit={(next, mentions) => void post(next, mentions)}
          />
          {page.failed('comments.create') && (
            <InlineError>{strings.error(page.failed('comments.create')!)}</InlineError>
          )}
        </div>
      )}
    </div>
  );
}
