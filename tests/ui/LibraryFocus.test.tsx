// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LibraryView } from '@/ui/library/LibraryView';
import { getStrings } from '@/ui/i18n';
import type { Note } from '@/domain/note';

const strings = getStrings('en');

const note = (id: string, site: string): Note => ({
  id,
  schemaVersion: 1,
  pageKey: `https://${site}/${id}`,
  originalUrl: `https://${site}/${id}`,
  content: `a note on ${site}`,
  anchor: {
    primarySelector: null,
    signals: { tagName: 'p' },
    fallbackDocumentPosition: { x: 0, y: 0 },
  },
  workspaceId: 'default',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

afterEach(cleanup);

describe('the Library, opened on one note', () => {
  it('opens the card of the note’s site, and brings the note into view, marked', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = render(
      <LibraryView
        strings={strings}
        lang="en"
        focusNoteId="wanted"
        notes={[note('other', 'a.example'), note('wanted', 'b.example')]}
        teamNotes={[]}
        teams={[]}
        teamFolders={new Map()}
        folders={[]}
        owner="all"
        onOwnerChange={vi.fn()}
        onCreateFolder={vi.fn(async () => {})}
        onRenameFolder={vi.fn(async () => {})}
        onDeleteFolder={vi.fn(async () => {})}
        onMoveNote={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(container.querySelector('[data-note-id="wanted"]')).toHaveAttribute(
        'data-focus',
        'true',
      ),
    );
  });
});
