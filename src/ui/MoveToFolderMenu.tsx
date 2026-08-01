import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Folder } from '@/domain/folder';
import type { Note } from '@/domain/note';
import type { Strings } from './i18n';

interface MoveToFolderMenuProps {
  note: Note;
  /** Flat, depth-indented folder list — see `flattenFolderTreeForMenu`. */
  folders: { folder: Folder; depth: number }[];
  strings: Strings;
  onMove: (noteId: string, folderId: string | undefined) => void;
  /** Creates a new top-level folder and resolves to its id — deeper nesting
   *  is created from an existing folder node's own "+" in `FolderTree`, not
   *  from here. */
  onCreateFolder: (name: string) => Promise<string>;
}

interface PanelPosition {
  top: number;
  /** Exactly one of `left`/`right` is set — whichever edge the trigger's
   *  own inline-end edge resolves to, LTR or RTL (see `computePosition`). */
  left?: number;
  right?: number;
}

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
 * The "⋮ Move to…" trigger + dropdown attached to a note row in folder
 * mode. Portaled to the page's `.hm-scope` wrapper and positioned from the
 * trigger's own `getBoundingClientRect()` (not a CSS `position: absolute`
 * popover nested in place) — the folder tree's collapse animation relies
 * on `overflow: hidden` on its row-list containers (see
 * `notes-library.css`), which would otherwise clip this panel too:
 * `overflow: hidden` clips an absolutely-positioned descendant just as
 * much as a static one — only escaping the container's DOM subtree, not
 * merely its normal flow, avoids that. `.hm-scope` has no `transform`/
 * `filter`/similar of its own, so `position: fixed` here still positions
 * relative to the viewport, not to `.hm-scope`. Closed on outside-click,
 * Escape, or scroll (simpler than tracking the trigger's position live
 * while scrolling).
 */
export function MoveToFolderMenu({
  note,
  folders,
  strings,
  onMove,
  onCreateFolder,
}: MoveToFolderMenuProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [portalRoot, setPortalRoot] = useState<Element | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setCreating(false);
    setNewName('');
  }, []);

  // Refs are read here (an effect), not during render — the resolved
  // position/portal target are stored as state precisely so the render
  // below never touches `triggerRef`/`panelRef` directly.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    setPosition(computePosition(triggerRef.current));
    setPortalRoot(findScopeRoot(triggerRef.current));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
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
    const trimmed = newName.trim();
    if (!trimmed) return;
    const folderId = await onCreateFolder(trimmed);
    onMove(note.id, folderId);
    close();
  }

  return (
    <div className="hm-folder-menu">
      <button
        ref={triggerRef}
        type="button"
        className="hm-icon-btn hm-folder-menu__trigger"
        aria-label={strings.moveToFolder}
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
            aria-label={strings.moveToFolder}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              right: position.right,
            }}
          >
            {creating ? (
              <div className="hm-folder-menu__create">
                <input
                  type="text"
                  className="hm-folder-menu__input"
                  autoFocus
                  value={newName}
                  placeholder={strings.folderNamePlaceholder}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateAndMove();
                  }}
                />
                <button
                  type="button"
                  className="hm-link"
                  disabled={!newName.trim()}
                  onClick={() => void handleCreateAndMove()}
                >
                  {strings.save}
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  role="menuitem"
                  className="hm-folder-menu__item"
                  onClick={() => {
                    onMove(note.id, undefined);
                    close();
                  }}
                >
                  {strings.noFolderOption}
                </button>
                {folders.map(({ folder, depth }) => (
                  <button
                    key={folder.id}
                    type="button"
                    role="menuitem"
                    className="hm-folder-menu__item"
                    style={{ paddingInlineStart: 12 + depth * 14 }}
                    onClick={() => {
                      onMove(note.id, folder.id);
                      close();
                    }}
                  >
                    {folder.name}
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  className="hm-folder-menu__item hm-folder-menu__item--new"
                  onClick={() => setCreating(true)}
                >
                  + {strings.newFolder}
                </button>
              </>
            )}
          </div>,
          portalRoot,
        )}
    </div>
  );
}
