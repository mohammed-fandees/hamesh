import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExportFlavor } from '@/domain/preferences';
import type { ExportLayout } from '@/domain/export/layout';
import type { ExportGroup, ExportModel, ExportPage } from '@/domain/export/model';
import { layoutFor } from '@/domain/export/render';
import { MarginMark } from '../kit/MarginMark';
import { CloseIcon, ChevronIcon } from '../kit/icons';
import type { Lang, Strings } from '../i18n';
import { LayoutPicker } from './LayoutPicker';
import { LayoutPreview } from './LayoutPreview';
import { LayoutThumb } from './LayoutThumb';
import './export.css';

export interface ExportDialogProps {
  strings: Strings;
  lang: Lang;
  model: ExportModel;
  flavor: ExportFlavor;
  layouts: Readonly<Record<string, ExportLayout>>;
  now: Date;
  /** The notes could not be read, so there is nothing to export: say so. */
  loadFailed?: boolean;
  onFlavorChange: (flavor: ExportFlavor) => void;
  onLayoutChange: (groupKey: string, layout: ExportLayout) => void;
  /** Builds and downloads the export; resolves to the file name. */
  onDownload: () => Promise<string>;
  /** One page only: puts it on the clipboard. */
  onCopy?: () => Promise<void>;
  onClose: () => void;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'downloaded'; file: string }
  | { kind: 'copied' }
  | { kind: 'failed'; message: string };

function previewPageOf(model: ExportModel, group: ExportGroup): ExportPage | undefined {
  const own = model.pages.find((p) => p.id === group.pageIds[0]);
  if (own) return own;
  const first = group.notes[0];
  return first ? model.pages.find((p) => p.notes.includes(first)) : undefined;
}

/**
 * The Markdown export (canvas boards A, B, D). One dialog for a page, a folder or everything:
 * Obsidian or Notion, then each folder's or site's layout beside a live preview of the
 * reader's own notes. A page picks its layout inline; a library picks one per group from a
 * popover. The browser's own modal dialog: focus is trapped, Escape closes, focus goes back.
 */
