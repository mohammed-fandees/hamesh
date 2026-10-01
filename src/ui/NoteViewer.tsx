import { useState, type ReactNode } from 'react';
import { mayMutateNote, type Note } from '@/domain/note';
import { AttachedText } from './AttachedText';
import { relativeTime } from './format';
import { InlineError, StatusLine } from './kit/Feedback';
import { InlineConfirm } from './kit/InlineConfirm';
import { CloseIcon, PinIcon } from './kit/icons';
import { escapeLayer } from './kit/keys';
import { NoteEditor } from './NoteEditor';
import type { Lang, Strings } from './i18n';

interface NoteViewerProps {
  note: Note;
  strings: Strings;
  lang: Lang;
  anchorAvailable: boolean;
  /** Overrides the "anchor unavailable" wording — a contextual text note
   *  can't find its *text*, which is a different thing to say than an
   *  element note showing its last known position. */
  unavailableLabel?: string;
  /** For a contextual text note: the page text it's attached to, shown
   *  above the note itself. Absent for every other kind of note. */
  attachedText?: string;
  /** "Shared with <team>" for a note that belongs to a team rather than to
   *  this device — supplied by the content script only in builds that have
   *  Teams. Its note is shown read-only: edit, delete and pin all belong to
   *  Hamesh's own pages, which are the only place allowed to ask the server. */
  sharedLabel?: string;
  /** A team note's discussion, at the foot of the card — supplied by the
   *  content script only in builds that have Teams. */
  discussion?: ReactNode;
  /** Opens straight into edit mode. Used by the hover popup's Edit button,
   *  so editing a contextual note goes through this exact component (and
   *  therefore this exact update flow) rather than a second editor. */
  initialEditing?: boolean;
  saving?: boolean;
  error?: string | null;
  /** Resolves to whether the words were saved; the editor stays open, with
   *  the failure beside it, when they were not. */
  onUpdate: (content: string) => Promise<boolean>;
  onDelete: () => void;
  onClose: () => void;
  onTogglePin: () => void;
}

/**
 * A saved note, opened on the page it belongs to: read it, pin it, edit it
 * (with the one note editor), delete it (asked in place), or see that its
 * anchor could not be found — the one state only this viewer has.
 *
 * Escape backs out one level at a time — the editor, then the question, then
 * the card — because each of those takes the key first and stops it there.
 */
export function NoteViewer({
  note,
  strings,
  lang,
  anchorAvailable,
  unavailableLabel,
  attachedText,
  sharedLabel,
  discussion,
  initialEditing = false,
  saving = false,
  error,
  onUpdate,
  onDelete,
  onClose,
  onTogglePin,
}: NoteViewerProps) {
  // A note that lives in a team is read here and changed elsewhere.
  const own = mayMutateNote(note);
  const [editing, setEditing] = useState(initialEditing && own);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const edited = strings.editedAgo(relativeTime(note.updatedAt, lang));

  return (
    <div
      className="hm-card hm-viewer-card"
      role="dialog"
      aria-label={editing ? strings.edit : strings.note}
      onKeyDown={escapeLayer(onClose)}
    >
      <span className="hm-connector" data-unavailable={!anchorAvailable} aria-hidden="true" />

      {own && (
        <button
          type="button"
          className="hm-icon-btn hm-icon-btn--small hm-corner-start"
          aria-pressed={!!note.pinned}
          aria-label={note.pinned ? strings.unpinNote : strings.pinNote}
          onClick={onTogglePin}
        >
          <PinIcon filled={!!note.pinned} />
        </button>
      )}

      {!anchorAvailable && (
        <StatusLine tone="warning">{unavailableLabel ?? strings.anchorUnavailable}</StatusLine>
      )}

      {attachedText && <AttachedText label={strings.attachedText} text={attachedText} />}

      {editing ? (
        <NoteEditor
          strings={strings}
          initial={note.content}
          label={strings.edit}
          saveLabel={strings.saveChanges}
          saving={saving}
          error={error}
          onCancel={() => setEditing(false)}
          onSave={async (content) => {
            if (await onUpdate(content)) setEditing(false);
          }}
        />
      ) : (
        <>
          <p className="hm-note-body hm-prose" dir="auto">
            {note.content}
          </p>
          {error && <InlineError>{error}</InlineError>}
          {confirmingDelete ? (
            <InlineConfirm
              question={strings.deleteConfirm}
              confirmLabel={strings.delete}
              cancelLabel={strings.keepIt}
              working={saving}
              onConfirm={onDelete}
              onCancel={() => setConfirmingDelete(false)}
            />
          ) : (
            <div className="hm-row hm-row--between">
              <span className="hm-meta">{edited}</span>
              {own ? (
                <span className="hm-row__group">
                  <button type="button" className="hm-link" onClick={() => setEditing(true)}>
                    {strings.edit}
                  </button>
                  <button
                    type="button"
                    className="hm-link hm-link--danger"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    {strings.delete}
                  </button>
                </span>
              ) : (
                sharedLabel && (
                  <span className="hm-shared-with">
                    <bdi>{sharedLabel}</bdi>
                  </span>
                )
              )}
            </div>
          )}
        </>
      )}
      {discussion}

      <button
        type="button"
        className="hm-icon-btn hm-icon-btn--small hm-corner-end"
        onClick={onClose}
        aria-label={strings.cancel}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
