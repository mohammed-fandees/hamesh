import { createContext, useContext } from 'react';
import type { Note } from '@/domain/note';

/**
 * A place in a note's actions menu for something the Notes Library can offer
 * about that note but the menu itself knows nothing about — today, sharing it
 * with a team.
 *
 * A context rather than a prop threaded down through every group, folder and
 * pinned row: the menu is a leaf, and only the page that owns the notes can say
 * whether there is anything to offer. Nothing is provided in a build without
 * Teams, so the menu renders exactly what it did before — and the whole Teams
 * side of the library, which is what would fill this, is dropped from that build.
 */
export type ShareActionRenderer = (note: Note, close: () => void) => React.ReactNode;

export const NoteShareSlot = createContext<ShareActionRenderer | null>(null);

export function useShareAction(): ShareActionRenderer | null {
  return useContext(NoteShareSlot);
}
