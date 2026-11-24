import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Note } from '@/domain/note';
import type { Folder } from '@/domain/folder';
import type { ExportPreferences, Preferences } from '@/domain/preferences';
import type { ExportLayout } from '@/domain/export/layout';
import { buildExportModel, type ExportModel, type ExportScope } from '@/domain/export/model';
import { renderExport, renderSinglePage, type RenderOptions } from '@/domain/export/render';
import { safeFileName } from '@/domain/export/file-names';
import { exportEvents } from '@/domain/export/usage';
import type { UsageEvent } from '@/domain/usage';
import { countUse } from '@/usage/count';
import type { Lang, Strings } from '../i18n';
import type { ExportActions } from './ExportActions';
import { ExportDialog } from './ExportDialog';

interface ExportSources {
  /** Every note on this device, read fresh: an export is the whole truth at that moment. */
  loadNotes: () => Promise<Note[]>;
  loadFolders: () => Promise<Folder[]>;
  /** Notes that have no place on their page any more (lost, or kept without one). */
  loadPlaceless?: () => Promise<ReadonlySet<string>>;
  saveChoice: (patch: Partial<ExportPreferences>) => Promise<unknown>;
}

interface UseExportArgs extends ExportSources {
  prefs: Preferences | null;
  strings: Strings;
  lang: Lang;
  /** Hands a finished file to the browser. Injected so tests see what would be saved. */
  save?: (blob: Blob, fileName: string) => void;
  /** Writes text to the clipboard. */
  writeClipboard?: (text: string) => Promise<void>;
  /** Counts one use, for a reader who shares usage counts. Injected so tests see what is counted. */
  count?: (event: UsageEvent) => void;
}

export interface ExportController {
  actions: ExportActions;
  dialog: ReactNode;
}

function saveWithLink(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  } finally {
    // Freed on the next tick: revoking at once can cancel the download the click started.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

const clipboard = (text: string) => navigator.clipboard.writeText(text);

const NO_PLACELESS: ReadonlySet<string> = new Set();

interface Built {
  model: ExportModel;
  placeless: ReadonlySet<string>;
}

/** `hamesh-2026-11-20.zip`, `hamesh-bennabi-vocab-2026-11-20.zip`: sorted sensibly and obvious later. */
export function zipName(model: ExportModel, now: Date): string {
  const day = now.toISOString().slice(0, 10);
  if (model.scope.kind !== 'folder') return `hamesh-${day}.zip`;
  const id = model.scope.folderId;
  const name = model.folders.find((f) => f.id === id)?.name ?? 'folder';
  const slug =
    safeFileName(name)
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'folder';
  return `hamesh-${slug}-${day}.zip`;
}

/**
 * The Markdown export's controller on the Notes page: opens the dialog on a fresh read of the
 * library, remembers the tool and the layouts chosen, and turns the model into a download or
 * the clipboard. The zip library is only loaded when a zip is made.
 */
export function useExport({
  loadNotes,
  loadFolders,
  loadPlaceless,
  saveChoice,
  prefs,
  strings,
  lang,
  save = saveWithLink,
  writeClipboard = clipboard,
  count = countUse,
}: UseExportArgs): ExportController {
  const [open, setOpen] = useState<(Built & { now: Date; loadFailed?: boolean }) | null>(null);
  const flavor = prefs?.export.flavor ?? 'obsidian';
  const layouts = useMemo(() => prefs?.export.layouts ?? {}, [prefs]);

  // The sources change identity with every render of the page; the menus that hold `actions`
  // should not re-render because of it.
  const sources = useRef({ loadNotes, loadFolders, loadPlaceless });
  useEffect(() => {
    sources.current = { loadNotes, loadFolders, loadPlaceless };
  });

  const build = useCallback(async (scope: ExportScope): Promise<Built> => {
    const [notes, folders, placeless] = await Promise.all([
      sources.current.loadNotes(),
      sources.current.loadFolders(),
      // What the page has seen of a note's place only adds a line; it never stops an export.
      sources.current.loadPlaceless?.().catch(() => NO_PLACELESS) ?? NO_PLACELESS,
    ]);
    return { model: buildExportModel(notes, folders, scope), placeless };
  }, []);

  const options = useCallback(
    (now: Date, placeless: ReadonlySet<string>): RenderOptions => ({
      flavor,
      lang,
      layouts,
      now,
      placeless,
    }),
    [flavor, lang, layouts],
  );

  // Counted only once the file or the text is out: a failed export is not a use.
  const counted = useCallback(
    (model: ExportModel, how: 'download' | 'copy') => {
      for (const event of exportEvents(model, flavor, layouts, how)) count(event);
    },
    [count, flavor, layouts],
  );

  const actions = useMemo<ExportActions>(
    () => ({
      open: (scope) => {
        // A library that cannot be read still opens the dialog, to say so instead of doing nothing.
        build(scope).then(
          (built) => setOpen({ ...built, now: new Date() }),
          () =>
            setOpen({
              model: buildExportModel([], [], scope),
              placeless: NO_PLACELESS,
              now: new Date(),
              loadFailed: true,
            }),
        );
      },
      copyPage: async (pageId) => {
        try {
          const { model, placeless } = await build({ kind: 'page', pageId });
          await writeClipboard(
            renderSinglePage(model, pageId, options(new Date(), placeless)).text,
          );
          counted(model, 'copy');
          return true;
        } catch {
          return false;
        }
      },
    }),
    [build, options, writeClipboard, counted],
  );

  let dialog: ReactNode = null;
  if (open) {
    const { model, placeless, now, loadFailed } = open;
    const pageId = model.scope.kind === 'page' ? model.scope.pageId : null;
    dialog = (
      <ExportDialog
        strings={strings}
        lang={lang}
        model={model}
        flavor={flavor}
        layouts={layouts}
        now={now}
        loadFailed={loadFailed}
        onFlavorChange={(next) => void saveChoice({ flavor: next })}
        onLayoutChange={(key: string, layout: ExportLayout) =>
          void saveChoice({ layouts: { [key]: layout } })
        }
        onDownload={async () => {
          if (pageId) {
            const file = renderSinglePage(model, pageId, options(now, placeless));
            save(new Blob([file.text], { type: 'text/markdown;charset=utf-8' }), file.path);
            counted(model, 'download');
            return file.path;
          }
          const { toZip } = await import('@/domain/export/archive');
          const name = zipName(model, now);
          const bytes = toZip(renderExport(model, options(now, placeless)));
          save(new Blob([bytes as BlobPart], { type: 'application/zip' }), name);
          counted(model, 'download');
          return name;
        }}
        onCopy={
          pageId
            ? async () => {
                await writeClipboard(renderSinglePage(model, pageId, options(now, placeless)).text);
                counted(model, 'copy');
              }
            : undefined
        }
        onClose={() => setOpen(null)}
      />
    );
  }

  return { actions, dialog };
}
