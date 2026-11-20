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
  onActions: (a: ExportActions) => void;
}) {
  const exporter = useExport({
    loadNotes: async () => notes,
    loadFolders: async () => folders,
    saveChoice: vi.fn(),
    prefs: props.prefs,
    strings,
    lang: 'en',
    save: props.save,
    writeClipboard: props.writeClipboard,
  });
  props.onActions(exporter.actions);
  return <>{exporter.dialog}</>;
}

function setup(prefs: Preferences = DEFAULT_PREFERENCES) {
  const save = vi.fn();
  const writeClipboard = vi.fn().mockResolvedValue(undefined);
  let actions!: ExportActions;
  render(
    <Harness
      prefs={prefs}
      save={save}
      writeClipboard={writeClipboard}
      onActions={(a) => (actions = a)}
    />,
  );
  return { save, writeClipboard, actions: () => actions };
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
    expect(strFromU8(files['Hamesh/Folders/English - Vocab.md'])).toContain(
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
    expect(name).toBe('Lifecycle of Reactive Effects – React.md');
    const text = await blob.text();
    expect(text.startsWith('# Lifecycle')).toBe(true);
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
    expect(writeClipboard.mock.calls[0][0]).toMatch(/^- \[ \] This is the default api contract/m);
  });

  it('says a copy failed instead of throwing', async () => {
    const { writeClipboard, actions } = setup();
    writeClipboard.mockRejectedValueOnce(new Error('denied'));
    expect(await actions().copyPage(pageIdentity(notes[0]))).toBe(false);
  });
});

describe('zipName', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  it('names a folder export after the folder', () => {
    const model = buildExportModel(notes, folders, { kind: 'folder', folderId: 'f-vocab' });
    expect(zipName(model, now)).toBe('hamesh-english-vocab-2026-11-20.zip');
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
