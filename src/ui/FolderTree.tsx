import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Folder } from '@/domain/folder';
import type { FolderNode } from '@/domain/folder-grouping';
import { flattenFolderTreeForMenu } from '@/domain/folder-grouping';
import type { Note } from '@/domain/note';
import { NoteRow } from './NoteRow';
import { MoveToFolderMenu } from './MoveToFolderMenu';
import type { Lang, Strings } from './i18n';

/** Custom MIME type carrying a dragged note's id — namespaced so it never
 *  collides with a browser/OS default drag payload. */
const NOTE_DRAG_MIME = 'application/x-hamesh-note-id';

/** Not a real `Folder` — the synthetic bucket for notes with no `folderId`
 *  (or one pointing at a folder that no longer exists). Not renamable or
 *  deletable, but a valid drag-and-drop target like any real folder. */
const UNFILED_ID = '__unfiled__';

interface FolderTreeProps {
  tree: FolderNode[];
  unfiledNotes: Note[];
  strings: Strings;
  lang: Lang;
  /** Resolves to the new folder's id — used directly by `MoveToFolderMenu`'s
   *  "+ New folder" flow to move the note there immediately after creating it. */
  onCreateFolder: (name: string, parentId: string | null) => Promise<string>;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveNote: (noteId: string, folderId: string | undefined) => void;
}

interface FolderTreeContextValue {
  strings: Strings;
  lang: Lang;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onExpand: (id: string) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  addingChildId: string | null;
  setAddingChildId: (id: string | null) => void;
  deletingId: string | null;
  setDeletingId: (id: string | null) => void;
  dragOverId: string | null;
  setDragOverId: (id: string | null) => void;
  flatFoldersForMenu: { folder: Folder; depth: number }[];
  onCreateFolder: (name: string, parentId: string | null) => Promise<string>;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveNote: (noteId: string, folderId: string | undefined) => void;
}

const FolderTreeCtx = createContext<FolderTreeContextValue | null>(null);

function useFolderTreeCtx(): FolderTreeContextValue {
  const ctx = useContext(FolderTreeCtx);
  if (!ctx) throw new Error('FolderTree components must render inside <FolderTree>');
  return ctx;
}

/**
 * Recursive folder tree for the Notes Library's "By folder" mode. Shares
 * `WebsiteGroup`'s CSS grid-rows expand/collapse pattern and `NoteViewer`'s
 * inline two-step delete-confirm — no modals anywhere in this codebase.
 * Moving a note into a folder works two ways: the `MoveToFolderMenu` on
 * each note row, and native HTML5 drag-and-drop of a note onto a folder
 * (or onto the synthetic Unfiled node) — both call the same `onMoveNote`.
 */
export function FolderTree({
  tree,
  unfiledNotes,
  strings,
  lang,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveNote,
}: FolderTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingChildId, setAddingChildId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [creatingTopLevel, setCreatingTopLevel] = useState(false);

  const flatFoldersForMenu = useMemo(() => flattenFolderTreeForMenu(tree), [tree]);

  function onToggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Idempotent, unlike onToggleExpand — used to open a folder that just
  // gained a new sub-folder, so the result of adding it is immediately
  // visible instead of silently landing inside a still-collapsed parent.
  function onExpand(id: string) {
    setExpandedIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }

  const ctxValue: FolderTreeContextValue = {
    strings,
    lang,
    expandedIds,
    onToggleExpand,
    onExpand,
    editingId,
    setEditingId,
    addingChildId,
    setAddingChildId,
    deletingId,
    setDeletingId,
    dragOverId,
    setDragOverId,
    flatFoldersForMenu,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    onMoveNote,
  };

  return (
    <FolderTreeCtx.Provider value={ctxValue}>
      <div className="hm-folder-tree">
        <div className="hm-folder-tree__toolbar">
          <button type="button" className="hm-link" onClick={() => setCreatingTopLevel(true)}>
            + {strings.newFolder}
          </button>
        </div>
        {creatingTopLevel && (
          <FolderNameForm
            placeholder={strings.folderNamePlaceholder}
            saveLabel={strings.save}
            cancelLabel={strings.cancel}
            onSave={(name) => {
              void onCreateFolder(name, null);
              setCreatingTopLevel(false);
            }}
            onCancel={() => setCreatingTopLevel(false)}
          />
        )}
        <ul className="hm-folder-tree__list">
          {tree.map((node) => (
            <FolderNodeItem key={node.folder.id} node={node} depth={0} />
          ))}
          <UnfiledNode notes={unfiledNotes} />
        </ul>
      </div>
    </FolderTreeCtx.Provider>
  );
}

/** Drop-target event handlers for a folder (or the synthetic Unfiled node)
 *  — shared so drag-over highlight state and the drop logic aren't
 *  duplicated between `FolderNodeItem` and `UnfiledNode`. */
