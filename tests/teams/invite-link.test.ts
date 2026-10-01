import { describe, it, expect } from 'vitest';
import { inviteTokenFrom } from '@/ui/teams/invite-link';

describe('inviteTokenFrom', () => {
  const token = 'a'.repeat(43);

  it('takes the token out of a pasted invite link', () => {
    expect(inviteTokenFrom(`https://hamesh.app/join#${token}`)).toBe(token);
    expect(inviteTokenFrom(`  https://hamesh.app/join#${token}  `)).toBe(token);
  });

  it('accepts the token pasted on its own', () => {
    expect(inviteTokenFrom(token)).toBe(token);
  });

  it('refuses anything that is not a token', () => {
    for (const pasted of [
      '',
      '   ',
      'https://hamesh.app/join',
      'https://hamesh.app/join#short',
      `https://hamesh.app/join#${'a'.repeat(44)}`,
      `https://hamesh.app/join#${'!'.repeat(43)}`,
    ]) {
      expect(inviteTokenFrom(pasted), pasted).toBeNull();
    }
  });
});
