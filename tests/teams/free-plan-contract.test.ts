import { describe, it, expect } from 'vitest';
import {
  ClaimFreePlanRequest,
  ClaimFreePlanResponse,
  PlansResponseV2,
  PlansResponseV3,
} from '@hamesh/teams-contract';

const free = {
  code: 'free',
  price: { amountMinor: 0, currency: 'EGP', periodDays: 30 },
  limits: { ownedTeams: 1, membersPerTeam: 3, notesPerTeam: 200 },
  details: {
    name: { ar: 'مجانية', en: 'Free' },
    description: null,
  },
  discount: null,
};

const response = (plans: unknown[]) => ({
  plans,
  payment: { accounts: [], confirm: null },
  terms: { version: '1', termsUrl: 'https://example.com/t', privacyUrl: 'https://example.com/p' },
});

describe('the free-plan contract', () => {
  it('lists a free plan as a price of nothing, in the shape v3 asks for', () => {
    const parsed = PlansResponseV3.parse(response([free]));
    expect(parsed.plans[0]?.price.amountMinor).toBe(0);
    // v3 is v2's shape: the plan picker's own parser reads it unchanged.
    expect(PlansResponseV2.parse(response([free])).plans).toHaveLength(1);
  });

  it('claims a plan by its code and nothing else', () => {
    expect(ClaimFreePlanRequest.parse({ planCode: 'free' })).toEqual({ planCode: 'free' });
    expect(ClaimFreePlanRequest.safeParse({ planCode: '' }).success).toBe(false);
    expect(ClaimFreePlanRequest.safeParse({ planCode: 'x'.repeat(41) }).success).toBe(false);
    // The client never says how long, or for whom: the server decides both.
    expect(ClaimFreePlanRequest.safeParse({ planCode: 'free', days: 400 }).success).toBe(false);
  });

  it('answers with the plan and when its access ends', () => {
    expect(ClaimFreePlanResponse.parse({ plan: 'free', until: 1_800_000_000_000 })).toEqual({
      plan: 'free',
      until: 1_800_000_000_000,
    });
    expect(ClaimFreePlanResponse.safeParse({ plan: 'free' }).success).toBe(false);
  });
});
