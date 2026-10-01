import { useEffect, useRef } from 'react';
import { escapeLayer } from './keys';

interface InlineConfirmProps {
  /** What is about to happen, and to whom — a full sentence, ending in a question. */
  question: string;
  /** The word on the button that goes through with it. */
  confirmLabel: string;
  /** The word on the button that backs out — "Keep it", in Hamesh. */
  cancelLabel: string;
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
 * The one way Hamesh confirms anything: deleting a note on the page or in the
 * Library, deleting a folder, removing someone from a team, leaving one. There
 * are no native dialogs anywhere in Hamesh (`tests/ui/no-native-dialogs`): a
 * browser's box is unstyled, in the browser's language rather than the
 * reader's, and dropped over a page that cannot say anything more about what is
 * about to happen. This is the row itself asking.
 *
 * Escape backs out of this question alone, and the cautious answer takes the
 * focus, so nothing irreversible is a stray Enter away.
 */
export function InlineConfirm({
  question,
  confirmLabel,
  cancelLabel,
  working = false,
  tone = 'danger',
  onConfirm,
  onCancel,
}: InlineConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus is a real side effect on a real element, so it stays in an effect —
  // and it runs once, when the question appears.
  useEffect(() => {
    cancelRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className="hm-confirm"
      data-tone={tone}
      role="group"
      aria-label={question}
      onKeyDown={escapeLayer(onCancel)}
    >
      <span className="hm-confirm__question">{question}</span>
      <span className="hm-confirm__answers">
        <button
          ref={cancelRef}
          type="button"
          className="hm-btn hm-btn-ghost"
          disabled={working}
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className={tone === 'danger' ? 'hm-btn hm-btn-danger' : 'hm-btn hm-btn-primary'}
          disabled={working}
          onClick={onConfirm}
          aria-busy={working}
        >
          {confirmLabel}
        </button>
      </span>
    </div>
  );
}
