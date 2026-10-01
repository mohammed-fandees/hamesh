import { describe, it, expect } from 'vitest';
import { OVERVIEW, routeFromParams, routeToParams, type TeamsRoute } from '@/ui/teams/route';

const parse = (query: string) => routeFromParams(new URLSearchParams(query));

describe('where inside Teams the address says the reader is', () => {
  it('round-trips every place, so the back button lands where the reader was', () => {
    const places: TeamsRoute[] = [
      OVERVIEW,
      { page: 'overview', teamId: 'T1' },
      { page: 'members', teamId: 'T1' },
      { page: 'note', teamId: 'T1', noteId: 'N1' },
    ];
    for (const place of places) {
      expect(parse(new URLSearchParams(routeToParams(place)).toString())).toEqual(place);
    }
  });

  it('opens the overview for anything it cannot make sense of, rather than throwing', () => {
    expect(parse('')).toEqual(OVERVIEW);
    // A page with no team, a note page with no note, and a page it has never heard of.
    expect(parse('page=members')).toEqual(OVERVIEW);
    expect(parse('team=T1&page=note')).toEqual({ page: 'overview', teamId: 'T1' });
    expect(parse('team=T1&page=nonsense')).toEqual({ page: 'overview', teamId: 'T1' });
  });
});
