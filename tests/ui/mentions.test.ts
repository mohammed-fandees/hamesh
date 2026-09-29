import { describe, it, expect } from 'vitest';
import { mentionsIn } from '@hamesh/teams-contract/mentions';
import { insertMention, mentionQueryAt, splitBody } from '@/ui/teams/mentions';

const SARA = '01J0000000000000000000000S';
const OMAR = '01J0000000000000000000000T';
const names: Record<string, string> = { [SARA]: 'Sara', [OMAR]: 'Omar' };
const nameOf = (id: string) => names[id];

describe('drawing a comment body', () => {
  it('splits it into what to print and who it names', () => {
    expect(splitBody(`hello <@${SARA}> and <@${OMAR}>!`, nameOf)).toEqual([
      { kind: 'text', text: 'hello ' },
      { kind: 'mention', userId: SARA, name: 'Sara' },
      { kind: 'text', text: ' and ' },
      { kind: 'mention', userId: OMAR, name: 'Omar' },
      { kind: 'text', text: '!' },
    ]);
  });

  it('says nothing about someone the member list does not have', () => {
    expect(splitBody(`<@${SARA}>`, () => undefined)).toEqual([
      { kind: 'mention', userId: SARA, name: null },
    ]);
  });

  it('leaves text that only looks like a token alone', () => {
    const body = '<@nope> @sara <@0000000000000000000000000>';
    expect(splitBody(body, nameOf)).toEqual([{ kind: 'text', text: body }]);
  });

  it('starts from the beginning every time, however often it is called', () => {
    const body = `a <@${SARA}> b`;
    const first = splitBody(body, nameOf);
    expect(splitBody(body, nameOf)).toEqual(first);
    expect(first.filter((p) => p.kind === 'mention')).toHaveLength(1);
  });

  it('agrees with the contract about which ids a body names', () => {
    const body = `<@${SARA}> and <@${OMAR}> and <@${SARA}> again`;
    const drawn = splitBody(body, nameOf)
      .filter(
        (p): p is { kind: 'mention'; userId: string; name: string | null } => p.kind === 'mention',
      )
      .map((p) => p.userId);
    expect([...new Set(drawn)]).toEqual(mentionsIn(body));
  });
});

describe('typing a mention', () => {
  const query = (body: string) => mentionQueryAt(body, body.length);

  it('offers the picker for an @ that starts a word', () => {
    expect(query('@sa')).toEqual({ query: 'sa', start: 0 });
    expect(query('hello @Sa')).toEqual({ query: 'sa', start: 6 });
    expect(query('hello @')).toEqual({ query: '', start: 6 });
  });

  it('does not offer it for an @ inside a word, such as an email address', () => {
    expect(query('sara@example.test')).toBeNull();
  });

  it('gives up once the sentence has moved on', () => {
    expect(query('@sara said so')).toBeNull();
    expect(query(`@${'x'.repeat(60)}`)).toBeNull();
    expect(query('hello')).toBeNull();
  });

  it('does not reopen inside a token that is already there', () => {
    expect(query(`<@${SARA}>`)).toBeNull();
  });

  it('reads the query at the caret, not at the end of the line', () => {
    const body = 'hi @sa there';
    expect(mentionQueryAt(body, 6)).toEqual({ query: 'sa', start: 3 });
  });

  it('replaces what was typed with a token, and leaves the caret past it', () => {
    const body = 'hi @sa there';
    const found = mentionQueryAt(body, 6)!;
    expect(insertMention(body, found.start, 6, SARA)).toEqual({
      body: `hi <@${SARA}>  there`,
      caret: 3 + `<@${SARA}> `.length,
    });
  });
});
