import type { Note } from '../note';
import { wordCount } from './text';

/**
 * How a group of notes is laid out in an export. Each answers a different kind of reading:
 * - `notes`: a quote, then the thought it started (articles, docs);
 * - `glossary`: a word and its meaning (language learning, terminology);
 * - `timeline`: moments in order (videos, or the order notes were written);
 * - `checklist`: things to do or check (reviews, to-dos).
 */
export type ExportLayout = 'notes' | 'glossary' | 'timeline' | 'checklist';

export const EXPORT_LAYOUTS: readonly ExportLayout[] = [
  'notes',
  'glossary',
  'timeline',
  'checklist',
];

export function isExportLayout(value: unknown): value is ExportLayout {
  return typeof value === 'string' && (EXPORT_LAYOUTS as readonly string[]).includes(value);
}

const SHARE = 0.6;
const MIN_FOR_GLOSSARY = 3;

/** A word and its meaning: a short quote and a short one-line note. */
export function isTermPair(note: Note): boolean {
  if (note.anchor.type !== 'text') return false;
  const quote = note.anchor.exact.trim();
  const meaning = note.content.trim();
  return (
    quote.length <= 40 &&
    wordCount(quote) <= 4 &&
    meaning.length <= 60 &&
    wordCount(meaning) <= 8 &&
    !meaning.includes('\n')
  );
}

/**
 * The layout a group of notes most likely wants. `checklist` is never guessed: whether a
 * note is something to do is the writer's call, not something its shape can tell.
 */
export function inferLayout(notes: readonly Note[]): ExportLayout {
  if (notes.length === 0) return 'notes';
  const videos = notes.filter((n) => n.anchor.type === 'video').length;
  if (videos / notes.length >= SHARE) return 'timeline';
  const pairs = notes.filter(isTermPair).length;
  if (notes.length >= MIN_FOR_GLOSSARY && pairs / notes.length >= SHARE) return 'glossary';
  return 'notes';
}
