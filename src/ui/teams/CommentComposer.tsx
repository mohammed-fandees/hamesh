import { useLayoutEffect, useRef, useState } from 'react';
import type { TeamMember } from '@hamesh/teams-contract';
import { MAX_COMMENT_LENGTH, mentionsIn } from '@hamesh/teams-contract/mentions';
import type { TeamsStrings } from './strings';
import { insertMention, mentionQueryAt } from './mentions';

interface CommentComposerProps {
  strings: TeamsStrings;
  /** Who may be named. Only people the server says are in this team. */
  members: TeamMember[];
  placeholder: string;
  submitLabel: string;
  /** Editing an existing comment starts from its body. */
  initialBody?: string;
  busy?: boolean;
  autoFocus?: boolean;
  onSubmit: (body: string, mentions: string[]) => void;
  onCancel?: () => void;
}

/** How many people the picker offers at once. */
const SUGGESTIONS = 6;

/**
 * Writing a comment, and naming people in it.
 *
 * Typing `@` offers the team's own members and nobody else — the list comes
 * from the server's answer, and what goes into the body is the person's id, not
 * their name. So a comment cannot name a stranger, renaming yourself renames you
 * in every comment at once, and no name is ever stored in a body where it could
 * go stale.
 *
 * The `mentions` sent alongside are derived from the body, never collected
 * separately, so the two cannot drift apart — the operation table and the server
 * both refuse a comment whose declared mentions are not exactly the ones its text
 * contains.
 */
export function CommentComposer({
  strings,
  members,
  placeholder,
  submitLabel,
  initialBody = '',
  busy = false,
  autoFocus = false,
  onSubmit,
  onCancel,
}: CommentComposerProps) {
  const [body, setBody] = useState(initialBody);
  const [caret, setCaret] = useState(initialBody.length);
  const [query, setQuery] = useState<{ query: string; start: number } | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  /** Set when a mention was just inserted: the caret has to be put back. */
  const pendingCaret = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // The caret belongs to the DOM, so putting it back is a real side effect and
  // stays in an effect — keyed on the value that only changes when a mention is
  // actually inserted, so it never fires on ordinary typing.
  useLayoutEffect(() => {
    const at = pendingCaret.current;
    if (at === null) return;
    pendingCaret.current = null;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(at, at);
  }, [body]);

  const matches = query
    ? members.filter((m) => m.displayName.toLowerCase().includes(query.query)).slice(0, SUGGESTIONS)
    : [];

  function update(next: string, at: number) {
    setBody(next);
    setCaret(at);
    const found = mentionQueryAt(next, at);
    setQuery(found);
    setHighlighted(0);
  }

  function pick(userId: string) {
    if (!query) return;
    const next = insertMention(body, query.start, caret, userId);
    pendingCaret.current = next.caret;
    setBody(next.body);
    setCaret(next.caret);
    setQuery(null);
  }

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    // Derived from the text itself, so the two always agree.
    onSubmit(trimmed, mentionsIn(trimmed));
    setBody('');
    setQuery(null);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (query && matches.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlighted(
          (i) => (i + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length,
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(matches[highlighted]!.userId);
        return;
      }
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) setQuery(null);
      else onCancel?.();
      return;
    }
    // Enter sends; a newline needs Shift, as everywhere else that comments are
    // written.
    if (e.key === 'Enter' && !e.shiftKey && !query) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="hm-comment-composer">
      <textarea
        ref={textareaRef}
        className="hm-textarea"
        dir="auto"
        rows={2}
        autoFocus={autoFocus}
        maxLength={MAX_COMMENT_LENGTH}
        placeholder={placeholder}
        aria-label={placeholder}
        value={body}
        onChange={(e) => update(e.target.value, e.target.selectionStart)}
        onKeyUp={(e) => update(e.currentTarget.value, e.currentTarget.selectionStart)}
        onClick={(e) => update(e.currentTarget.value, e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
      />

      {query && (
        <ul className="hm-mention-picker" role="listbox" aria-label={strings.mentionHint}>
          {matches.length === 0 && (
            <li className="hm-mention-picker__empty">{strings.mentionNobody}</li>
          )}
          {matches.map((member, i) => (
            <li key={member.userId}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlighted}
                className="hm-mention-picker__item"
                data-highlighted={i === highlighted}
                // The textarea's blur would close the picker before a click
                // landed, so the press is what picks, not the click.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(member.userId);
                }}
              >
                <bdi>{member.displayName}</bdi>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="hm-row">
        {onCancel && (
          <button type="button" className="hm-btn hm-btn-ghost" onClick={onCancel}>
            {strings.cancel}
          </button>
        )}
        <button
          type="button"
          className="hm-btn hm-btn-primary"
          disabled={busy || !body.trim()}
          aria-busy={busy}
          onClick={submit}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
