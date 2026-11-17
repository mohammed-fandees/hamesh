import { describe, it, expect, vi } from 'vitest';
import { handOverJoinLink, type JoinPageDeps } from '@/teams/join-page';

const TOKEN = 'a'.repeat(43);

function page(href: string, reply: unknown = { ok: true, data: null }) {
  const url = new URL(href);
  const replaced: string[] = [];
  const events: string[] = [];
  const deps: JoinPageDeps = {
    location: { href: url.href, hash: url.hash, pathname: url.pathname, search: url.search },
    replaceUrl: (to) => replaced.push(to),
    send: vi.fn(async () => reply),
    announce: (name) => events.push(name),
  };
  return { deps, replaced, events };
}

describe('the join page, as Hamesh sees it', () => {
  it('hands the token to Hamesh, takes it out of the address, and says so to the page', async () => {
    const p = page(`https://hamesh.fandees.tech/join#${TOKEN}`);
    await handOverJoinLink(p.deps);
    expect(p.deps.send).toHaveBeenCalledWith({
      type: 'TEAMS_PAGE',
      request: { op: 'join', token: TOKEN },
    });
    expect(p.replaced).toEqual(['/join']);
    expect(p.events).toEqual(['hamesh:join-opened']);
  });

  it('says nothing to the page when Hamesh could not take it', async () => {
    const p = page(`https://hamesh.fandees.tech/join#${TOKEN}`, { ok: false, error: 'x' });
    await handOverJoinLink(p.deps);
    expect(p.events).toEqual([]);
  });

  it('survives a worker that does not answer', async () => {
    const p = page(`https://hamesh.fandees.tech/join#${TOKEN}`);
    p.deps.send = vi.fn(async () => {
      throw new Error('Receiving end does not exist');
    });
    await expect(handOverJoinLink(p.deps)).resolves.toBeUndefined();
    expect(p.events).toEqual([]);
  });

  it('does nothing on any other page, or without a whole token', async () => {
    for (const href of [
      `https://example.test/join#${TOKEN}`,
      `https://hamesh.fandees.tech/#${TOKEN}`,
      'https://hamesh.fandees.tech/join',
      `https://hamesh.fandees.tech/join#${TOKEN}x`,
    ]) {
      const p = page(href);
      await handOverJoinLink(p.deps);
      expect(p.deps.send, href).not.toHaveBeenCalled();
      expect(p.replaced, href).toEqual([]);
    }
  });
});
