import { useEffect, useRef } from 'react';
import type { TeamsStrings } from './strings';

interface InlineConfirmProps {
  /** What is about to happen, and to whom — a full sentence, ending in a question. */
  question: string;
  /** The word on the button that goes through with it. */
  confirmLabel: string;
  strings: TeamsStrings;
  /** True while it is happening, once confirmed. */
  working?: boolean;
  /** Softens the confirm button for something that is not destructive. */
  tone?: 'danger' | 'plain';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * "Are you sure?", asked where the thing is — never in a dialog.
 *
 * Hamesh confirms in place everywhere else (the note viewer's delete step, the
 * actions menu's), and `window.confirm` is the one thing on the Teams page that
 * broke that: an unstyled box, in the browser's own language rather than the
 * reader's, dropped over a page that cannot say anything more about what is
 * about to happen. This is the row itself asking.
 *
 * Escape backs out, and the cautious answer takes the focus, so nothing
 * irreversible is a stray Enter away.
 */
export function InlineConfirm({
  question,
  confirmLabel,
  strings,
  working = false,
  tone = 'danger',
  onConfirm,
  onCancel,
}: InlineConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus is a real side effect on a real element, so it stays in an effect —
  // and it runs once, when the question appears.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      className="hm-confirm"
      role="group"
      aria-label={question}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }}
    >
      <span className="hm-confirm__question">{question}</span>
      <button
        ref={cancelRef}
        type="button"
        className="hm-btn hm-btn-ghost"
        disabled={working}
        onClick={onCancel}
      >
        {strings.keepIt}
      </button>
      <button
        type="button"
        className={tone === 'danger' ? 'hm-btn hm-btn-danger' : 'hm-btn hm-btn-primary'}
        disabled={working}
        onClick={onConfirm}
      >
        {working ? strings.working : confirmLabel}
      </button>
    </div>
  );
}
