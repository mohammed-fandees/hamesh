/**
 * Where inside Teams the reader is. The Teams page is an overview, and the two
 * things too big to sit on it — who is in a team, and one shared note with its
 * discussion — are pages of their own, reached from it and back again.
 *
 * Kept as a value the Notes Library page owns, rather than state inside the
 * Teams view, so the browser's back button can walk it and so the Library can
 * send a reader to a note's discussion without going through the overview.
 */
export type TeamsRoute =
  | { page: 'overview'; teamId: string | null }
  | { page: 'members'; teamId: string }
  | { page: 'note'; teamId: string; noteId: string };

export const OVERVIEW: TeamsRoute = { page: 'overview', teamId: null };

/** The query parameters that say where Teams is, for the address bar. */
export function routeToParams(route: TeamsRoute): Record<string, string> {
  switch (route.page) {
    case 'overview':
      return route.teamId ? { team: route.teamId } : {};
    case 'members':
      return { team: route.teamId, page: 'members' };
    case 'note':
      return { team: route.teamId, page: 'note', note: route.noteId };
  }
}

/** The inverse: whatever the address says, or the overview if it says nothing
 *  usable. An unknown page never throws — a stale link opens the overview. */
export function routeFromParams(params: URLSearchParams): TeamsRoute {
  const teamId = params.get('team');
  if (!teamId) return OVERVIEW;
  const page = params.get('page');
  if (page === 'members') return { page: 'members', teamId };
  const noteId = params.get('note');
  if (page === 'note' && noteId) return { page: 'note', teamId, noteId };
  return { page: 'overview', teamId };
}
