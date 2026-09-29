import { describe, it, expect } from 'vitest';
import { formatMoney, inviteTokenFrom } from '@/ui/teams/format';

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

describe('formatMoney', () => {
  it('shows minor units as the currency the server named', () => {
    // 450 EGP arrives as 45000 minor units; the extension knows no prices.
    const shown = formatMoney(45_000, 'EGP', 'en');
    expect(shown).toMatch(/450/);
    expect(shown).not.toMatch(/45000/);
  });

  it('falls back rather than throwing on a currency it does not know', () => {
    expect(formatMoney(1234, 'XYZ-not-a-currency', 'en')).toBe('12.34 XYZ-not-a-currency');
  });
});
