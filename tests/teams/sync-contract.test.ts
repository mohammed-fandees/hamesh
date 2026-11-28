import { describe, it, expect } from 'vitest';
import {
  ChangesResponse,
  ChangesResponseV2,
  MeResponse,
  MeResponseV2,
} from '@hamesh/teams-contract';

const TEAM = '01J0000000000000000000000A';

const me = (team: Record<string, unknown>) => ({
  user: { id: '01J0000000000000000000000U', email: 'me@example.test', displayName: 'Me' },
  entitlement: { state: 'none', plan: null, until: null, limits: null, sources: [] },
  subscription: { state: 'none', canceled: false, pendingPayment: null },
  teams: [team],
  serverTime: 1,
});

const team = { id: TEAM, name: 'Alpha', role: 'owner' };

const changes = { notes: [], folders: [], cursor: 'c1', hasMore: false };

/**
 * The counters a device needs to know whether a poke is worth a request, and
 * the reason they can only travel to a client that asked for them.
 */
describe('a team’s change counter on the way to the client', () => {
  it('comes with each team for a client that asked for v2', () => {
    const parsed = MeResponseV2.parse(me({ ...team, changeSeq: 7 }));
    expect(parsed.teams[0]!.changeSeq).toBe(7);
  });

  it('is refused by the answer every shipped build parses', () => {
    // Why the server may only send it to a client that asked: a build already
    // on someone's machine does not ignore the field, it rejects the answer.
    expect(MeResponse.safeParse(me({ ...team, changeSeq: 7 })).success).toBe(false);
    expect(MeResponse.safeParse(me(team)).success).toBe(true);
  });

  it('is required once v2 is asked for, so a client never has to guess', () => {
    expect(MeResponseV2.safeParse(me(team)).success).toBe(false);
  });

  it('counts from zero and never backwards', () => {
    expect(MeResponseV2.safeParse(me({ ...team, changeSeq: 0 })).success).toBe(true);
    expect(MeResponseV2.safeParse(me({ ...team, changeSeq: -1 })).success).toBe(false);
    expect(MeResponseV2.safeParse(me({ ...team, changeSeq: 1.5 })).success).toBe(false);
  });
});

describe('the counter a page of changes reaches', () => {
  it('comes with the page for a client that asked for v2', () => {
    expect(ChangesResponseV2.parse({ ...changes, seq: 9 }).seq).toBe(9);
  });

  it('is refused by the answer every shipped build parses', () => {
    expect(ChangesResponse.safeParse({ ...changes, seq: 9 }).success).toBe(false);
    expect(ChangesResponse.safeParse(changes).success).toBe(true);
  });

  it('is v1’s shape otherwise, so the same reader handles both', () => {
    const { seq, ...rest } = ChangesResponseV2.parse({ ...changes, seq: 9 });
    expect(seq).toBe(9);
    expect(ChangesResponse.parse(rest)).toEqual(changes);
  });
});
