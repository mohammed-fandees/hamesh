// From the contract's own mention module rather than its barrel: these are a
// pattern and two numbers, and going through the barrel would pull every schema
// (and zod with them) into the Notes Library.
import { MENTION_PATTERN } from '@hamesh/teams-contract/mentions';

/**
 * Reading and writing the `<@USERID>` tokens a comment body carries.
 *
 * A body never holds a name. Names are looked up when a comment is drawn, from
 * the team's own member list, so someone who renames themselves is renamed
 * everywhere they were ever mentioned, and a comment can never carry a name the
 * server did not vouch for.
 */

export type BodyPart =
  { kind: 'text'; text: string } | { kind: 'mention'; userId: string; name: string | null };

/**
 * A body split into what to print: plain runs, and the people it names. `name`
 * is null for someone the member list does not have — one who has left, or a
 * list that has not loaded yet — and the caller decides what to show instead.
 */
export function splitBody(
  body: string,
  nameOf: (userId: string) => string | undefined,
): BodyPart[] {
  const parts: BodyPart[] = [];
  let last = 0;
  // A fresh regex per call: MENTION_PATTERN is global, so sharing one would
  // carry `lastIndex` from the previous body into this one.
  const pattern = new RegExp(MENTION_PATTERN.source, 'g');
  for (const match of body.matchAll(pattern)) {
    const at = match.index;
    if (at > last) parts.push({ kind: 'text', text: body.slice(last, at) });
    parts.push({ kind: 'mention', userId: match[1]!, name: nameOf(match[1]!) ?? null });
    last = at + match[0].length;
  }
  if (last < body.length) parts.push({ kind: 'text', text: body.slice(last) });
  return parts;
}

/** How far back from the caret an unfinished `@name` may reach. */
const MAX_QUERY = 40;

export interface MentionQuery {
  /** What has been typed after the `@`, lowercased. */
  query: string;
  /** Where the `@` itself sits. */
  start: number;
}

/**
 * The `@…` being typed right before the caret, if there is one.
 *
 * Only an `@` that starts a word counts, and only while nothing but ordinary
 * name characters follow it — so an email address, or a sentence that has moved
 * on past a stray `@`, does not keep a picker open.
 */
export function mentionQueryAt(body: string, caret: number): MentionQuery | null {
  const from = Math.max(0, caret - MAX_QUERY - 1);
  const slice = body.slice(from, caret);
  const at = slice.lastIndexOf('@');
  if (at === -1) return null;
  const start = from + at;
  const before = start === 0 ? '' : body[start - 1]!;
  if (before && !/\s/.test(before)) return null;
  const query = body.slice(start + 1, caret);
  if (/[\s<>@]/.test(query)) return null;
  return { query: query.toLowerCase(), start };
}

/**
 * Replaces the `@…` that starts at `start` with a token for `userId`, and says
 * where the caret should sit afterwards — just past the space that follows it,
 * so typing simply continues.
 */
export function insertMention(
  body: string,
  start: number,
  caret: number,
  userId: string,
): { body: string; caret: number } {
  const token = `<@${userId}> `;
  const next = body.slice(0, start) + token + body.slice(caret);
  return { body: next, caret: start + token.length };
}
