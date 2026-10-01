import { splitBody } from './mentions';
import type { TeamsStrings } from './strings';

/**
 * A comment's words, with the people named in it shown by name — in the
 * discussion under a note and in the Mentions inbox alike.
 *
 * A mention is stored as an id, so it is named here from whoever the page
 * knows, and someone who has since left is still shown as someone. Tinted
 * rather than boxed, so a sentence full of names still reads as a sentence;
 * the reader's own name is the one that carries weight.
 */
export function MentionText({
  body,
  nameOf,
  myUserId,
  strings,
}: {
  body: string;
  nameOf: (userId: string) => string | undefined;
  myUserId: string | null;
  strings: Pick<TeamsStrings, 'formerMember'>;
}) {
  return (
    <>
      {splitBody(body, nameOf).map((part, i) =>
        part.kind === 'text' ? (
          <span key={i}>{part.text}</span>
        ) : (
          <span key={i} className="hm-mention" data-me={part.userId === myUserId}>
            @<bdi>{part.name ?? strings.formerMember}</bdi>
          </span>
        ),
      )}
    </>
  );
}
