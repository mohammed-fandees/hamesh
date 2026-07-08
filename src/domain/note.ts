export type SchemaVersion = 1;

export interface ElementAnchor {
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

export interface Note {
  id: string;
  schemaVersion: SchemaVersion;
  pageKey: string;
  originalUrl: string;
  content: string;
  anchor: ElementAnchor;
  createdAt: string;
  updatedAt: string;
}

export type CreateNoteInput = {
  content: string;
  pageKey: string;
  originalUrl: string;
  anchor: ElementAnchor;
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
  if (!note.anchor || !note.anchor.signals) {
    errors.push({ field: 'anchor', message: 'Anchor is required' });
  }
  const contentErr = validateNoteContent(note.content);
  if (contentErr) errors.push(contentErr);
  return errors;
}
