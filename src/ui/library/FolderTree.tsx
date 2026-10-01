import { createContext, useContext, useState, type CSSProperties } from 'react';
import { FOLDER_NAME_MAX } from '@/domain/folder';
import type { FolderNode } from '@/domain/folder-grouping';
import type { Note } from '@/domain/note';
import { FolderMenu } from '../FolderMenu';
import { NameField } from '../kit/NameField';
import { ChevronIcon, FolderIcon, PlusIcon } from '../kit/icons';
import type { Lang, Strings } from '../i18n';
import { NoteRow } from './NoteRow';

/** Custom MIME type carrying a dragged note's id — namespaced so it never
 *  collides with a browser/OS default drag payload. */
const NOTE_DRAG_MIME = 'application/x-hamesh-note-id';

/** The synthetic "Unfiled" folder's key in the expanded set. Unfiled is not a
 *  folder — it cannot be renamed or deleted — but notes can be dropped on it. */
const UNFILED = 'unfiled';

interface FolderTreeProps {
  tree: FolderNode[];
  unfiledNotes: Note[];
  strings: Strings;
  lang: Lang;
  onCreateFolder: (name: string, parentId: string | null) => Promise<unknown>;
  onRenameFolder: (folderId: string, name: string) => Promise<unknown>;
  onDeleteFolder: (folderId: string) => Promise<unknown>;
  onMoveNote: (noteId: string, folderId: string | undefined) => void;
}

interface TreeState {
  strings: Strings;
  lang: Lang;
  expanded: ReadonlySet<string>;
  toggle: (id: string) => void;
  open: (id: string) => void;
  dragOver: string | null;
  setDragOver: (id: string | null) => void;
  props: FolderTreeProps;
}

const TreeContext = createContext<TreeState | null>(null);
const useTree = () => useContext(TreeContext)!;

const depthStyle = (depth: number) => ({ '--hm-depth': depth }) as CSSProperties;

/**
 * The Library's "By folder" view: one card of folders, each opening onto its
 * notes and the folders inside it, and "Unfiled" last for everything else.
 *
 * Every folder's actions are in its "⋮" (`FolderMenu`) — the same menu a team's
 * folders have — and every note is the same row every list uses, with "Move
 * to folder" in its own menu. Notes can also be dragged onto a folder (or onto
 * Unfiled): a mouse-only shortcut to the same move.
 */
