import { useCallback, useEffect, useState } from 'react';
import type { Comment, TeamAction, TeamMember, TeamResponse } from '@hamesh/teams-contract';
import type { Lang } from '../i18n';
import { relativeTime } from '../i18n';
import type { TeamsStrings } from './strings';
import type { TeamsPage } from './useTeams';
import { newRequestId } from '@/teams/operation-names';
import { CommentComposer } from './CommentComposer';
import { splitBody } from './mentions';

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
  const teamId = team.team.id;
  const can = (action: TeamAction) => team.capabilities.includes(action);

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
    (async () => {
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
    const result = await page.run('comments.list', { teamId, noteId, after: nextAfter });
    if (!result) return;
    setComments((prev) => [...(prev ?? []), ...result.comments]);
    setNextAfter(result.nextAfter);
  }

  async function showReplies(comment: Comment) {
    const result = await page.run('comments.replies', { teamId, commentId: comment.id });
    if (!result) return;
    setExpanded((prev) => ({ ...prev, [comment.id]: result.replies }));
  }

  async function post(body: string, mentions: string[], parentId?: string) {
    const created = await page.run('comments.create', {
      teamId,
      noteId,
      requestId: newRequestId(),
      body,
      ...(parentId ? { parentId } : {}),
      ...(mentions.length > 0 ? { mentions } : {}),
    });
    if (!created) return;
    setReplyingTo(null);
    await load();
  }

  async function saveEdit(commentId: string, body: string, mentions: string[]) {
    const saved = await page.run('comments.update', {
      teamId,
      commentId,
      body,
      ...(mentions.length > 0 ? { mentions } : {}),
    });
    setEditing(null);
    if (saved) await load();
  }

  async function remove(comment: Comment) {
    if (!confirm(strings.deleteCommentConfirm)) return;
    const gone = await page.run('comments.delete', { teamId, commentId: comment.id });
    if (gone !== null) await load();
  }

  const mine = (comment: Comment) => comment.authorId === myUserId;
  const mayEdit = (comment: Comment) => mine(comment) && can('comments.edit_own');
  const mayDelete = (comment: Comment) =>
    can('comments.delete_any') || (mine(comment) && can('comments.delete_own'));

  function body(comment: Comment) {
    if (comment.deleted) return <p className="hm-comment__gone">{strings.commentDeleted}</p>;
    return (
      <p className="hm-comment__body" dir="auto">
        {splitBody(comment.body, nameOf).map((part, i) =>
          part.kind === 'text' ? (
            <span key={i}>{part.text}</span>
          ) : (
            <span key={i} className="hm-mention" data-me={part.userId === myUserId}>
              @<bdi>{part.name ?? strings.formerMember}</bdi>
            </span>
          ),
        )}
      </p>
    );
  }

  function who(comment: Comment) {
    const name = comment.authorId ? nameOf(comment.authorId) : undefined;
    return (
      <span className="hm-comment__meta">
        <bdi>{name ?? strings.formerMember}</bdi> ·{' '}
        {strings.commentedAgo(relativeTime(new Date(comment.createdAt).toISOString(), lang))}
        {comment.editedAt !== null && ` · ${strings.commentEdited}`}
      </span>
    );
  }

  function one(comment: Comment, isReply: boolean) {
    return (
      <li key={comment.id} className="hm-comment" data-reply={isReply}>
        {who(comment)}
        {editing === comment.id && members ? (
          <CommentComposer
            strings={strings}
            members={members}
            placeholder={strings.commentPlaceholder}
            submitLabel={strings.saveComment}
            initialBody={comment.body}
            busy={page.busy}
            autoFocus
            onSubmit={(next, mentions) => void saveEdit(comment.id, next, mentions)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          body(comment)
        )}
        {editing !== comment.id && !comment.deleted && (
          <div className="hm-comment__actions">
            {/* Replies are one level deep, so a reply is not replied to. */}
            {!isReply && can('comments.create') && (
              <button
                type="button"
                className="hm-link"
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              >
                {strings.replyTo}
              </button>
            )}
            {mayEdit(comment) && (
              <button type="button" className="hm-link" onClick={() => setEditing(comment.id)}>
                {strings.editComment}
              </button>
            )}
            {mayDelete(comment) && (
              <button
                type="button"
                className="hm-link hm-link--danger"
                onClick={() => void remove(comment)}
              >
                {strings.deleteComment}
              </button>
            )}
          </div>
        )}
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
            <li className="hm-comment" data-reply="true">
              <button type="button" className="hm-link" onClick={() => void showReplies(comment)}>
                {strings.showReplies(total)}
              </button>
            </li>
          )}
          {replyingTo === comment.id && members && (
            <li className="hm-comment" data-reply="true">
              <CommentComposer
                strings={strings}
                members={members}
                placeholder={strings.replyPlaceholder}
                submitLabel={strings.postReply}
                busy={page.busy}
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

  if (comments === null) return <p className="hm-setting-row__hint">{strings.working}</p>;

  return (
    <div className="hm-comment-thread">
      {comments.length === 0 && <p className="hm-setting-row__hint">{strings.noComments}</p>}
      {comments.length > 0 && <ul className="hm-comments">{comments.map(thread)}</ul>}
      {nextAfter && (
        <button type="button" className="hm-link" disabled={page.busy} onClick={() => void more()}>
          {strings.moreComments}
        </button>
      )}
      {can('comments.create') && members && (
        <CommentComposer
          strings={strings}
          members={members}
          placeholder={strings.commentPlaceholder}
          submitLabel={strings.postComment}
          busy={page.busy}
          onSubmit={(next, mentions) => void post(next, mentions)}
        />
      )}
    </div>
  );
}
