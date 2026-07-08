import { useCallback, useState } from 'react';
import { MarginMark } from './MarginMark';
import type { Strings } from './i18n';

interface ComposerProps {
  strings: Strings;
  saving?: boolean;
  error?: string | null;
  onSave: (content: string) => void;
  onCancel: () => void;
}

/**
 * The note composer — a small card attached to the selected element by a short
 * connector stub. Handles empty/typing/validation/saving/error states.
 */
export function Composer({ strings, saving = false, error, onSave, onCancel }: ComposerProps) {
  const [content, setContent] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) {
      setValidationError(strings.emptyError);
      return;
    }
    setValidationError(null);
    onSave(trimmed);
  }, [content, onSave, strings.emptyError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave, onCancel],
  );

  const displayError = validationError ?? error ?? null;
  const canSave = content.trim().length > 0 && !saving;

  return (
    <div
      className="hm-card"
      role="dialog"
      aria-label={strings.note}
      aria-modal="false"
      onKeyDown={handleKeyDown}
    >
      <span className="hm-connector" aria-hidden="true" />
      <div className="hm-card-label">
        <MarginMark size={11} strokeWidth={4} />
        {strings.note}
      </div>
      <textarea
        className="hm-textarea"
        dir="auto"
        autoFocus
        placeholder={strings.writePlaceholder}
        value={content}
        aria-label={strings.note}
        aria-invalid={displayError ? true : undefined}
        aria-describedby={displayError ? 'hm-composer-error' : undefined}
        onChange={(e) => {
          setContent(e.target.value);
          if (validationError) setValidationError(null);
        }}
      />
      {displayError && (
        <p id="hm-composer-error" className="hm-error" role="alert">
          {displayError}
        </p>
      )}
      <div className="hm-row">
        <button type="button" className="hm-btn hm-btn-ghost" onClick={onCancel}>
          {strings.cancel}
        </button>
        <button
          type="button"
          className="hm-btn hm-btn-primary"
          onClick={handleSave}
          disabled={!canSave}
        >
          {saving ? strings.saving : strings.save}
        </button>
      </div>
    </div>
  );
}
