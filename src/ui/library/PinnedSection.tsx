import type { Note } from '@/domain/note';
import type { Lang, Strings } from '../i18n';
import { NoteRow } from './NoteRow';

interface PinnedSectionProps {
  /** The pinned notes, most recently edited first (`getPinnedNotes`). */
  notes: Note[];
  strings: Strings;
  lang: Lang;
}

/**
 * "Pinned" — every note the reader marked as important, across every site,
 * most recently edited first. Unlike Continue (one entry per site, inferred
 * from activity), this is the reader's own list, shown even when a pinned
 * note's site is nowhere near recent. Nothing at all when nothing is pinned.
 *
 * The same note rows as every other list, in the same kind of card — so a long
 * pinned note opens out with "Show more" like any other, where it used to be cut
 * to two lines for good.
 */
export function PinnedSection({ notes, strings, lang }: PinnedSectionProps) {
  if (notes.length === 0) return null;
  return (
    <section className="hm-library-section hm-pinned" aria-label={strings.pinnedSection}>
      <h2 className="hm-overline hm-library-section__title">{strings.pinnedSection}</h2>
      <ul className="hm-rows hm-rows--card hm-fade-in">
        {notes.map((note) => (
          <li key={note.id}>
            <NoteRow note={note} strings={strings} lang={lang} showDomain />
          </li>
        ))}
      </ul>
    </section>
  );
}
