import { Favicon } from './Favicon';
import { PinIcon } from './PinIcon';
import { relativeTime } from './i18n';
import { isPlainLeftClick, openNoteAndRestore } from '@/entrypoints/notes/openNote';
import type { PinnedNoteItem } from '@/domain/notes-grouping';
import type { Lang, Strings } from './i18n';

interface PinnedSectionProps {
  notes: PinnedNoteItem[];
  strings: Strings;
  lang: Lang;
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
 * `openNoteAndRestore`.
 */
export function PinnedSection({ notes, strings, lang }: PinnedSectionProps) {
  if (notes.length === 0) return null;
  return (
    <section className="hm-pinned" aria-label={strings.pinnedSection}>
      <h2 className="hm-pinned__title">{strings.pinnedSection}</h2>
      <ul className="hm-pinned__list">
        {notes.map((note, i) => (
          <li key={note.noteId}>
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
          </li>
        ))}
      </ul>
    </section>
  );
}
