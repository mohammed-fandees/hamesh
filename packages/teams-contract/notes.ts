import { z } from 'zod';

/**
 * Team notes, folders and delta sync.
 *
 * The anchor shapes mirror the extension's public `Anchor` union
 * (src/domain/note.ts) with every string, number and list bounded, and
 * unknown keys rejected — an anchor is stored and served to every team member,
 * so the server accepts exactly the documented shape and nothing else.
 */

const str = (max: number) => z.string().max(max);
const int = z.number().int().min(0).max(1_000_000_000);
const coord = z.number().finite().min(-1e7).max(1e7);

export const ElementAnchor = z.strictObject({
  type: z.literal('element').optional(),
  primarySelector: str(2000).nullable(),
  signals: z.strictObject({
    testId: str(500).optional(),
    id: str(500).optional(),
    ariaLabel: str(500).optional(),
    textSnippet: str(500).optional(),
    tagName: z.string().min(1).max(64),
    classNames: str(1000).optional(),
    href: str(2048).optional(),
    src: str(2048).optional(),
    alt: str(500).optional(),
    role: str(64).optional(),
    dataAttributes: z
      .record(str(128), str(500))
      .refine((r) => Object.keys(r).length <= 20, 'too many data attributes')
      .optional(),
  }),
  fallbackDocumentPosition: z.strictObject({ x: coord, y: coord }),
});

export const VideoAnchor = z.strictObject({
  type: z.literal('video'),
  platform: z.string().min(1).max(40),
  videoId: z.string().min(1).max(200),
  timestamp: z.number().finite().min(0).max(1e7),
  duration: z.number().finite().min(0).max(1e7).optional(),
});

export const TextAnchor = z.strictObject({
  type: z.literal('text'),
  version: z.literal(1),
  exact: z.string().min(1).max(5000),
  context: z.strictObject({ prefix: str(200), suffix: str(200) }),
  textPosition: z.strictObject({ start: int, end: int }),
  path: z
    .strictObject({
      startPath: z.array(int).max(64),
      startOffset: int,
      endPath: z.array(int).max(64),
      endOffset: int,
    })
    .optional(),
  container: z
    .strictObject({ selector: str(2000).optional(), path: z.array(int).max(64).optional() })
    .optional(),
});

export const Anchor = z.union([VideoAnchor, TextAnchor, ElementAnchor]);
export type Anchor = z.infer<typeof Anchor>;

/** Only web pages: no javascript:, data:, file: or extension URLs. */
const PageUrl = z
  .string()
  .max(2048)
  .refine((u) => {
    try {
      const p = new URL(u).protocol;
      return p === 'https:' || p === 'http:';
    } catch {
      return false;
    }
  }, 'must be an http(s) URL');

const NoteContent = z
  .string()
  .max(10_000)
  .refine((s) => s.trim().length > 0, 'must not be empty');

const Ulid = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);

const RequestId = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * POST /v1/teams/:teamId/notes — create a team note, or share a personal one
 * (pass the personal note's id as `requestId`: a retry returns the same team
 * note). No author, team, version or timestamps: the server sets them.
 */
export const CreateNoteRequest = z.strictObject({
  requestId: RequestId,
  originalUrl: PageUrl,
  pageTitle: z.string().max(300).optional(),
  content: NoteContent,
  anchor: Anchor,
  folderId: Ulid.nullable().optional(),
});
export type CreateNoteRequest = z.infer<typeof CreateNoteRequest>;

/**
 * The fields a note edit may carry, before the "at least one of them" rule
 * below. Exported on its own so a client can compose them with the ids the
 * path needs without restating the bounds the server enforces.
 */
export const UpdateNoteFields = z.strictObject({
  version: z.number().int().min(1),
  content: NoteContent.optional(),
  folderId: Ulid.nullable().optional(),
});

/** An edit must change something. */
export const changesSomething = (b: { content?: unknown; folderId?: unknown }): boolean =>
  b.content !== undefined || b.folderId !== undefined;

/** PATCH /v1/teams/:teamId/notes/:noteId — `version` is the one the client last saw. */
export const UpdateNoteRequest = UpdateNoteFields.refine(changesSomething, 'nothing to change');
export type UpdateNoteRequest = z.infer<typeof UpdateNoteRequest>;

export const TeamNote = z.strictObject({
  id: z.string(),
  folderId: z.string().nullable(),
  authorId: z.string().nullable(),
  originalUrl: z.string(),
  pageTitle: z.string().nullable(),
  content: z.string(),
  anchor: Anchor,
  version: z.number().int(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type TeamNote = z.infer<typeof TeamNote>;

/**
 * POST /v1/teams/:teamId/notes and PATCH /v1/teams/:teamId/notes/:noteId — the
 * note as the server now holds it, including the `version` the next edit must
 * quote.
 */
export const NoteResponse = z.strictObject({ note: TeamNote });
export type NoteResponse = z.infer<typeof NoteResponse>;

/**
 * POST /v1/teams/:teamId/notes/:noteId/unshare — the same shape: the note,
 * handed back to its author as it was last shared, so the client can keep a
 * personal copy of what it is about to stop seeing.
 */
export const UnshareResponse = NoteResponse;

export const CreateFolderRequest = z.strictObject({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(100)),
  parentId: Ulid.nullable().optional(),
});
export type CreateFolderRequest = z.infer<typeof CreateFolderRequest>;

export const RenameFolderRequest = z.strictObject({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(100)),
});

export const TeamFolder = z.strictObject({
  id: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type TeamFolder = z.infer<typeof TeamFolder>;

/** POST /v1/teams/:teamId/folders and PATCH /v1/teams/:teamId/folders/:folderId */
export const FolderResponse = z.strictObject({ folder: TeamFolder });
export type FolderResponse = z.infer<typeof FolderResponse>;

export const Tombstone = z.strictObject({ id: z.string(), deleted: z.literal(true) });

/**
 * A sync cursor as it travels back to the server. Opaque, but bounded and
 * base64url, so a client can check the shape of what it stored before putting
 * it in a query string.
 */
export const SyncCursor = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/**
 * GET /v1/teams/:teamId/changes?since=<cursor>&limit=<n>
 *
 * Everything that changed in the team's notes and folders after `since`
 * (omit it for a full snapshot). The cursor is opaque. Keep calling with the
 * returned cursor while `hasMore`. A 410 `cursor_expired` means the cursor is
 * older than the server keeps deletions for: resync from scratch.
 */
export const ChangesResponse = z.strictObject({
  notes: z.array(z.union([TeamNote, Tombstone])),
  folders: z.array(z.union([TeamFolder, Tombstone])),
  cursor: z.string(),
  hasMore: z.boolean(),
});
export type ChangesResponse = z.infer<typeof ChangesResponse>;
