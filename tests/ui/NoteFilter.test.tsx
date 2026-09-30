// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NoteFilter, matchesOwner, type NoteOwner } from '@/ui/teams/NoteFilter';
import { getTeamsStrings } from '@/ui/teams/strings';
import type { Note } from '@/domain/note';

const strings = getTeamsStrings('en');
const ALPHA = '01J0000000000000000000000A';
const BETA = '01J0000000000000000000000B';

const teams = [
  { id: ALPHA, name: 'Alpha' },
  { id: BETA, name: 'Reading group' },
];

function note(team?: { id: string; name: string }): Note {
  return {
    id: 'n1',
    schemaVersion: 1,
    pageKey: 'https://example.test/',
    originalUrl: 'https://example.test/',
    content: 'a thought',
    anchor: {
      primarySelector: 'p',
      signals: { tagName: 'p' },
      fallbackDocumentPosition: { x: 0, y: 0 },
    },
    workspaceId: 'default',
    ...(team
      ? { team: { id: team.id, name: team.name, version: 1, authorId: null, folderId: null } }
      : {}),
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

afterEach(cleanup);

describe('which notes the library is showing', () => {
  it('keeps everything, only this device’s, or one team’s', () => {
    const mine = note();
    const alphas = note({ id: ALPHA, name: 'Alpha' });

    for (const [owner, kept] of [
      ['all', [mine, alphas]],
      ['mine', [mine]],
      [{ teamId: ALPHA }, [alphas]],
      [{ teamId: BETA }, []],
    ] as [NoteOwner, Note[]][]) {
      expect([mine, alphas].filter((n) => matchesOwner(n, owner))).toEqual(kept);
    }
  });

  it('offers a pill per team, and says which one is on', () => {
    const onChange = vi.fn();
    render(<NoteFilter lang="en" teams={teams} value="all" onChange={onChange} />);

    expect(screen.getByRole('button', { name: strings.filterEverything })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reading group' }));
    expect(onChange).toHaveBeenCalledWith({ teamId: BETA });
  });

  it('marks the chosen team’s pill, not the others', () => {
    render(<NoteFilter lang="en" teams={teams} value={{ teamId: ALPHA }} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: strings.filterMine })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('is not there at all when this account is in no team', () => {
    const { container } = render(
      <NoteFilter lang="en" teams={[]} value="all" onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
