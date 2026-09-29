/**
 * How a comment names someone.
 *
 * A body carries a mention as a `<@USERID>` token and nothing else — never a
 * name, which would go stale the moment someone changed theirs, and never an
 * email. Names are resolved at render time from the team's member list, so a
 * comment can only ever name a current member of the team it belongs to.
 *
 * Kept apart from `./comments.ts`, which describes the wire with zod: a client
 * that only needs to read or write the tokens (a composer, a renderer) reaches
 * this module directly and does not pull a schema library in to do it. Same
 * reason `./errors.ts` stands on its own.
 */

/** Matches every mention token in a body. Global: use with `matchAll`. */
export const MENTION_PATTERN = /<@([0-7][0-9A-HJKMNP-TV-Z]{25})>/g;

export const MAX_COMMENT_LENGTH = 4000;
export const MAX_MENTIONS = 20;

/** The user ids a body mentions, in first-appearance order, without duplicates. */
export function mentionsIn(body: string): string[] {
  return [...new Set(Array.from(body.matchAll(MENTION_PATTERN), (m) => m[1]!))];
}