function useDropTargetProps(id: string, onDropNote: (noteId: string) => void) {
  const { dragOverId, setDragOverId } = useFolderTreeCtx();
  return {
    'data-drag-over': dragOverId === id,
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverId(id);
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    onDragLeave: (e: React.DragEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOverId(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverId(null);
      const noteId = e.dataTransfer.getData(NOTE_DRAG_MIME);
      if (noteId) onDropNote(noteId);
    },
  };
}

function FolderNoteList({ notes }: { notes: Note[] }) {
  const { strings, lang, flatFoldersForMenu, onCreateFolder, onMoveNote } = useFolderTreeCtx();
  if (notes.length === 0) return null;
  return (
    <ul className="hm-folder-node__notes">
      {notes.map((note) => (
        <li
          key={note.id}
          className="hm-folder-note"
          draggable
          onDragStart={(e) => e.dataTransfer.setData(NOTE_DRAG_MIME, note.id)}
        >
          <NoteRow note={note} strings={strings} lang={lang} showDomain />
          <MoveToFolderMenu
            note={note}
            folders={flatFoldersForMenu}
            strings={strings}
            onMove={onMoveNote}
            onCreateFolder={(name) => onCreateFolder(name, null)}
          />
        </li>
      ))}
    </ul>
  );
}

function FolderNodeItem({ node, depth }: { node: FolderNode; depth: number }) {
  const {
    strings,
    expandedIds,
    onToggleExpand,
    onExpand,
    editingId,
    setEditingId,
    addingChildId,
    setAddingChildId,
    deletingId,
    setDeletingId,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    onMoveNote,
  } = useFolderTreeCtx();

  const folder = node.folder;
  const expanded = expandedIds.has(folder.id);
  const isEditing = editingId === folder.id;
  const isAddingChild = addingChildId === folder.id;
  const isDeleting = deletingId === folder.id;
  const dropProps = useDropTargetProps(folder.id, (noteId) => onMoveNote(noteId, folder.id));

  return (
    <li>
      <div
        className="hm-folder-node"
        style={{ paddingInlineStart: depth * 16 }}
        {...dropProps}
        // The hover highlight already spans the whole row (matching
        // `WebsiteGroup`'s single big header button in "By site" mode), so
        // clicks anywhere in that visual area toggle too — not just the
        // tiny chevron and the name text. Can't wrap the row in a single
        // `<button>` like `WebsiteGroup` does, since it also hosts the
        // add/rename/delete action buttons (nesting interactive elements
        // isn't valid), so this only fires for clicks that land on the row
        // itself (its own padding/gaps) rather than on a descendant —
        // `.hm-folder-node__glyph` and `.hm-folder-node__count` are given
        // `pointer-events: none` so clicks on those purely-visual bits pass
        // through and count as "the row" too. The toggle/name buttons keep
        // their own `onClick` unchanged, so keyboard/AT behavior for them
        // is untouched.
        onClick={(e) => {
          if (e.target === e.currentTarget) onToggleExpand(folder.id);
        }}
      >
        <button
          type="button"
          className="hm-folder-node__toggle"
          aria-expanded={expanded}
          onClick={() => onToggleExpand(folder.id)}
        >
          <ChevronIcon expanded={expanded} />
        </button>
        <FolderGlyph />
        {isEditing ? (
          <FolderNameForm
            initialValue={folder.name}
            placeholder={strings.folderNamePlaceholder}
            saveLabel={strings.save}
            cancelLabel={strings.cancel}
            onSave={(name) => {
              onRenameFolder(folder.id, name);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <button
            type="button"
            className="hm-folder-node__name"
            onClick={() => onToggleExpand(folder.id)}
          >
            {folder.name}
          </button>
        )}
        {!isEditing && (
          <>
            <span className="hm-folder-node__count">{strings.notesCount(node.totalCount)}</span>
            <span className="hm-folder-node__actions">
              <button
                type="button"
                className="hm-icon-btn"
                aria-label={strings.addSubfolder}
                onClick={() => setAddingChildId(folder.id)}
              >
                <PlusIcon />
              </button>
              <button
                type="button"
                className="hm-icon-btn"
                aria-label={strings.renameFolder}
                onClick={() => setEditingId(folder.id)}
              >
                <PencilIcon />
              </button>
              <button
                type="button"
                className="hm-icon-btn"
                aria-label={strings.deleteFolder}
                onClick={() => setDeletingId(folder.id)}
              >
                <TrashIcon />
              </button>
            </span>
          </>
        )}
      </div>

      {isDeleting && (
        <div className="hm-folder-node__confirm">
          <p>{strings.deleteFolderConfirm(folder.name)}</p>
          <div className="hm-row">
            <button
              type="button"
              className="hm-btn hm-btn-ghost"
              onClick={() => setDeletingId(null)}
            >
              {strings.keepIt}
            </button>
            <button
              type="button"
              className="hm-btn hm-btn-danger"
              onClick={() => {
                onDeleteFolder(folder.id);
                setDeletingId(null);
              }}
            >
              {strings.delete}
            </button>
          </div>
        </div>
      )}

      {isAddingChild && (
        <FolderNameForm
          placeholder={strings.folderNamePlaceholder}
          saveLabel={strings.save}
          cancelLabel={strings.cancel}
          onSave={(name) => {
            void onCreateFolder(name, folder.id);
            onExpand(folder.id);
            setAddingChildId(null);
          }}
          onCancel={() => setAddingChildId(null)}
        />
      )}

      <div
        className="hm-folder-node__body"
        data-expanded={expanded}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        {/* `.hm-folder-node__body`'s single-row `grid-template-rows: 0fr`
         *  collapse trick only clips a *single* grid item — with the notes
         *  list and the sub-folder list as two separate direct children,
         *  CSS grid auto-placement puts the second one in its own implicit
         *  row (sized `auto` by default), which never collapses. Wrapping
         *  both in one element keeps `.hm-folder-node__body` down to exactly
         *  one grid item, so the whole thing collapses together. */}
        <div className="hm-folder-node__body-inner">
          <FolderNoteList notes={node.notes} />
          {node.children.length > 0 && (
            <ul className="hm-folder-node__children">
              {node.children.map((child) => (
                <FolderNodeItem key={child.folder.id} node={child} depth={depth + 1} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

function UnfiledNode({ notes }: { notes: Note[] }) {
  const { strings, expandedIds, onToggleExpand, onMoveNote } = useFolderTreeCtx();
  const expanded = expandedIds.has(UNFILED_ID);
  const dropProps = useDropTargetProps(UNFILED_ID, (noteId) => onMoveNote(noteId, undefined));

  return (
    <li>
      <div
        className="hm-folder-node hm-folder-node--unfiled"
        {...dropProps}
        onClick={(e) => {
          if (e.target === e.currentTarget) onToggleExpand(UNFILED_ID);
        }}
      >
        <button
          type="button"
          className="hm-folder-node__toggle"
          aria-expanded={expanded}
          onClick={() => onToggleExpand(UNFILED_ID)}
        >
          <ChevronIcon expanded={expanded} />
        </button>
        <button
          type="button"
          className="hm-folder-node__name"
          onClick={() => onToggleExpand(UNFILED_ID)}
        >
          {strings.unfiledSection}
        </button>
        <span className="hm-folder-node__count">{strings.notesCount(notes.length)}</span>
      </div>
      <div
        className="hm-folder-node__body"
        data-expanded={expanded}
        aria-hidden={!expanded}
        inert={!expanded}
      >
        <div className="hm-folder-node__body-inner">
          <FolderNoteList notes={notes} />
        </div>
      </div>
    </li>
  );
}

function FolderNameForm({
  initialValue = '',
  placeholder,
  saveLabel,
  cancelLabel,
  onSave,
  onCancel,
}: {
  initialValue?: string;
  placeholder: string;
  saveLabel: string;
  cancelLabel: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="hm-folder-form">
      <input
        type="text"
        className="hm-folder-form__input"
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) onSave(value.trim());
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button
        type="button"
        className="hm-link"
        disabled={!value.trim()}
        onClick={() => onSave(value.trim())}
      >
        {saveLabel}
      </button>
      <button type="button" className="hm-link" onClick={onCancel}>
        {cancelLabel}
      </button>
    </div>
  );
}

/** Points at the folder glyph beside it when collapsed (►), rotates to
 *  point down when expanded (▼) — the familiar file-explorer convention,
 *  not an up/down flip. */
function ChevronIcon({ expanded }: { expanded: boolean }): ReactNode {
  return (
    <svg
      className="hm-folder-node__chevron"
      data-expanded={expanded}
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
    >
      <path
        d="M3.5 2 L6.5 5 L3.5 8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function FolderGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      aria-hidden="true"
      className="hm-folder-node__glyph"
    >
      <path
        d="M1.5 3.5 A1 1 0 0 1 2.5 2.5 H5.5 L6.8 4 H11.5 A1 1 0 0 1 12.5 5 V10.5 A1 1 0 0 1 11.5 11.5 H2.5 A1 1 0 0 1 1.5 10.5 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M6 2 V10 M2 6 H10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2 10 L2.4 8 L8 2.4 A1 1 0 0 1 9.6 4 L4 9.6 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.5 3.5 H9.5 M4.5 3.5 V2.5 A0.5 0.5 0 0 1 5 2 H7 A0.5 0.5 0 0 1 7.5 2.5 V3.5 M3.5 3.5 L4 10 A0.5 0.5 0 0 0 4.5 10.5 H7.5 A0.5 0.5 0 0 0 8 10 L8.5 3.5"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