export function ExportDialog(props: ExportDialogProps) {
  const { strings, lang, model, flavor, layouts, now } = props;
  const s = strings.exportUi;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [selected, setSelected] = useState(0);
  const [picker, setPicker] = useState<{ key: string; top: number } | null>(null);

  const pageScope = model.scope.kind === 'page';
  const groups = model.groups;
  const group = groups[Math.min(selected, groups.length - 1)];
  const empty = model.noteCount === 0;
  const busy = status.kind === 'preparing';
  const layoutOf = (g: ExportGroup) => layoutFor(model, g.key, layouts);
  const previewPage = useMemo(
    () => (group ? previewPageOf(model, group) : undefined),
    [model, group],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (!picker) return;
    const onPointerDown = (event: PointerEvent) => {
      const path = event.composedPath();
      const trigger = triggerRefs.current.get(picker.key);
      if (popoverRef.current && path.includes(popoverRef.current)) return;
      if (trigger && path.includes(trigger)) return;
      setPicker(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [picker]);

  function closePicker() {
    const key = picker?.key;
    setPicker(null);
    if (key) triggerRefs.current.get(key)?.focus();
  }

  function togglePicker(g: ExportGroup, index: number) {
    setSelected(index);
    if (picker?.key === g.key) {
      setPicker(null);
      return;
    }
    const trigger = triggerRefs.current.get(g.key);
    const frame = frameRef.current;
    const top =
      trigger && frame
        ? trigger.getBoundingClientRect().bottom - frame.getBoundingClientRect().top + 4
        : 0;
    setPicker({ key: g.key, top });
  }

  async function download() {
    setStatus({ kind: 'preparing' });
    try {
      const file = await props.onDownload();
      setStatus({ kind: 'downloaded', file });
    } catch {
      setStatus({ kind: 'failed', message: s.failed });
    }
  }

  async function copy() {
    if (!props.onCopy) return;
    try {
      await props.onCopy();
      setStatus({ kind: 'copied' });
    } catch {
      setStatus({ kind: 'failed', message: s.copyFailed });
    }
  }

  const scopeLine = (() => {
    const pages = s.pagesCount(model.pages.length);
    const notes = s.notesCount(model.noteCount);
    if (model.scope.kind === 'page') return s.scopePage(model.pages[0]?.site ?? '', notes);
    if (model.scope.kind === 'folder') {
      const id = model.scope.folderId;
      const name = model.folders.find((f) => f.id === id)?.name ?? '';
      return s.scopeFolder(name, pages, notes);
    }
    return s.scopeAll(pages, notes);
  })();

  const pickerGroup = picker ? groups.find((g) => g.key === picker.key) : undefined;

  return (
    <dialog
      ref={dialogRef}
      className="hm-export"
      aria-labelledby="hm-export-title"
      onCancel={(event) => {
        event.preventDefault();
        if (picker) closePicker();
        else props.onClose();
      }}
    >
      <div className="hm-export__frame" ref={frameRef}>
        <header className="hm-export__head">
          <div className="hm-export__titles">
            <h2 id="hm-export-title" className="hm-export__title">
              {pageScope ? (model.pages[0]?.title ?? s.title) : s.title}
            </h2>
            <p className="hm-export__scope">
              {pageScope ? `${s.title} · ${scopeLine}` : scopeLine}
            </p>
          </div>
          <button
            type="button"
            className="hm-export__close"
            aria-label={s.close}
            onClick={props.onClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="hm-export__body">
          {empty ? (
            <div className="hm-export__empty">
              <MarginMark size={28} />
              {props.loadFailed ? (
                <p role="alert">{s.failed}</p>
              ) : (
                <>
                  <p>{s.emptyFolder}</p>
                  <p className="hm-export__hint">{s.emptyFolderHint}</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="hm-export__controls">
                <div className="hm-export__field">
                  <span id="hm-export-tool" className="hm-export__label">
                    {s.openIn}
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby="hm-export-tool"
                    className="hm-export__choices"
                  >
                    {(['obsidian', 'notion'] as const).map((tool) => (
                      <button
                        key={tool}
                        type="button"
                        role="radio"
                        aria-checked={flavor === tool}
                        className="hm-export__choice"
                        disabled={busy}
                        onClick={() => {
                          setStatus({ kind: 'idle' });
                          props.onFlavorChange(tool);
                        }}
                      >
                        <span className="hm-export__choice-name">
                          {tool === 'obsidian' ? 'Obsidian' : 'Notion'}
                        </span>
                        <span className="hm-export__choice-hint">
                          {tool === 'obsidian'
                            ? pageScope
                              ? s.obsidianPageHint
                              : s.obsidianHint
                            : pageScope
                              ? s.notionPageHint
                              : s.notionHint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hm-export__field">
                  <span className="hm-export__label">{s.layout}</span>
                  {pageScope && group ? (
                    <LayoutPicker
                      value={layoutOf(group)}
                      suggested={group.suggested}
                      strings={s}
                      label={s.layout}
                      describe="chosen"
                      onChange={(layout) => {
                        setStatus({ kind: 'idle' });
                        props.onLayoutChange(group.key, layout);
                      }}
                    />
                  ) : (
                    <>
                      <p className="hm-export__hint">{s.layoutIntro}</p>
                      <ul className="hm-export__groups">
                        {groups.map((g, i) => {
                          const layout = layoutOf(g);
                          return (
                            <li
                              key={g.key}
                              className="hm-export__group"
                              data-selected={g === group}
                            >
                              <button
                                type="button"
                                className="hm-export__group-name"
                                aria-pressed={g === group}
                                onClick={() => {
                                  setSelected(i);
                                  setPicker(null);
                                }}
                              >
                                <span className="hm-export__group-label" dir="auto">
                                  {g.label}
                                </span>
                                <span className="hm-export__group-count">
                                  {s.notesCount(g.notes.length)}
                                </span>
                              </button>
                              <button
                                ref={(el) => {
                                  if (el) triggerRefs.current.set(g.key, el);
                                  else triggerRefs.current.delete(g.key);
                                }}
                                type="button"
                                className="hm-export__group-pick"
                                aria-haspopup="dialog"
                                aria-expanded={picker?.key === g.key}
                                aria-label={`${s.layoutFor(g.label)}: ${s.layoutName[layout]}`}
                                onClick={() => togglePicker(g, i)}
                              >
                                <LayoutThumb layout={layout} size="sm" />
                                <span>{s.layoutName[layout]}</span>
                                <ChevronIcon />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>
              </div>

              <div className="hm-export__preview">
                <span className="hm-export__label">
                  {s.previewIn(flavor === 'obsidian' ? 'Obsidian' : 'Notion')}
                </span>
                {previewPage && group && (
                  <LayoutPreview
                    page={previewPage}
                    layout={layoutOf(group)}
                    flavor={flavor}
                    lang={lang}
                    now={now}
                    label={s.preview}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {picker && pickerGroup && (
          <div
            ref={popoverRef}
            role="dialog"
            aria-label={s.layoutFor(pickerGroup.label)}
            className="hm-layout-popover"
            style={{ top: picker.top }}
          >
            <span className="hm-export__label" dir="auto">
              {s.layoutFor(pickerGroup.label)}
            </span>
            <LayoutPicker
              value={layoutOf(pickerGroup)}
              suggested={pickerGroup.suggested}
              strings={s}
              label={s.layoutFor(pickerGroup.label)}
              describe="each"
              onChange={(layout) => {
                setStatus({ kind: 'idle' });
                props.onLayoutChange(pickerGroup.key, layout);
                closePicker();
              }}
            />
          </div>
        )}

        <footer className="hm-export__foot">
          {status.kind === 'downloaded' ? (
            <>
              <div className="hm-export__done" role="status">
                <p className="hm-export__foot-text" data-tone="success">
                  {s.downloaded(status.file)}
                </p>
                <p className="hm-export__foot-text">
                  {flavor === 'obsidian' ? s.doneObsidian : s.doneNotion}
                </p>
              </div>
              <button type="button" className="hm-btn hm-btn-ghost" onClick={props.onClose}>
                {s.done}
              </button>
            </>
          ) : (
            <>
              <p
                className="hm-export__foot-text"
                role={status.kind === 'failed' ? 'alert' : 'status'}
                data-tone={
                  status.kind === 'failed'
                    ? 'warning'
                    : status.kind === 'copied'
                      ? 'success'
                      : undefined
                }
              >
                {status.kind === 'failed'
                  ? status.message
                  : status.kind === 'copied'
                    ? s.copied
                    : pageScope
                      ? s.footerPage
                      : s.footer}
              </p>
              {pageScope && props.onCopy ? (
                <button
                  type="button"
                  className="hm-btn hm-btn-ghost"
                  disabled={busy || empty}
                  onClick={() => void copy()}
                >
                  {s.copy}
                </button>
              ) : (
                <button
                  type="button"
                  className="hm-btn hm-btn-ghost"
                  disabled={busy}
                  onClick={props.onClose}
                >
                  {strings.cancel}
                </button>
              )}
              <button
                type="button"
                className="hm-btn hm-btn-primary"
                disabled={busy || empty}
                aria-busy={busy}
                onClick={() => void download()}
              >
                {busy
                  ? s.preparing
                  : status.kind === 'failed'
                    ? strings.retry
                    : pageScope
                      ? s.downloadMd
                      : s.downloadZip}
              </button>
            </>
          )}
        </footer>
      </div>
    </dialog>
  );
}
