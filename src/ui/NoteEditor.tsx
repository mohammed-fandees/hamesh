import { useId, useState, type ReactNode } from 'react';
import { validateNoteContent } from '@/domain/note';
import { InlineError } from './kit/Feedback';
import { escapeLayer, isSubmitChord } from './kit/keys';
import type { Strings } from './i18n';

interface NoteEditorProps {
  strings: Strings;
  /** Where the words start — empty for a new note, the note's own for an edit. */
  initial?: string;
  /** The field's accessible name. */
  label: string;
  placeholder?: string;
  /** "Save", "Save changes". */
  saveLabel: string;
  /** A save is in flight: the button keeps its word and gains an arc. */
  saving?: boolean;
  /** A save that failed, in the reader's words. */
  error?: string | null;
  /** Between the words and the buttons — the composer's folder picker. */
  children?: ReactNode;
  /** Called with the words trimmed, and only once they are a valid note. */
  onSave: (content: string) => void;
  onCancel: () => void;
}

/**
 * Writing a note's words, wherever that happens: composing one on a web page,
 * editing one in its viewer, in the Library's menu, or on a team note's page.
 *
 * One editor, so one contract: the words are checked by the domain's own rule
 * (`validateNoteContent` — the same one the repository enforces), Ctrl/⌘+Enter
 * saves, Escape backs out of the editing alone, and a failed save is said here,
 * beside the words, never swallowed.
 */
export function NoteEditor({
  strings,
  initial = '',
  label,
  placeholder,
  saveLabel,
  saving = false,
  error,
  children,
  onSave,
  onCancel,
}: NoteEditorProps) {
  const [content, setContent] = useState(initial);
  const [invalid, setInvalid] = useState<string | null>(null);
  const errorId = useId();
  const shown = invalid ?? error ?? null;
  const empty = content.trim().length === 0;

  function save() {
    if (saving) return;
    const problem = validateNoteContent(content);
    if (problem) {
      setInvalid(empty ? strings.emptyError : strings.noteTooLong);
      return;
    }
    setInvalid(null);
    onSave(content.trim());
  }

  return (
    <div
      className="hm-note-editor"
      onKeyDown={(e) => {
        if (isSubmitChord(e)) {
          e.preventDefault();
          save();
        } else {
          escapeLayer(onCancel)(e);
        }
      }}
    >
      <textarea
        className="hm-textarea hm-prose"
        dir="auto"
        autoFocus
        placeholder={placeholder}
        value={content}
        aria-label={label}
        aria-invalid={shown ? true : undefined}
        aria-describedby={shown ? errorId : undefined}
        onChange={(e) => {
          setContent(e.target.value);
          if (invalid) setInvalid(null);
        }}
      />
      {children}
      {shown && <InlineError id={errorId}>{shown}</InlineError>}
      <div className="hm-row">
        <button type="button" className="hm-btn hm-btn-ghost" onClick={onCancel}>
          {strings.cancel}
        </button>
        <button
          type="button"
          className="hm-btn hm-btn-primary"
          onClick={save}
          disabled={empty || saving}
          aria-busy={saving}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