export function FolderTree(props: FolderTreeProps) {
  const { tree, unfiledNotes, strings, lang, onCreateFolder } = props;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const state: TreeState = {
    strings,
    lang,
    expanded,
    toggle: (id) =>
      setExpanded((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    // Idempotent: a folder that just gained a folder opens, so what was made
    // is in view rather than inside something still shut.
    open: (id) => setExpanded((prev) => (prev.has(id) ? prev : new Set(prev).add(id))),
    dragOver,
    setDragOver,
    props,
  };

  return (
    <TreeContext.Provider value={state}>
      <div className="hm-folder-tree">
        <div className="hm-folder-tree__toolbar">
          {creating ? (
            <NameField
              label={strings.newFolder}
              placeholder={strings.folderNamePlaceholder}
              maxLength={FOLDER_NAME_MAX}
              submitLabel={strings.create}
              cancelLabel={strings.cancel}
              onCancel={() => setCreating(false)}
              onSubmit={(name) => {
                void onCreateFolder(name, null);
                setCreating(false);
              }}
            />
          ) : (
            <button type="button" className="hm-add" onClick={() => setCreating(true)}>
              <PlusIcon size={11} />
              {strings.newFolder}
            </button>
          )}
        </div>
        <ul className="hm-rows hm-rows--card hm-folder-tree__list">
          {tree.map((node) => (
            <FolderItem key={node.folder.id} node={node} depth={0} />
          ))}
          <UnfiledItem notes={unfiledNotes} />
        </ul>
      </div>
    </TreeContext.Provider>
  );
}

/** Drop-target handlers for a folder or Unfiled, and the highlight while a
 *  note is over it. */
function useDropTarget(id: string, onDropNote: (noteId: string) => void) {
  const { dragOver, setDragOver } = useTree();
  return {
    'data-drag-over': dragOver === id,
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(id);
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    onDragLeave: (e: React.DragEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(null);
      const noteId = e.dataTransfer.getData(NOTE_DRAG_MIME);
      if (noteId) onDropNote(noteId);
    },
  };
}

/** A folder's (or Unfiled's) row: one button that opens and shuts it — the
 *  chevron, the name and the count — as a site group's header is, and its menu
 *  beside it. */
function FolderRow({
  id,
  name,
  count,
  depth,
  unfiled,
  onDropNote,
  menu,
}: {
  id: string;
  name: string;
  count: number;
  depth: number;
  unfiled?: boolean;
  onDropNote: (noteId: string) => void;
  menu?: React.ReactNode;
}) {
  const { strings, expanded, toggle } = useTree();
  const open = expanded.has(id);
  const drop = useDropTarget(id, onDropNote);
  return (
    <div
      className={unfiled ? 'hm-folder-node hm-folder-node--unfiled' : 'hm-folder-node'}
      style={depthStyle(depth)}
      {...drop}
    >
      <button
        type="button"
        className="hm-folder-node__name"
        aria-expanded={open}
        onClick={() => toggle(id)}
      >
        <ChevronIcon direction="forward" className="hm-folder-node__chevron" />
        {!unfiled && <FolderIcon className="hm-folder-node__glyph" />}
        <span className="hm-folder-node__label">{name}</span>
        <span className="hm-folder-node__count">{strings.notesCount(count)}</span>
      </button>
      {menu}
    </div>
  );
}

/** What an open folder holds: its notes, then the folders inside it. */
function FolderBody({
  id,
  depth,
  children,
}: {
  id: string;
  depth: number;
  children: React.ReactNode;
}) {
  const open = useTree().expanded.has(id);
  return (
    <div className="hm-folder-node__body" data-expanded={open} aria-hidden={!open} inert={!open}>
      {/* The collapse trick sizes its one grid row from its one item, so the
          notes and the child folders share this single wrapper. */}
      <div className="hm-folder-node__body-inner" style={depthStyle(depth + 1)}>
        {children}
      </div>
    </div>
  );
}

function FolderNotes({ notes, depth }: { notes: Note[]; depth: number }) {
  const { strings, lang } = useTree();
  if (notes.length === 0) return null;
  return (
    <ul className="hm-rows">
      {notes.map((note) => (
        <li
          key={note.id}
          className="hm-folder-note"
          style={depthStyle(depth)}
          draggable
          onDragStart={(e) => e.dataTransfer.setData(NOTE_DRAG_MIME, note.id)}
        >
          <NoteRow note={note} strings={strings} lang={lang} showDomain movable />
        </li>
      ))}
    </ul>
  );
}

function FolderItem({ node, depth }: { node: FolderNode; depth: number }) {
  const { strings, open, props } = useTree();
  const { folder } = node;
  return (
    <li>
      <FolderRow
        id={folder.id}
        name={folder.name}
        count={node.totalCount}
        depth={depth}
        onDropNote={(noteId) => props.onMoveNote(noteId, folder.id)}
        menu={
          <FolderMenu
            name={folder.name}
            strings={strings}
            deleteQuestion={strings.deleteFolderConfirm(folder.name)}
            onRename={(name) => props.onRenameFolder(folder.id, name)}
            onDelete={() => props.onDeleteFolder(folder.id)}
            onAddChild={async (name) => {
              await props.onCreateFolder(name, folder.id);
              open(folder.id);
            }}
          />
        }
      />
      <FolderBody id={folder.id} depth={depth}>
        <FolderNotes notes={node.notes} depth={depth + 1} />
        {node.children.length > 0 && (
          <ul className="hm-rows">
            {node.children.map((child) => (
              <FolderItem key={child.folder.id} node={child} depth={depth + 1} />
            ))}
          </ul>
        )}
      </FolderBody>
    </li>
  );
}

function UnfiledItem({ notes }: { notes: Note[] }) {
  const { strings, props } = useTree();
  return (
    <li>
      <FolderRow
        id={UNFILED}
        name={strings.unfiledSection}
        count={notes.length}
        depth={0}
        unfiled
        onDropNote={(noteId) => props.onMoveNote(noteId, undefined)}
      />
      <FolderBody id={UNFILED} depth={0}>
        <FolderNotes notes={notes} depth={1} />
      </FolderBody>
    </li>
  );
}
