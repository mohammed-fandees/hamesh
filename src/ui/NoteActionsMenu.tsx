import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Folder } from '@/domain/folder';
import type { Note } from '@/domain/note';
import { PinIcon } from './PinIcon';
import type { Strings } from './i18n';

interface MoveToFolderOptions {
  /** Flat, depth-indented folder list — see `flattenFolderTreeForMenu`. */
  folders: { folder: Folder; depth: number }[];
  onMove: (noteId: string, folderId: string | undefined) => void;
  /** Creates a new top-level folder and resolves to its id — deeper nesting
   *  is created from an existing folder node's own "+" in `FolderTree`, not
   *  from here. */
  onCreateFolder: (name: string) => Promise<string>;
}

interface NoteActionsMenuProps {
  note: Note;
  strings: Strings;
  onTogglePin: (noteId: string) => void;
  onEdit: (noteId: string, content: string) => void;
  onDelete: (noteId: string) => void;
  /** Only present in the folder-tree ("By folder") view — the domain-grouped
   *  view and the Pinned section don't offer moving a note into a folder
   *  from this menu, only folder mode's own tree does (its rows already
   *  double as move-and-organize UI; the other two are meant to stay a
   *  quicker, flatter list of actions). Omitting it hides the whole "Move
   *  to folder" section. */
  moveToFolder?: MoveToFolderOptions;
}

interface PanelPosition {
  top: number;
  /** Exactly one of `left`/`right` is set — whichever edge the trigger's
   *  own inline-end edge resolves to, LTR or RTL (see `computePosition`). */
  left?: number;
  right?: number;
}

/** Which sub-view the portaled panel is currently showing — a single panel
 *  swaps content rather than stacking separate popovers, same "inline
 *  swap, no modals" pattern `NoteViewer` and `FolderNodeItem`'s own
 *  delete-confirm already use. */
type PanelView = 'menu' | 'creatingFolder' | 'editing' | 'confirmingDelete';

/** Reads the trigger's actual resolved direction (not just `document.dir`,
 *  which the notes page never sets on `<html>` — `dir` lives on the inner
 *  `.hm-scope` wrapper instead) via computed style, so the panel aligns to
 *  the correct edge regardless of which ancestor set it. */
function computePosition(trigger: HTMLElement): PanelPosition {
  const rect = trigger.getBoundingClientRect();
  const rtl = getComputedStyle(trigger).direction === 'rtl';
  return rtl
    ? { top: rect.bottom + 4, left: rect.left }
    : { top: rect.bottom + 4, right: window.innerWidth - rect.right };
}

/** Nudges a computed position back fully on-screen once the panel has
 *  actually rendered and its real size is known — `computePosition` above
 *  has no way to know the panel's dimensions before it exists in the DOM,
 *  so a panel anchored near a viewport edge (the last note in a scrolled
 *  list, or a narrow window) could otherwise render partly off-screen
 *  instead of flipping/clamping into view. Vertically: flips above the
 *  trigger when there isn't enough room below. Horizontally: clamps
 *  in-bounds rather than flipping, since the trigger's own inline-end edge
 *  is already the natural alignment and flipping sides would misalign it
 *  from the row it belongs to. */
function clampToViewport(
  position: PanelPosition,
  panel: HTMLElement,
  trigger: HTMLElement,
): PanelPosition {
  const panelRect = panel.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();
  const margin = 4;

  let top = position.top;
  if (triggerRect.bottom + margin + panelRect.height > window.innerHeight) {
    top = Math.max(margin, triggerRect.top - panelRect.height - margin);
  }

  let left = position.left;
  if (left !== undefined) {
    const overflowRight = left + panelRect.width - (window.innerWidth - margin);
    if (overflowRight > 0) left -= overflowRight;
    left = Math.max(margin, left);
  }

  let right = position.right;
  if (right !== undefined) {
    const resolvedLeft = window.innerWidth - right - panelRect.width;
    if (resolvedLeft < margin) right = window.innerWidth - panelRect.width - margin;
    right = Math.max(margin, right);
  }

  return { top, left, right };
}

