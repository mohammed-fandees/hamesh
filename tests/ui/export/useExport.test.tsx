// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { useExport, zipName } from '@/ui/export/useExport';
import { getStrings } from '@/ui/i18n';
import { DEFAULT_PREFERENCES, type Preferences } from '@/domain/preferences';
import { buildExportModel, pageIdentity } from '@/domain/export/model';
import type { ExportActions } from '@/ui/export/ExportActions';
import { realisticLibrary } from '../../domain/export/fixtures';

const strings = getStrings('en');
const { notes, folders } = realisticLibrary();

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
});
afterEach(cleanup);

function Harness(props: {
  prefs: Preferences;
  save: (blob: Blob, name: string) => void;
  writeClipboard: (text: string) => Promise<void>;
  count: (event: string) => void;
  onActions: (a: ExportActions) => void;
  loadNotes?: () => Promise<typeof notes>;
  loadPlaceless?: () => Promise<ReadonlySet<string>>;
}) {
  const exporter = useExport({
    loadNotes: props.loadNotes ?? (async () => notes),
    loadFolders: async () => folders,
    loadPlaceless: props.loadPlaceless,
    saveChoice: vi.fn(),
    prefs: props.prefs,
    strings,
    lang: 'en',
    save: props.save,
    writeClipboard: props.writeClipboard,
    count: props.count,
  });
  props.onActions(exporter.actions);
  return <>{exporter.dialog}</>;
}

function setup(prefs: Preferences = DEFAULT_PREFERENCES, loadNotes?: () => Promise<typeof notes>) {
  const save = vi.fn();
  const writeClipboard = vi.fn().mockResolvedValue(undefined);
  const count = vi.fn();
  let actions!: ExportActions;
  render(
    <Harness
      prefs={prefs}
      save={save}
      writeClipboard={writeClipboard}
      count={count}
      onActions={(a) => (actions = a)}
      loadNotes={loadNotes}
    />,
  );
  return { save, writeClipboard, count, actions: () => actions };
}

const blobBytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

