// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Composer } from '@/ui/Composer';
import type { FolderPickerSource } from '@/ui/FolderPicker';
import type { Folder } from '@/domain/folder';
import { getStrings } from '@/ui/i18n';

const strings = getStrings('en');

function makeFolder(id: string, name: string, parentId: string | null = null): Folder {
  return {
    id,
    name,
    parentId,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const READING = makeFolder('f-reading', 'Reading');
const WORK = makeFolder('f-work', 'Work');
const WORK_SUB = makeFolder('f-work-sub', 'Clients', 'f-work');

function makePicker(
  overrides: Partial<FolderPickerSource & { initialFolderId: string | null }> = {},
) {
  return {
    folders: [READING, WORK, WORK_SUB],
    pageDefaultId: null,
    globalDefaultId: null,
    onSetPageDefault: vi.fn(),
    onSetGlobalDefault: vi.fn(),
    onCreateFolder: vi.fn().mockResolvedValue('f-new'),
    initialFolderId: null,
    ...overrides,
  };
}

function renderComposer(picker = makePicker(), onSave = vi.fn(), onCancel = vi.fn()) {
  const utils = render(
    <Composer strings={strings} folderPicker={picker} onSave={onSave} onCancel={onCancel} />,
  );
  return { ...utils, onSave, onCancel, picker };
}

function write(text: string) {
  fireEvent.change(screen.getByPlaceholderText('Write a note…'), { target: { value: text } });
}

const folderSelect = () => screen.getByRole('combobox', { name: 'Folder' });
const star = () => screen.getByRole('button', { name: 'Default folder' });

describe('Composer — folder selector', () => {
  beforeEach(() => {
    cleanup();
  });

  it('has no folder selector at all when no folder source is given', () => {
    render(<Composer strings={strings} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('lists every folder, nested ones indented under their parent, after "No folder"', () => {
    renderComposer();
    const labels = Array.from(folderSelect().querySelectorAll('option')).map((o) => o.textContent);
    expect(labels).toEqual(['No folder', 'Reading', 'Work', '   Clients', '+ New folder…']);
  });

  it('starts on "No folder" when there is no default', () => {
    renderComposer();
    expect(folderSelect()).toHaveValue('');
  });

  it('starts on the resolved default folder', () => {
    renderComposer(makePicker({ initialFolderId: 'f-work' }));
    expect(folderSelect()).toHaveValue('f-work');
  });

  it('saves into the folder chosen in the selector', () => {
    const { onSave } = renderComposer();
    write('Filed at birth');
    fireEvent.change(folderSelect(), { target: { value: 'f-work-sub' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith('Filed at birth', 'f-work-sub');
  });

  it('saves an unfiled note when "No folder" is chosen, even over a default', () => {
    const { onSave } = renderComposer(makePicker({ initialFolderId: 'f-work' }));
    write('No folder for this one');
    fireEvent.change(folderSelect(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith('No folder for this one', undefined);
  });

  it('follows a default that arrives after opening, until the user picks one themselves', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <Composer strings={strings} folderPicker={makePicker()} onSave={onSave} onCancel={vi.fn()} />,
    );
    rerender(
      <Composer
        strings={strings}
        folderPicker={makePicker({ initialFolderId: 'f-reading' })}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    expect(folderSelect()).toHaveValue('f-reading');

    fireEvent.change(folderSelect(), { target: { value: 'f-work' } });
    rerender(
      <Composer
        strings={strings}
        folderPicker={makePicker({ initialFolderId: 'f-work-sub' })}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    expect(folderSelect()).toHaveValue('f-work');
  });

  it('falls back to "No folder" if the chosen folder is deleted while writing', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <Composer
        strings={strings}
        folderPicker={makePicker({ initialFolderId: 'f-work' })}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    rerender(
      <Composer
        strings={strings}
        folderPicker={makePicker({ initialFolderId: 'f-work', folders: [READING] })}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    write('Still saved');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith('Still saved', undefined);
  });
});

describe('Composer — default folder star', () => {
  beforeEach(() => {
    cleanup();
  });

  it('is disabled while "No folder" is selected — there is nothing to make default', () => {
    renderComposer();
    expect(star()).toBeDisabled();
  });

  it('opens the two default levels for the selected folder', () => {
    renderComposer(makePicker({ initialFolderId: 'f-work' }));
    expect(screen.queryByRole('checkbox')).toBeNull();

    fireEvent.click(star());
    expect(star()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('checkbox', { name: 'Default for this page' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Default for all pages' })).not.toBeChecked();
  });

  it('makes the selected folder the default for this page', () => {
    const { picker } = renderComposer(makePicker({ initialFolderId: 'f-work' }));
    fireEvent.click(star());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Default for this page' }));
    expect(picker.onSetPageDefault).toHaveBeenCalledWith('f-work');
    expect(picker.onSetGlobalDefault).not.toHaveBeenCalled();
  });

  it('makes the selected folder the default for all pages', () => {
    const { picker } = renderComposer(makePicker({ initialFolderId: 'f-reading' }));
    fireEvent.click(star());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Default for all pages' }));
    expect(picker.onSetGlobalDefault).toHaveBeenCalledWith('f-reading');
    expect(picker.onSetPageDefault).not.toHaveBeenCalled();
  });

  it('clears a default by unchecking it', () => {
    const { picker } = renderComposer(
      makePicker({ initialFolderId: 'f-work', pageDefaultId: 'f-work', globalDefaultId: 'f-work' }),
    );
    fireEvent.click(star());
    const page = screen.getByRole('checkbox', { name: 'Default for this page' });
    const global = screen.getByRole('checkbox', { name: 'Default for all pages' });
    expect(page).toBeChecked();
    expect(global).toBeChecked();

    fireEvent.click(page);
    expect(picker.onSetPageDefault).toHaveBeenCalledWith(null);
    fireEvent.click(global);
    expect(picker.onSetGlobalDefault).toHaveBeenCalledWith(null);
  });

  it('shows the star filled and says which default the selected folder is', () => {
    renderComposer(makePicker({ initialFolderId: 'f-work', pageDefaultId: 'f-work' }));
    expect(star()).toHaveAttribute('data-default', 'true');
    expect(screen.getByText('Default for this page')).toBeInTheDocument();
  });

  it('shows an empty star for a folder that is not a default', () => {
    renderComposer(makePicker({ initialFolderId: 'f-reading', globalDefaultId: 'f-work' }));
    expect(star()).toHaveAttribute('data-default', 'false');
  });
});

describe('Composer — creating a folder', () => {
  beforeEach(() => {
    cleanup();
  });

  it('shows an empty state with a way to create one when there are no folders', () => {
    renderComposer(makePicker({ folders: [] }));
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('No folders yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Create folder' })).toBeInTheDocument();
  });

  it('still saves an unfiled note with no folders at all', () => {
    const { onSave } = renderComposer(makePicker({ folders: [] }));
    write('No folders needed');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith('No folders needed', undefined);
  });

  it('creates a folder without leaving the composer, and files the note into it', async () => {
    const onSave = vi.fn();
    const picker = makePicker({ folders: [] });
    const { rerender } = render(
      <Composer strings={strings} folderPicker={picker} onSave={onSave} onCancel={vi.fn()} />,
    );
    write('Into a brand-new folder');

    fireEvent.click(screen.getByRole('button', { name: '+ Create folder' }));
    const name = screen.getByRole('textbox', { name: 'New folder' });
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    fireEvent.change(name, { target: { value: '  Research  ' } });
    fireEvent.keyDown(name, { key: 'Enter' });

    await waitFor(() => expect(picker.onCreateFolder).toHaveBeenCalledWith('Research'));
    // The owner's folder list catches up (from storage) with the new folder.
    rerender(
      <Composer
        strings={strings}
        folderPicker={{ ...picker, folders: [makeFolder('f-new', 'Research')] }}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    await waitFor(() => expect(folderSelect()).toHaveValue('f-new'));
    // The note being written was never touched.
    expect(screen.getByPlaceholderText('Write a note…')).toHaveValue('Into a brand-new folder');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith('Into a brand-new folder', 'f-new');
  });

  it('offers "New folder…" from the selector when folders already exist', () => {
    renderComposer();
    fireEvent.change(folderSelect(), { target: { value: '__hm-new-folder__' } });
    expect(screen.getByRole('textbox', { name: 'New folder' })).toBeInTheDocument();
  });

  it('backs out of naming a folder on Escape without closing the composer', () => {
    const { onCancel } = renderComposer(makePicker({ folders: [] }));
    fireEvent.click(screen.getByRole('button', { name: '+ Create folder' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'New folder' }), { key: 'Escape' });

    expect(screen.queryByRole('textbox', { name: 'New folder' })).toBeNull();
    expect(screen.getByText('No folders yet.')).toBeInTheDocument();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('keeps the name and says so when creating fails', async () => {
    const picker = makePicker({
      folders: [],
      onCreateFolder: vi.fn().mockRejectedValue(new Error('quota')),
    });
    renderComposer(picker);
    fireEvent.click(screen.getByRole('button', { name: '+ Create folder' }));
    const name = screen.getByRole('textbox', { name: 'New folder' });
    fireEvent.change(name, { target: { value: 'Research' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save");
    expect(name).toHaveValue('Research');
  });
});
