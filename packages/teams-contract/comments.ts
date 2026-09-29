import { z } from 'zod';
import { MAX_COMMENT_LENGTH, MAX_MENTIONS, mentionsIn } from './mentions';

/**
 * Comments, replies and mentions.
 *
 * A body carries mentions as `<@USERID>` tokens; `mentions` lists the same ids.
 * The server checks that the two agree and that every id is a **current member
 * of this team**, so a comment can never reference a stranger — and names are
 * resolved at render time from the member list, never stored in the body.
 *
 * The tokens themselves live in `./mentions.ts`, which carries no schemas, so a
 * client can read and write them without pulling zod in.
 */

export { MAX_COMMENT_LENGTH, MAX_MENTIONS, MENTION_PATTERN, mentionsIn } from './mentions';

const Ulid = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);

const CommentBody = z
  .string()
  .max(MAX_COMMENT_LENGTH)
  .refine((s) => s.trim().length > 0, 'must not be empty');

const RequestId = z
  .string()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * Whether what a body mentions and what it declares are the same set. The rule
 * both requests below carry, on its own so a client can apply it to its own
 * composed shape rather than restating it.
 */
export const mentionsMatchBody = (c: {
  body: string;
  mentions?: string[] | undefined;
}): boolean => {
  const inBody = mentionsIn(c.body);
  const declared = [...new Set(c.mentions ?? [])];
  return inBody.length === declared.length && inBody.every((id) => declared.includes(id));
};

const MENTIONS_RULE = {
  message: 'mentions must match the <@id> tokens in the body',
  path: ['mentions'] as PropertyKey[],
};

/** The fields a new comment carries, before the rule above. */
export const CreateCommentFields = z.strictObject({
  requestId: RequestId,
  body: CommentBody,
  parentId: Ulid.nullable().optional(),
  mentions: z.array(Ulid).max(MAX_MENTIONS).optional(),
});

/**
 * POST /v1/teams/:teamId/notes/:noteId/comments — a top-level comment, or a
 * reply when `parentId` is given (one level only). No author, team or
 * timestamps: the server sets them.
 */
export const CreateCommentRequest = CreateCommentFields.refine(mentionsMatchBody, MENTIONS_RULE);
export type CreateCommentRequest = z.infer<typeof CreateCommentRequest>;

/** The fields an edit carries, before the rule above. */
export const UpdateCommentFields = z.strictObject({
  body: CommentBody,
  mentions: z.array(Ulid).max(MAX_MENTIONS).optional(),
});

/** PATCH /v1/teams/:teamId/comments/:commentId — editing your own comment. */
export const UpdateCommentRequest = UpdateCommentFields.refine(mentionsMatchBody, MENTIONS_RULE);
export type UpdateCommentRequest = z.infer<typeof UpdateCommentRequest>;

/** A comment, with up to `INLINE_REPLIES` of its replies nested one level deep. */
export type Comment = {
  id: string;
  parentId: string | null;
  authorId: string | null;
  body: string;
  mentions: string[];
  createdAt: number;
  editedAt: number | null;
  deleted: boolean;
  replyCount?: number | undefined;
  replies?: Comment[] | undefined;
};

export const Comment: z.ZodType<Comment> = z.strictObject({
  id: z.string(),
  parentId: z.string().nullable(),
  authorId: z.string().nullable(),
  /** Empty for a deleted comment that is kept as a placeholder because it has replies. */
  body: z.string(),
  mentions: z.array(z.string()),
  createdAt: z.number().int(),
  editedAt: z.number().int().nullable(),
  deleted: z.boolean(),
  /** Top-level comments only: how many replies exist (deleted ones excluded). */
  replyCount: z.number().int().optional(),
  /** Top-level comments only: the latest few replies, oldest first. */
  replies: z.array(z.lazy((): z.ZodType<Comment> => Comment)).optional(),
});

/**
 * POST /v1/teams/:teamId/notes/:noteId/comments and
 * PATCH /v1/teams/:teamId/comments/:commentId — the comment as the server now
 * holds it.
 */
export const CommentResponse = z.strictObject({ comment: Comment });
export type CommentResponse = z.infer<typeof CommentResponse>;

/**
 * GET /v1/teams/:teamId/notes/:noteId/comments?after=&limit=
 * Top-level comments oldest first, each with its latest replies; `after` is the
 * id of the last comment the client already has.
 */
export const CommentsResponse = z.strictObject({
  comments: z.array(Comment),
  nextAfter: z.string().nullable(),
});
export type CommentsResponse = z.infer<typeof CommentsResponse>;

/** GET /v1/teams/:teamId/comments/:commentId/replies?after=&limit= */
export const RepliesResponse = z.strictObject({
  replies: z.array(Comment),
  nextAfter: z.string().nullable(),
});
export type RepliesResponse = z.infer<typeof RepliesResponse>;

/** One entry of the caller's mention inbox. */
export const MentionEntry = z.strictObject({
  commentId: z.string(),
  teamId: z.string(),
  teamName: z.string(),
  noteId: z.string(),
  authorId: z.string().nullable(),
  body: z.string(),
  createdAt: z.number().int(),
});
export type MentionEntry = z.infer<typeof MentionEntry>;

/** GET /v1/me/mentions?before=&limit= — newest first. */
export const MentionsResponse = z.strictObject({
  mentions: z.array(MentionEntry),
  nextBefore: z.string().nullable(),
});
export type MentionsResponse = z.infer<typeof MentionsResponse>;
