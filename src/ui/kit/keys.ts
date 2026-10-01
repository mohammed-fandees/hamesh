/**
 * The two keyboard rules every writing surface in Hamesh follows.
 *
 * - Ctrl/⌘+Enter saves anything written over several lines — a note being
 *   composed, a note being edited, wherever that happens.
 * - Escape backs out one level at a time: the innermost thing handles it and
 *   stops it there, so naming a folder inside the composer closes the naming,
 *   not the composer; a question inside a menu closes the question, not the
 *   menu. Nothing keeps a ladder of its own — the DOM's own bubbling is the
 *   ladder, and each layer only has to stop the key it took.
 */
export function isSubmitChord(e: { key: string; ctrlKey: boolean; metaKey: boolean }): boolean {
  return e.key === 'Enter' && (e.ctrlKey || e.metaKey);
}

/** A keydown handler for one layer: Escape runs `back` and goes no further. */
export function escapeLayer(back: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    back();
  };
}