describe('useExport', () => {
  it('downloads the whole library as one zip of Markdown files', async () => {
    const { save, actions } = setup();
    act(() => actions().open({ kind: 'all' }));
    fireEvent.click(await screen.findByRole('button', { name: strings.exportUi.downloadZip }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const [blob, name] = save.mock.calls[0] as [Blob, string];
    expect(name).toMatch(/^hamesh-\d{4}-\d{2}-\d{2}\.zip$/);
    const files = unzipSync(await blobBytes(blob));
    expect(Object.keys(files)).toContain('Hamesh/Overview.md');
    expect(strFromU8(files['Hamesh/Folders/Bennabi - Vocab.md'])).toContain(
      '| Word | Meaning | Page |',
    );
  });

  it('downloads one page as a .md in the remembered tool', async () => {
    const prefs = { ...DEFAULT_PREFERENCES, export: { flavor: 'notion' as const, layouts: {} } };
    const { save, actions } = setup(prefs);
    const pageId = pageIdentity(notes[0]);
    act(() => actions().open({ kind: 'page', pageId }));
    fireEvent.click(await screen.findByRole('button', { name: strings.exportUi.downloadMd }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const [blob, name] = save.mock.calls[0] as [Blob, string];
    expect(name).toBe('The Conditions of Renaissance – Maktaba.md');
    const text = await blob.text();
    expect(text.startsWith('# The Conditions')).toBe(true);
    expect(text).not.toContain('[!quote]');
  });

  it('copies a page straight from a menu, with the remembered layout', async () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      export: { flavor: 'obsidian' as const, layouts: { 'folder:f-react': 'checklist' as const } },
    };
    const { writeClipboard, actions } = setup(prefs);
    const ok = await actions().copyPage(pageIdentity(notes[0]));
    expect(ok).toBe(true);
    expect(writeClipboard.mock.calls[0][0]).toMatch(/^- \[ \] This is the core claim of the book/m);
  });

  it('opens the dialog to say so when the notes cannot be read', async () => {
    const { save, actions } = setup(DEFAULT_PREFERENCES, () =>
      Promise.reject(new Error('storage unavailable')),
    );
    act(() => actions().open({ kind: 'all' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(strings.exportUi.failed);
    expect(screen.getByRole('button', { name: strings.exportUi.downloadZip })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });

  it('says a copy failed instead of throwing', async () => {
    const { writeClipboard, actions } = setup();
    writeClipboard.mockRejectedValueOnce(new Error('denied'));
    expect(await actions().copyPage(pageIdentity(notes[0]))).toBe(false);
  });
});

describe('usage counts for an export', () => {
  const counted = (count: ReturnType<typeof vi.fn>) => count.mock.calls.map(([event]) => event);

  it('counts a finished download: the tool, the scope and each layout drawn', async () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      export: { flavor: 'notion' as const, layouts: { 'folder:f-vocab': 'glossary' as const } },
    };
    const { save, count, actions } = setup(prefs);
    act(() => actions().open({ kind: 'folder', folderId: 'f-vocab' }));
    fireEvent.click(await screen.findByRole('button', { name: strings.exportUi.downloadZip }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(counted(count)).toEqual([
      'export.notion',
      'export.scope.folder',
      'export.layout.glossary',
    ]);
  });

  it('counts a page copied from a menu as a copy', async () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      export: { flavor: 'obsidian' as const, layouts: { 'folder:f-react': 'checklist' as const } },
    };
    const { count, actions } = setup(prefs);
    expect(await actions().copyPage(pageIdentity(notes[0]))).toBe(true);
    expect(counted(count)).toEqual([
      'export.obsidian',
      'export.scope.page',
      'export.copied',
      'export.layout.checklist',
    ]);
  });

  it('counts nothing when the export did not happen', async () => {
    const { writeClipboard, count, actions } = setup();
    writeClipboard.mockRejectedValueOnce(new Error('denied'));
    await actions().copyPage(pageIdentity(notes[0]));
    act(() => actions().open({ kind: 'all' }));
    await screen.findByRole('button', { name: strings.exportUi.downloadZip });
    expect(count).not.toHaveBeenCalled();
  });
});

describe('zipName', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  it('names a folder export after the folder', () => {
    const model = buildExportModel(notes, folders, { kind: 'folder', folderId: 'f-vocab' });
    expect(zipName(model, now)).toBe('hamesh-bennabi-vocab-2026-11-20.zip');
    const arabic = buildExportModel(notes, [{ ...folders[2], name: 'مفردات إنجليزي' }], {
      kind: 'folder',
      folderId: 'f-vocab',
    });
    expect(zipName(arabic, now)).toBe('hamesh-مفردات-إنجليزي-2026-11-20.zip');
  });
  it('names a whole-library export by its date', () => {
    expect(zipName(buildExportModel(notes, folders, { kind: 'all' }), now)).toBe(
      'hamesh-2026-11-20.zip',
    );
  });
});

describe('useExport — notes that lost their place', () => {
  const onWords = notes.find((n) => n.anchor.type === 'text')!;

  function copyWith(loadPlaceless: () => Promise<ReadonlySet<string>>) {
    const writeClipboard = vi.fn().mockResolvedValue(undefined);
    let actions!: ExportActions;
    render(
      <Harness
        prefs={DEFAULT_PREFERENCES}
        save={vi.fn()}
        writeClipboard={writeClipboard}
        count={vi.fn()}
        onActions={(a) => (actions = a)}
        loadPlaceless={loadPlaceless}
      />,
    );
    return { writeClipboard, copy: () => actions.copyPage(pageIdentity(onWords)) };
  }

  it('says under a placeless note that it is no longer on the page', async () => {
    const { writeClipboard, copy } = copyWith(async () => new Set([onWords.id]));
    expect(await copy()).toBe(true);
    expect(writeClipboard.mock.calls[0][0]).toContain('No longer found on the page');
  });

  it('still exports when that cannot be read, just without the line', async () => {
    const { writeClipboard, copy } = copyWith(() => Promise.reject(new Error('gone')));
    expect(await copy()).toBe(true);
    expect(writeClipboard.mock.calls[0][0]).not.toContain('No longer found on the page');
  });
});
