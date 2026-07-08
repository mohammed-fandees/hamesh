import { useCallback, useRef, useState } from 'react';
import type { Note } from '@/domain/note';
import type { Lang, Strings } from './i18n';
import { relativeTime } from './i18n';

interface NoteViewerProps {
  note: Note;
  strings: Strings;
  lang: Lang;
  anchorAvailable: boolean;
  saving?: boolean;
  error?: string | null;
  onUpdate: (content: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Note viewer / editor — opens a saved note back up. Supports viewing, editing,
 * a delete confirmation step, and an "anchor unavailable" fallback state.
 */
export function NoteViewer({
  note,
  strings,
  lang,
  anchorAvailable,
  saving = false,
  error,
  onUpdate,
  onDelete,
  onClose,
}: NoteViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const startEdit = useCallback(() => {
    setEditContent(note.content);
    setIsEditing(true);
  }, [note.content]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (isEditing) setIsEditing(false);
      else if (confirmDelete) setConfirmDelete(false);
      else onClose();
    },
    [isEditing, confirmDelete, onClose],
  );

  const handleSaveEdit = useCallback(() => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    onUpdate(trimmed);
    setIsEditing(false);
  }, [editContent, onUpdate]);

  return (
    <div
      className="hm-card"
      role="dialog"
      aria-label={isEditing ? strings.edit : strings.note}
      onKeyDown={handleKeyDown}
    >
      <span className="hm-connector" data-unavailable={!anchorAvailable} aria-hidden="true" />

      {!anchorAvailable && (
        <div className="hm-status hm-status--warning" role="status">
          <span className="hm-dot" />
          {strings.anchorUnavailable}
        </div>
      )}

      {isEditing ? (
        <textarea
          className="hm-textarea"
          dir="auto"
          autoFocus
          value={editContent}
          aria-label={strings.edit}
          onChange={(e) => setEditContent(e.target.value)}
        />
      ) : (
        <p className="hm-note-body" dir="auto">
          {note.content}
        </p>
      )}

      {error && (
        <p className="hm-error" role="alert">
          {error}
        </p>
      )}

      {isEditing ? (
        <div className="hm-row">
          <button type="button" className="hm-btn hm-btn-ghost" onClick={() => setIsEditing(false)}>
            {strings.cancel}
          </button>
          <button
            type="button"
            className="hm-btn hm-btn-primary"
            onClick={handleSaveEdit}
            disabled={!editContent.trim() || saving}
          >
            {saving ? strings.saving : strings.saveChanges}
          </button>
        </div>
      ) : confirmDelete ? (
        <>
          <p className="hm-note-body" style={{ fontFamily: 'var(--hm-sans)', fontSize: '13.5px' }}>
            {strings.deleteConfirm}
          </p>
          <div className="hm-row">
            <button
              type="button"
              className="hm-btn hm-btn-ghost"
              onClick={() => setConfirmDelete(false)}
            >
              {strings.keepIt}
            </button>
            <button
              type="button"
              className="hm-btn hm-btn-danger"
              onClick={onDelete}
              disabled={saving}
            >
              {strings.delete}
            </button>
          </div>
        </>
      ) : (
        <div className="hm-row hm-row--between">
          <span className="hm-meta">{strings.editedAgo(relativeTime(note.updatedAt, lang))}</span>
          <span style={{ display: 'flex', gap: 'var(--hm-space-4)' }}>
            <button type="button" className="hm-link" onClick={startEdit}>
              {strings.edit}
            </button>
            <button
              type="button"
              className="hm-link hm-link--danger"
              onClick={() => setConfirmDelete(true)}
            >
              {strings.delete}
            </button>
          </span>
        </div>
      )}

      <button
        ref={closeRef}
        type="button"
        className="hm-close"
        onClick={onClose}
        aria-label={strings.cancel}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M3 3 L9 9 M9 3 L3 9"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
