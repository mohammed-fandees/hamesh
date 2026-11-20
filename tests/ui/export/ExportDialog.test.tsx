// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ExportDialog, type ExportDialogProps } from '@/ui/export/ExportDialog';
import { getStrings } from '@/ui/i18n';
import { buildExportModel, pageIdentity } from '@/domain/export/model';
import { realisticLibrary, textNote } from '../../domain/export/fixtures';

const strings = getStrings('en');
const s = strings.exportUi;
const now = new Date('2026-11-20T12:00:00Z');

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
});
afterEach(cleanup);

function setup(over: Partial<ExportDialogProps> = {}) {
  const { notes, folders } = realisticLibrary();
  const props: ExportDialogProps = {
    strings,
    lang: 'en',
    model: buildExportModel(notes, folders, { kind: 'all' }),
    flavor: 'obsidian',
    layouts: {},
    now,
    onFlavorChange: vi.fn(),
    onLayoutChange: vi.fn(),
    onDownload: vi.fn().mockResolvedValue('hamesh-2026-11-20.zip'),
    onClose: vi.fn(),
    ...over,
  };
  render(<ExportDialog {...props} />);
  return props;
}

describe('the export dialog, for the whole library', () => {
  it('says what is being exported', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: s.title });
    expect(within(dialog).getByText('All notes · 6 pages · 12 notes')).toBeInTheDocument();
  });

  it('offers both tools and remembers a change', () => {
    const props = setup();
    const tools = screen.getByRole('radiogroup', { name: s.openIn });
    expect(within(tools).getByRole('radio', { name: /Obsidian/ })).toBeChecked();
    fireEvent.click(within(tools).getByRole('radio', { name: /Notion/ }));
    expect(props.onFlavorChange).toHaveBeenCalledWith('notion');
  });

  it('lists each folder and site with the layout suggested for it', () => {
    setup();
    expect(
      screen.getByRole('button', { name: `${s.layoutFor('Bennabi - Vocab')}: Glossary` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `${s.layoutFor('Videos / Talks Notes')}: Timeline` }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `${s.layoutFor('Reading / Science')}: Notes` }),
    ).toBeInTheDocument();
  });

  it('changes a group’s layout from its picker, marking the suggested one', () => {
    const props = setup();
    fireEvent.click(
      screen.getByRole('button', { name: `${s.layoutFor('Bennabi - Vocab')}: Glossary` }),
    );
    const picker = screen.getByRole('radiogroup', { name: s.layoutFor('Bennabi - Vocab') });
    const glossary = within(picker).getByRole('radio', { name: /Glossary/ });
    expect(glossary).toBeChecked();
    expect(within(glossary).getByText(s.suggested)).toBeInTheDocument();
    fireEvent.click(within(picker).getByRole('radio', { name: /Checklist/ }));
    expect(props.onLayoutChange).toHaveBeenCalledWith('folder:f-vocab', 'checklist');
    expect(screen.queryByRole('radiogroup', { name: s.layoutFor('Bennabi - Vocab') })).toBeNull();
  });

  it('closes the picker on Escape without closing the dialog', () => {
    const props = setup();
    const trigger = screen.getByRole('button', {
      name: `${s.layoutFor('Bennabi - Vocab')}: Glossary`,
    });
    fireEvent.click(trigger);
    fireEvent(
      screen.getByRole('dialog', { name: s.title }),
      new Event('cancel', { cancelable: true }),
    );
    expect(screen.queryByRole('radiogroup', { name: s.layoutFor('Bennabi - Vocab') })).toBeNull();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it('previews the chosen group’s first page in its layout', () => {
    setup();
    const preview = screen.getByRole('article', { name: s.preview });
    expect(within(preview).getByRole('columnheader', { name: 'Word' })).toBeInTheDocument();
    expect(within(preview).getByText('Exported from', { exact: false })).toBeInTheDocument();
  });

  it('ends every file with the Hamesh line, and says so', () => {
    setup();
    expect(screen.getByText(s.footer)).toBeInTheDocument();
  });

  it('downloads, then names the file and what to do with it', async () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: s.downloadZip }));
    expect(props.onDownload).toHaveBeenCalled();
    expect(await screen.findByText(s.downloaded('hamesh-2026-11-20.zip'))).toBeInTheDocument();
    expect(screen.getByText(s.doneObsidian)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: s.done }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('keeps the dialog and offers to try again when the file cannot be made', async () => {
    setup({ onDownload: vi.fn().mockRejectedValue(new Error('boom')) });
    fireEvent.click(screen.getByRole('button', { name: s.downloadZip }));
    expect(await screen.findByRole('alert')).toHaveTextContent(s.failed);
    expect(screen.getByRole('button', { name: strings.retry })).toBeEnabled();
  });
});

describe('the export dialog, for one page', () => {
  const note = textNote({ exact: 'civilization is creation;', content: 'The cleanup contract' });
  const pageModel = buildExportModel([note], [], { kind: 'page', pageId: pageIdentity(note) });

  it('picks the layout inline and copies', async () => {
    const onCopy = vi.fn().mockResolvedValue(undefined);
    const props = setup({ model: pageModel, onCopy });
    const layouts = screen.getByRole('radiogroup', { name: s.layout });
    fireEvent.click(within(layouts).getByRole('radio', { name: /Checklist/ }));
    expect(props.onLayoutChange).toHaveBeenCalledWith('site:maktaba.site', 'checklist');
    fireEvent.click(screen.getByRole('button', { name: s.copy }));
    await waitFor(() => expect(screen.getByText(s.copied)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: s.downloadMd })).toBeInTheDocument();
  });

  it('moves between layouts with the arrow keys', () => {
    const props = setup({ model: pageModel, onCopy: vi.fn() });
    const notes = within(screen.getByRole('radiogroup', { name: s.layout })).getByRole('radio', {
      name: /Notes/,
    });
    fireEvent.keyDown(notes, { key: 'ArrowRight' });
    expect(props.onLayoutChange).toHaveBeenCalledWith('site:maktaba.site', 'glossary');
  });

  it('says when copying failed', async () => {
    setup({ model: pageModel, onCopy: vi.fn().mockRejectedValue(new Error('denied')) });
    fireEvent.click(screen.getByRole('button', { name: s.copy }));
    expect(await screen.findByRole('alert')).toHaveTextContent(s.copyFailed);
  });
});

describe('an empty folder', () => {
  it('says so, and cannot download', () => {
    setup({ model: buildExportModel([], [], { kind: 'folder', folderId: 'f' }) });
    expect(screen.getByText(s.emptyFolder)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: s.downloadZip })).toBeDisabled();
  });
});