/** Every `--hm-*` design token (colors, spacing, radii — see tokens.css) is
 *  declared on `.hm-scope`, not `:root`, so it's only inherited by elements
 *  that are DOM descendants of one. Portaling to `document.body` directly
 *  would escape that scope entirely — every `var(--hm-*)` in the panel's
 *  CSS would resolve to nothing, rendering it with no background, no
 *  border, no radius, no padding (exactly what happened before this was
 *  fixed to walk up to the trigger's own `.hm-scope` ancestor instead: it
 *  still fully escapes the *local* `overflow: hidden` clipping ancestors
 *  the folder tree's collapse animation needs, since `.hm-scope` is itself
 *  the page's outermost wrapper, just without leaving the token scope). */
function findScopeRoot(trigger: HTMLElement): Element {
  return trigger.closest('.hm-scope') ?? document.body;
}

/**
 * The "⋮" trigger + dropdown attached to a note row, in both the
 * domain-grouped ("By site") and folder-tree ("By folder") views — pin/
 * unpin, edit content, delete, and move to a folder, all from the Notes
 * Library without leaving it. Portaled to the page's `.hm-scope` wrapper
 * and positioned from the trigger's own `getBoundingClientRect()` (not a
 * CSS `position: absolute` popover nested in place) — the folder tree's
 * collapse animation relies on `overflow: hidden` on its row-list
 * containers (see `notes-library.css`), which would otherwise clip this
 * panel too. Closed on outside-click, Escape (one level at a time —
 * editing/confirming-delete first return to the menu, only then close),
 * or scroll.
 */
