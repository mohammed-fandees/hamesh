import type { VisitOutcome } from '@/domain/anchor-health';
import { resolveAnchor, ResolutionQuality } from '@/domain/anchor-resolution';
import type { Note } from '@/domain/note';
import { resolveTextAnchors } from '@/domain/text-anchor-resolution';

/** Notes the lost-place check looks at: notes on words or an element, this device's and its
 *  teams' alike, so every member sees that a shared note lost its place. A video that isn't
 *  loaded is not a changed page. */
export function isCheckedForPlace(note: Note, textEnabled: boolean): boolean {
  if (note.anchor.type === 'video') return false;
  if (note.anchor.type === 'text') return textEnabled;
  return true;
}

/** An element found by its own signals; `Fallback` is only a guess at the old x/y. */
export function elementFound(quality: ResolutionQuality): boolean {
  return quality === ResolutionQuality.Exact || quality === ResolutionQuality.Probable;
}

/**
 * How each checked note does against the page as it is right now, resolved afresh. Text notes
 * are skipped while the reader has text notes turned off: they are not looked for, so they can't
 * be missed.
 */
export function anchorOutcomes(
  notes: readonly Note[],
  textEnabled: boolean,
): Map<string, VisitOutcome> {
  const outcomes = new Map<string, VisitOutcome>();
  const checked = notes.filter((note) => isCheckedForPlace(note, textEnabled));

  const textRequests = [];
  for (const note of checked) {
    if (note.anchor.type === 'text') {
      textRequests.push({ id: note.id, anchor: note.anchor });
    } else {
      outcomes.set(note.id, elementFound(resolveAnchor(note).quality) ? 'found' : 'missed');
    }
  }
  if (textRequests.length > 0) {
    const results = resolveTextAnchors(textRequests);
    for (const { id } of textRequests)
      outcomes.set(id, results.get(id)?.range ? 'found' : 'missed');
  }
  return outcomes;
}
