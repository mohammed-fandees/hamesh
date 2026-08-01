import { useMemo } from 'react';
import { Favicon } from './Favicon';
import { PinIcon } from './PinIcon';
import { NoteActionsMenu } from './NoteActionsMenu';
import { relativeTime } from './i18n';
import { isPlainLeftClick, openNoteAndRestore } from '@/entrypoints/notes/openNote';
import type { PinnedNoteItem } from '@/domain/notes-grouping';
import type { Note } from '@/domain/note';
import type { Lang, Strings } from './i18n';

interface PinnedSectionProps {
  notes: PinnedNoteItem[];
  /** The full note objects `notes` above were derived from — `PinnedNoteItem`
   *  is a slim display-only projection (domain/preview/url/updatedAt) with
   *  no `id`... it does have `noteId`, but not `pinned`/`content`/`folderId`,
   *  which `NoteActionsMenu` needs. Looked up by `noteId` per row rather
   *  than reshaping `getPinnedNotes`'s return type, which other callers
   *  (and its own tests) depend on staying a slim projection. */
  allNotes: Note[];
  strings: Strings;
  lang: Lang;
  onTogglePin: (noteId: string) => void;
  onEditNote: (noteId: string, content: string) => void;
  onDeleteNote: (noteId: string) => void;
}

/**
 * "Pinned" — every note a user explicitly marked as important, across every
 * website, most-recently-edited first. Unlike "Continue" (one entry per
 * website, system-inferred from recent activity), this is a flat list of
 * individual notes the user curated themselves — so it's shown even if a
 * pinned note's site isn't otherwise recent. Renders nothing when there are
 * no pinned notes.
 *
 * Same open-and-restore click behavior as NoteRow/Continue cards: a real
 * `<a target="_blank">`, intercepted on a plain left-click to drive
 * `openNoteAndRestore`. Each item also gets a sibling `NoteActionsMenu` —
 * pin/unpin, edit, delete — but not "Move to folder" (see that component's
 * own doc comment for why it's folder-tree-only).
 */
export function PinnedSection({
  notes,
  allNotes,
  strings,
  lang,
  onTogglePin,
  onEditNote,
  onDeleteNote,
}: PinnedSectionProps) {
  // Built once per `allNotes` change rather than an `allNotes.find(...)`
  // inside the render loop below — that would be O(pinned notes × all
  // notes) instead of O(pinned notes + all notes).
  const noteById = useMemo(() => new Map(allNotes.map((n) => [n.id, n])), [allNotes]);

  if (notes.length === 0) return null;
  return (
    <section className="hm-pinned" aria-label={strings.pinnedSection}>
      <h2 className="hm-pinned__title">{strings.pinnedSection}</h2>
      <ul className="hm-pinned__list">
        {notes.map((note, i) => {
          const fullNote = noteById.get(note.noteId);
          return (
            <li key={note.noteId} className="hm-pinned__row">
              <a
                className="hm-pinned__item hm-fade-in"
                style={{ animationDelay: `${i * 30}ms` }}
                href={note.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!isPlainLeftClick(e)) return;
                  e.preventDefault();
                  void openNoteAndRestore(note.url, note.noteId);
                }}
              >
                <span className="hm-pinned__kicker">
                  <PinIcon filled size={11} />
                  <Favicon domain={note.domain} size={14} />
                  {note.domain}
                </span>
                <p className="hm-pinned__preview" dir="auto">
                  {note.preview}
                </p>
                <span className="hm-pinned__meta">
                  {strings.editedAgo(relativeTime(note.updatedAt, lang))}
                </span>
              </a>
              {fullNote && (
                <NoteActionsMenu
                  note={fullNote}
                  strings={strings}
                  onTogglePin={onTogglePin}
                  onEdit={onEditNote}
                  onDelete={onDeleteNote}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