export function NoteActionsMenu({
  note,
  strings,
  onTogglePin,
  onEdit,
  onDelete,
  moveToFolder,
}: NoteActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PanelView>('menu');
  const [newFolderName, setNewFolderName] = useState('');
  const [editContent, setEditContent] = useState(note.content);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [portalRoot, setPortalRoot] = useState<Element | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setView('menu');
    setNewFolderName('');
  }, []);

  // Refs are read here (an effect), not during render — the resolved
  // position/portal target are stored as state precisely so the render
  // below never touches `triggerRef`/`panelRef` directly. Re-anchors on
  // every `view` change too, not just `open` — switching to a taller view
  // (e.g. `editing`, with its textarea) needs a fresh anchor so the
  // clamp effect below can re-measure that view's real size, rather than
  // reusing a stale position computed for a shorter view.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    setPosition(computePosition(triggerRef.current));
    setPortalRoot(findScopeRoot(triggerRef.current));
  }, [open, view]);

  // Runs after the panel has actually rendered at the position above, and
  // nudges it back on-screen using its real measured size (see
  // `clampToViewport`). Depends on `position` so it reruns after that
  // first pass commits; the equality check makes this converge in at most
  // one extra layout pass, since clamping an already-in-bounds position is
  // a no-op — both effects run before the browser paints, so there's no
  // visible flicker.
  useLayoutEffect(() => {
    if (!open || !position || !panelRef.current || !triggerRef.current) return;
    const clamped = clampToViewport(position, panelRef.current, triggerRef.current);
    if (
      clamped.top !== position.top ||
      clamped.left !== position.left ||
      clamped.right !== position.right
    ) {
      setPosition(clamped);
    }
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setView((v) => {
        if (v === 'menu') {
          close();
          return v;
        }
        return 'menu';
      });
    }
    function onScroll() {
      close();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
    };
  }, [open, close]);

  async function handleCreateAndMove() {
    const trimmed = newFolderName.trim();
    if (!trimmed || !moveToFolder) return;
    const folderId = await moveToFolder.onCreateFolder(trimmed);
    moveToFolder.onMove(note.id, folderId);
    close();
  }

  function startEdit() {
    setEditContent(note.content);
    setView('editing');
  }

  function handleSaveEdit() {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    onEdit(note.id, trimmed);
    close();
  }

  return (
    <div className="hm-folder-menu">
      <button
        ref={triggerRef}
        type="button"
        className="hm-icon-btn hm-folder-menu__trigger"
        aria-label={strings.noteActions}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="2.4" r="1.15" fill="currentColor" />
          <circle cx="7" cy="7" r="1.15" fill="currentColor" />
          <circle cx="7" cy="11.6" r="1.15" fill="currentColor" />
        </svg>
      </button>

      {open &&
        position &&
        portalRoot &&
        createPortal(
          <div
            ref={panelRef}
            className="hm-folder-menu__panel"
            role="menu"
            aria-label={strings.noteActions}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              right: position.right,
            }}
          >
            {view === 'menu' && (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="hm-folder-menu__item"
                  onClick={() => {
                    onTogglePin(note.id);
                    close();
                  }}
                >
                  <PinIcon filled={!!note.pinned} size={12} />
                  {note.pinned ? strings.unpinNote : strings.pinNote}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="hm-folder-menu__item"
                  onClick={startEdit}
                >
                  {strings.edit}
                </button>

                {moveToFolder && (
                  <>
                    <div className="hm-folder-menu__divider" role="separator" />
                    <div className="hm-folder-menu__section-label">{strings.moveToFolder}</div>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={!note.folderId}
                      className="hm-folder-menu__item hm-folder-menu__item--folder-option"
                      onClick={() => {
                        moveToFolder.onMove(note.id, undefined);
                        close();
                      }}
                    >
                      <span>{strings.noFolderOption}</span>
                      {!note.folderId && <CurrentFolderCheck />}
                    </button>
                    {moveToFolder.folders.map(({ folder, depth }) => (
                      <button
                        key={folder.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={folder.id === note.folderId}
                        className="hm-folder-menu__item hm-folder-menu__item--folder-option"
                        style={{ paddingInlineStart: 12 + depth * 14 }}
                        onClick={() => {
                          moveToFolder.onMove(note.id, folder.id);
                          close();
                        }}
                      >
                        <span>{folder.name}</span>
                        {folder.id === note.folderId && <CurrentFolderCheck />}
                      </button>
                    ))}
                    <button
                      type="button"
                      role="menuitem"
                      className="hm-folder-menu__item hm-folder-menu__item--new"
                      onClick={() => setView('creatingFolder')}
                    >
                      + {strings.newFolder}
                    </button>
                  </>
                )}

                <div className="hm-folder-menu__divider" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  className="hm-folder-menu__item hm-folder-menu__item--danger"
                  onClick={() => setView('confirmingDelete')}
                >
                  {strings.delete}
                </button>
              </>
            )}

            {view === 'creatingFolder' && (
              <div className="hm-folder-menu__create">
                <input
                  type="text"
                  className="hm-folder-menu__input"
                  autoFocus
                  value={newFolderName}
                  placeholder={strings.folderNamePlaceholder}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateAndMove();
                  }}
                />
                <button
                  type="button"
                  className="hm-link"
                  disabled={!newFolderName.trim()}
                  onClick={() => void handleCreateAndMove()}
                >
                  {strings.save}
                </button>
              </div>
            )}

            {view === 'editing' && (
              <div className="hm-folder-menu__edit">
                <textarea
                  className="hm-textarea"
                  dir="auto"
                  autoFocus
                  value={editContent}
                  aria-label={strings.edit}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSaveEdit();
                    }
                  }}
                />
                <div className="hm-row">
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost"
                    onClick={() => setView('menu')}
                  >
                    {strings.cancel}
                  </button>
                  <button
                    type="button"
                    className="hm-btn hm-btn-primary"
                    disabled={!editContent.trim()}
                    onClick={handleSaveEdit}
                  >
                    {strings.saveChanges}
                  </button>
                </div>
              </div>
            )}

            {view === 'confirmingDelete' && (
              <div className="hm-folder-node__confirm">
                <p>{strings.deleteConfirm}</p>
                <div className="hm-row">
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost"
                    onClick={() => setView('menu')}
                  >
                    {strings.keepIt}
                  </button>
                  <button
                    type="button"
                    className="hm-btn hm-btn-danger"
                    onClick={() => {
                      onDelete(note.id);
                      close();
                    }}
                  >
                    {strings.delete}
                  </button>
                </div>
              </div>
            )}
          </div>,
          portalRoot,
        )}
    </div>
  );
}

/** Marks the note's currently-assigned folder (or "No folder") in the move
 *  list, so it's clear at a glance where a note already lives instead of
 *  only being able to tell by trial and error. */
function CurrentFolderCheck() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.5 6.5 L5 9 L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
