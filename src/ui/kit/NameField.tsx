import { useState } from 'react';
import { nameProblem } from '@/domain/folder';
import { escapeLayer } from './keys';

interface NameFieldProps {
  /** The field's accessible name — "New folder", "Rename folder", "Team name". */
  label: string;
  initial?: string;
  placeholder?: string;
  maxLength: number;
  submitLabel: string;
  cancelLabel: string;
  busy?: boolean;
  /**
   * Whether this name is already in use, asked on every keystroke. Saying so
   * there and then stops the field being submitted, and offers a free name
   * instead, the way Windows names a second folder.
   */
  conflict?: (name: string) => NameConflict | null;
  /** Called with the name trimmed, and only when it is valid. */
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export interface NameConflict {
  message: string;
  /** A name that is free, and the words on the button that takes it. */
  suggestion: string;
  useLabel: string;
}

/**
 * Naming something, in place: a folder in the Library, in the composer, in a
 * team; a new team; a team being renamed. One field on one rule
 * (`nameProblem`), so every name is trimmed, refused when empty, and held to
 * its limit the same way — before this, the
 * same rule was written five times at five strictness levels, and a folder
 * renamed on the Teams page could keep the spaces around its name.
 *
 * Enter saves; Escape backs out of the naming alone, never out of whatever it
 * sits in (the composer, a menu).
 */
export function NameField({
  label,
  initial = '',
  placeholder,
  maxLength,
  submitLabel,
  cancelLabel,
  busy = false,
  conflict,
  onSubmit,
  onCancel,
}: NameFieldProps) {
  const [value, setValue] = useState(initial);
  const clash = conflict && value.trim() ? conflict(value.trim()) : null;
  const valid = nameProblem(value, maxLength) === null && !clash;
  const submit = () => {
    if (valid && !busy) onSubmit(value.trim());
  };

  return (
    <form
      className="hm-name-field"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        submit();
      }}
    >
      <input
        type="text"
        className="hm-input hm-name-field__input"
        dir="auto"
        autoFocus
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={label}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Both keys are this field's alone: Enter must not also reach the
          // card or menu it sits in, nor Escape close them.
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.stopPropagation();
            submit();
          } else {
            escapeLayer(onCancel)(e);
          }
        }}
      />
      <button
        type="submit"
        className="hm-btn hm-btn-primary hm-btn--compact"
        disabled={!valid || busy}
        aria-busy={busy}
      >
        {submitLabel}
      </button>
      <button type="button" className="hm-btn hm-btn-ghost hm-btn--compact" onClick={onCancel}>
        {cancelLabel}
      </button>
      {clash && (
        <p className="hm-name-field__conflict" role="status">
          <span>{clash.message}</span>
          <button
            type="button"
            className="hm-link hm-link--accent"
            disabled={busy}
            onClick={() => onSubmit(clash.suggestion)}
          >
            <bdi>{clash.useLabel}</bdi>
          </button>
        </p>
      )}
    </form>
  );
}
