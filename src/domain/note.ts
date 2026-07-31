import { DEFAULT_WORKSPACE_ID, type WorkspaceId } from './workspace';

export type SchemaVersion = 1;

export interface ElementAnchor {
  /** Optional so every note stored before `Anchor` became a union (i.e.
   *  every note ever written until now) still discriminates as an element
   *  anchor with no migration needed — see `VideoAnchor.type`. */
  type?: 'element';
  primarySelector: string | null;
  signals: {
    testId?: string;
    id?: string;
    ariaLabel?: string;
    textSnippet?: string;
    tagName: string;
    classNames?: string;
    href?: string;
    src?: string;
    alt?: string;
    role?: string;
    dataAttributes?: Record<string, string>;
  };
  fallbackDocumentPosition: {
    x: number;
    y: number;
  };
}

/**
 * A note anchored to a video timestamp instead of a DOM element. `videoId`
 * and `platform` come from whichever `VideoPlayerAdapter` matched the page
 * at capture time (see `src/content/video-adapters/`) — identity lives here,
 * not in `pageKey`, so pages that host many distinct videos under one URL
 * shape (e.g. every `youtube.com/watch` note) don't need page-key changes.
 */
export interface VideoAnchor {
  type: 'video';
  /** Adapter id that produced this anchor, e.g. 'youtube' | 'html5'. */
  platform: string;
  /** Adapter-resolved stable identifier for the specific video. */
  videoId: string;
  /** Seconds into the video when the note was created. */
  timestamp: number;
  /** Seconds, if known at creation time. */
  duration?: number;
}

export type Anchor = ElementAnchor | VideoAnchor;

/**
 * Metadata about the page a note was created on, kept separate from the note
 * itself so future page-level metadata (description, favicon hint, etc.) can
 * grow here without repeatedly reshaping the top-level Note schema. Optional
 * and additive — notes written before this field existed simply have none.
 */
export interface PageContext {
  title?: string;
}

export interface Note {
  id: string;
  schemaVersion: SchemaVersion;
  pageKey: string;
  originalUrl: string;
  content: string;
  anchor: Anchor;
  /** Every note belongs to a workspace. There is exactly one, implicit
   *  workspace today (`DEFAULT_WORKSPACE_ID`) — see `domain/workspace.ts`.
   *  Notes written before this field existed are backfilled to the default
   *  by `notes-repository.ts`'s `parseStoredNotes`, the same pattern used
   *  for every other additive field here. */
  workspaceId: WorkspaceId;
  pageContext?: PageContext;
  /** User-marked "keep this handy" flag. Optional — absent/undefined on
   *  every note written before this field existed, treated the same as
   *  `false`. Toggling it is a metadata action, not an edit, so it
   *  deliberately does not touch `updatedAt` (see `setNotePinned`) —
   *  pinning a note shouldn't make it jump to the top of a "most recently
   *  edited" sort. */
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateNoteInput = {
  content: string;
  pageKey: string;
  originalUrl: string;
  anchor: Anchor;
  pageContext?: PageContext;
  /** Defaults to `DEFAULT_WORKSPACE_ID` when omitted — every caller today
   *  omits it; a future workspace picker would pass the active workspace. */
  workspaceId?: WorkspaceId;
};

export type UpdateNoteInput = {
  content: string;
};

export interface NoteValidationError {
  field: keyof Note | 'content' | 'anchor';
  message: string;
}

export function createNote(input: CreateNoteInput): Note {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    pageKey: input.pageKey,
    originalUrl: input.originalUrl,
    content: input.content,
    anchor: input.anchor,
    workspaceId: input.workspaceId ?? DEFAULT_WORKSPACE_ID,
    pageContext: input.pageContext,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateNoteContent(note: Note, input: UpdateNoteInput): Note {
  return {
    ...note,
    content: input.content,
    updatedAt: new Date().toISOString(),
  };
}

/** Toggles the pin flag without touching `updatedAt` — see `Note.pinned`. */
export function setNotePinned(note: Note, pinned: boolean): Note {
  return { ...note, pinned };
}

export function validateNoteContent(content: string): NoteValidationError | null {
  if (typeof content !== 'string') {
    return { field: 'content', message: 'Content must be a string' };
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { field: 'content', message: 'Content cannot be empty' };
  }
  if (trimmed.length > 10000) {
    return { field: 'content', message: 'Content cannot exceed 10000 characters' };
  }
  return null;
}

export function validateNote(note: Note): NoteValidationError[] {
  const errors: NoteValidationError[] = [];
  if (!note.id) errors.push({ field: 'id', message: 'ID is required' });
  if (!note.pageKey) errors.push({ field: 'pageKey', message: 'Page key is required' });
  if (!note.originalUrl) errors.push({ field: 'originalUrl', message: 'Original URL is required' });
  const anchorValid =
    !!note.anchor && (note.anchor.type === 'video' ? !!note.anchor.videoId : !!note.anchor.signals);
  if (!anchorValid) {
    errors.push({ field: 'anchor', message: 'Anchor is required' });
  }
  const contentErr = validateNoteContent(note.content);
  if (contentErr) errors.push(contentErr);
  return errors;
}
