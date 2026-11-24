import { createContext, useContext } from 'react';

const NONE: ReadonlySet<string> = new Set();

/** The ids of the notes that lost their place on their page, for every row in the Library. */
export const LostNotesContext = createContext<ReadonlySet<string>>(NONE);

export function useIsLost(noteId: string): boolean {
  return useContext(LostNotesContext).has(noteId);
}
