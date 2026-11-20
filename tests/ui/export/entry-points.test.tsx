// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ExportActionsContext, type ExportActions } from '@/ui/export/ExportActions';
import { NoteActionsMenu } from '@/ui/library/NoteActionsMenu';
import { FolderMenu } from '@/ui/FolderMenu';
import { BackupSection } from '@/ui/settings/BackupSection';
import { getStrings } from '@/ui/i18n';
import type { NoteActions } from '@/ui/library/NoteActions';
import { pageIdentity } from '@/domain/export/model';
import { textNote } from '../../domain/export/fixtures';

const strings = getStrings('en');
const s = strings.exportUi;
afterEach(cleanup);

function exportActions(over: Partial<ExportActions> = {}): ExportActions {
  return { open: vi.fn(), copyPage: vi.fn().mockResolvedValue(true), ...over };
}

const noteActions = {
  busy: () => false,
  folders: [],
  togglePin: vi.fn(),
  move: vi.fn(),
  remove: vi.fn(),
  edit: vi.fn(),
  createFolder: vi.fn(),
} as unknown as NoteActions;

describe('the note menu', () => {
  const note = textNote({ exact: 'comfy', content: 'مُريح' });

  function openMenu(actions: ExportActions | null) {
    render(
      <ExportActionsContext.Provider value={actions}>
        <NoteActionsMenu note={note} strings={strings} actions={noteActions} />
      </ExportActionsContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: strings.noteActions }));
  }

  it('copies the page’s notes, and says it did', async () => {
    const actions = exportActions();
    openMenu(actions);
    fireEvent.click(screen.getByRole('menuitem', { name: s.copyPageNotes }));
    expect(actions.copyPage).toHaveBeenCalledWith(pageIdentity(note));
    await waitFor(() =>
      expect(screen.getByRole('menuitem', { name: s.copiedPageNotes })).toBeInTheDocument(),
    );
  });

  it('opens the export for that page', () => {
    const actions = exportActions();
    openMenu(actions);
    fireEvent.click(screen.getByRole('menuitem', { name: s.exportPageNotes }));
    expect(actions.open).toHaveBeenCalledWith({ kind: 'page', pageId: pageIdentity(note) });
  });

  it('offers no export where there is none (a page without the Notes page’s controller)', () => {
    openMenu(null);
    expect(screen.queryByRole('menuitem', { name: s.copyPageNotes })).toBeNull();
  });
});

describe('the folder menu', () => {
  const base = {
    name: 'English - Vocab',
    strings,
    deleteQuestion: 'Delete?',
    onRename: vi.fn(),
    onDelete: vi.fn(),
  };

  it('offers the export when given one', () => {
    const onExport = vi.fn();
    render(<FolderMenu {...base} onExport={onExport} exportLabel={s.exportFolder} />);
    fireEvent.click(screen.getByRole('button', { name: strings.folderActions('English - Vocab') }));
    fireEvent.click(screen.getByRole('menuitem', { name: s.exportFolder }));
    expect(onExport).toHaveBeenCalled();
  });

  it('offers nothing for a folder with no notes', () => {
    render(<FolderMenu {...base} exportLabel={s.exportFolder} />);
    fireEvent.click(screen.getByRole('button', { name: strings.folderActions('English - Vocab') }));
    expect(screen.queryByRole('menuitem', { name: s.exportFolder })).toBeNull();
  });
});

describe('Settings', () => {
  it('names its rows and opens the export of everything', () => {
    const actions = exportActions();
    render(
      <ExportActionsContext.Provider value={actions}>
        <BackupSection strings={strings} handlers={{ onExport: vi.fn(), onImport: vi.fn() }} />
      </ExportActionsContext.Provider>,
    );
    expect(screen.getByText(strings.settingsBackup)).toBeInTheDocument();
    expect(screen.getByText(strings.backupRowLabel)).toBeInTheDocument();
    expect(screen.getByText(strings.restoreRowLabel)).toBeInTheDocument();
    expect(screen.getByText(s.settingsHint)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: s.settingsButton }));
    expect(actions.open).toHaveBeenCalledWith({ kind: 'all' });
  });
});
