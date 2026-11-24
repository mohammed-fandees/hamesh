// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { installFakeStorage } from '../storage/fake-local-storage';
import { createAnchorHealthRepository } from '@/storage/anchor-health-repository';
import { elementAt, memoryRepo, noteOn, renderPage, stubBrowserBits } from './lost-support';

const ARTICLE = '<section id="other"><p>Man, soil and time, joined by an idea.</p></section>';

/** Lets the page load, then runs one whole visit to its verdict. */
async function visitToVerdict() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(31_000);
  });
}

describe('HameshApp — detecting notes that lost their place', () => {
  let fake: ReturnType<typeof installFakeStorage>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    fake = installFakeStorage();
    document.body.innerHTML = ARTICLE;
    stubBrowserBits(document.querySelector('#other'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('flags a note lost after two visits miss it, and stops drawing it on a guessed element', async () => {
    const repo = memoryRepo([noteOn('n1', elementAt('#renaissance'))]);
    const healthRepo = createAnchorHealthRepository();

    const first = renderPage({ repo, healthRepo });
    await visitToVerdict();
    expect((await healthRepo.read()).n1?.status).toBe('suspect');
    // One miss flags nothing: the old guess is still drawn.
    expect(screen.getByRole('button', { name: 'View note' })).toBeInTheDocument();
    first.unmount();

    renderPage({ repo, healthRepo });
    await visitToVerdict();
    expect((await healthRepo.read()).n1?.status).toBe('lost');
    expect(screen.queryByRole('button', { name: 'View note' })).not.toBeInTheDocument();
  });

  it('clears a lost note on the visit that finds it, and draws it again', async () => {
    const repo = memoryRepo([noteOn('n1', elementAt('#renaissance'))]);
    const healthRepo = createAnchorHealthRepository();
    fake.store.set('local:hamesh:anchor-health', {
      n1: {
        status: 'lost',
        misses: 2,
        lastCheckedAt: '2026-11-01T00:00:00.000Z',
        pageKey: 'http://localhost:3000/',
      },
    });
    document.body.innerHTML = `${ARTICLE}<section id="renaissance">The conditions of renaissance</section>`;

    renderPage({ repo, healthRepo });
    await visitToVerdict();
    expect(await healthRepo.read()).toEqual({});
    expect(screen.getByRole('button', { name: 'View note' })).toBeInTheDocument();
  });

  it('writes nothing for a visit that finds every note', async () => {
    document.body.innerHTML = `${ARTICLE}<section id="renaissance">The conditions</section>`;
    const repo = memoryRepo([noteOn('n1', elementAt('#renaissance'))]);
    renderPage({ repo, healthRepo: createAnchorHealthRepository() });
    await visitToVerdict();
    expect(fake.api.setItem).not.toHaveBeenCalled();
  });
});
