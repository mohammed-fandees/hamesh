import { useCallback, useState } from 'react';

interface VideoQuickNoteProps {
  placeholder: string;
  label: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

/**
 * The ≤3-second video capture popup — deliberately not `Composer` with a
 * "compact" mode: no label bar, no visible Save/Cancel buttons, no
 * error/busy states. Enter saves, Shift+Enter inserts a newline, Escape
 * closes. Enter on empty content just closes rather than showing a
 * validation error — the point is to never interrupt watching, and an
 * accidental Alt+H-then-Enter with nothing typed is a cancel, not a mistake
 * to correct. The caller unmounts this immediately on save/cancel — there
 * is no "saving…" state to show.
 */
export function VideoQuickNote({ placeholder, label, onSave, onCancel }: VideoQuickNoteProps) {
  const [content, setContent] = useState('');

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const trimmed = content.trim();
        if (trimmed) onSave(trimmed);
        else onCancel();
      }
    },
    [content, onSave, onCancel],
  );

  return (
    <div className="hm-card hm-video-quick-note" role="dialog" aria-label={label}>
      <textarea
        className="hm-textarea"
        dir="auto"
        autoFocus
        placeholder={placeholder}
        value={content}
        aria-label={label}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
