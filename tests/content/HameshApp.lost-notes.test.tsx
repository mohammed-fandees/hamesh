// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { installFakeStorage } from '../storage/fake-local-storage';
import { createAnchorHealthRepository } from '@/storage/anchor-health-repository';
import {
  PAGE,
  elementAt,
  memoryRepo,
  noteOn,
  renderPage,
  stubBrowserBits,
  wordsOf,
} from './lost-support';

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

describe('HameshApp — the pill, the list, and putting a note back', () => {
  let fake: ReturnType<typeof installFakeStorage>;

  const lostEntry = {
    status: 'lost',
    misses: 2,
    lastCheckedAt: '2026-11-01T00:00:00.000Z',
    pageKey: PAGE,
  };
  const PILL = "1 note couldn't find its place";

  /** Lets the page load its notes and the health store, without reaching a verdict. */
  async function settle() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    fake = installFakeStorage();
    fake.store.set('local:hamesh:anchor-health', { n1: lostEntry });
    document.body.innerHTML = ARTICLE;
    stubBrowserBits(document.querySelector('#other p'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('puts an element note back where the reader clicks, and counts it', async () => {
    const repo = memoryRepo([noteOn('n1', elementAt('#renaissance'), 'the opening chapter')]);
    const healthRepo = createAnchorHealthRepository();
    const count = vi.fn();
    const { container } = renderPage({ repo, healthRepo, count });
    await settle();

    fireEvent.click(screen.getByRole('button', { name: PILL }));
    const list = screen.getByRole('dialog', { name: 'Notes that lost their place' });
    fireEvent.click(within(list).getByRole('button', { name: 'Put it back' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Click the part of the page this note belongs to',
    );
    const overlay = container.querySelector('.hm-capture')!;
    fireEvent.click(overlay, { clientX: 20, clientY: 20 });
    await settle();

    expect(repo.setAnchor).toHaveBeenCalledTimes(1);
    expect(repo.notes()[0]).toMatchObject({ id: 'n1', content: 'the opening chapter' });
    expect(repo.notes()[0].anchor).not.toEqual(elementAt('#renaissance'));
    expect(await healthRepo.read()).toEqual({});
    expect(count).toHaveBeenCalledWith('lost.reattached.element');
    expect(screen.queryByRole('button', { name: PILL })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('puts a text note back on the words the reader selects', async () => {
    const repo = memoryRepo([noteOn('n1', wordsOf('the colonisability'), 'on colonisability')]);
    const healthRepo = createAnchorHealthRepository();
    const count = vi.fn();
    let activateText: () => void = () => {};
    renderPage({ repo, healthRepo, count, onActivateText: (fn) => (activateText = fn) });
    await settle();

    fireEvent.click(screen.getByRole('button', { name: PILL }));
    fireEvent.click(screen.getByRole('button', { name: 'Put it back' }));
    expect(screen.getByRole('status')).toHaveTextContent('Select the words this note belongs to');

    const text = document.querySelector('#other p')!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 'Man, soil and time'.length);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    act(() => activateText());
    await settle();

    expect(repo.notes()[0].anchor).toMatchObject({ type: 'text', exact: 'Man, soil and time' });
    expect(count).toHaveBeenCalledWith('lost.reattached.text');
    expect(await healthRepo.read()).toEqual({});
  });

  it('backs out of putting a note back on Escape, writing nothing', async () => {
    const repo = memoryRepo([noteOn('n1', wordsOf('the colonisability'))]);
    renderPage({ repo, healthRepo: createAnchorHealthRepository() });
    await settle();
    fireEvent.click(screen.getByRole('button', { name: PILL }));
    fireEvent.click(screen.getByRole('button', { name: 'Put it back' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: PILL })).toBeInTheDocument();
    expect(repo.setAnchor).not.toHaveBeenCalled();
  });

  it('keeps a note without a place, and counts only a kept one', async () => {
    const repo = memoryRepo([noteOn('n1', elementAt('#renaissance'))]);
    const healthRepo = createAnchorHealthRepository();
    const count = vi.fn();
    renderPage({ repo, healthRepo, count });
    await settle();

    fireEvent.click(screen.getByRole('button', { name: PILL }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep without a place' }));
    await settle();

    expect((await healthRepo.read()).n1.status).toBe('kept-without-place');
    expect(count).toHaveBeenCalledWith('lost.kept');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says so when keeping could not be saved, and counts nothing', async () => {
    const repo = memoryRepo([noteOn('n1', elementAt('#renaissance'))]);
    const healthRepo = createAnchorHealthRepository();
    vi.spyOn(healthRepo, 'keepWithoutPlace').mockRejectedValue(new Error('quota'));
    const count = vi.fn();
    renderPage({ repo, healthRepo, count });
    await settle();

    fireEvent.click(screen.getByRole('button', { name: PILL }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep without a place' }));
    await settle();

    expect(screen.getByText("Couldn't save. Try again.")).toBeInTheDocument();
    expect(count).not.toHaveBeenCalled();
  });

  it('keeps the list open on a press inside it, and closes it on a press on the page', async () => {
    renderPage({
      repo: memoryRepo([noteOn('n1', elementAt('#renaissance'))]),
      healthRepo: createAnchorHealthRepository(),
    });
    await settle();
    fireEvent.click(screen.getByRole('button', { name: PILL }));
    fireEvent.pointerDown(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerDown(document.querySelector('#other')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the list, not an empty viewer, when the Library opens a lost note', async () => {
    let restore: (id: string) => void = () => {};
    renderPage({
      repo: memoryRepo([noteOn('n1', elementAt('#renaissance'))]),
      healthRepo: createAnchorHealthRepository(),
      onRestore: (fn) => (restore = fn),
    });
    await settle();
    act(() => restore('n1'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(screen.getByRole('dialog', { name: 'Notes that lost their place' })).toBeInTheDocument();
  });

  it('says it in Arabic', async () => {
    renderPage({
      repo: memoryRepo([noteOn('n1', elementAt('#renaissance'))]),
      healthRepo: createAnchorHealthRepository(),
      lang: 'ar',
    });
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'ملاحظة لم تجد مكانها' }));
    expect(screen.getByRole('button', { name: 'أعِدها لمكانها' })).toBeInTheDocument();
  });
});

describe('HameshApp — a note kept without a place', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const fake = installFakeStorage();
    fake.store.set('local:hamesh:anchor-health', {
      n1: {
        status: 'kept-without-place',
        misses: 2,
        lastCheckedAt: '2026-11-01T00:00:00.000Z',
        pageKey: PAGE,
      },
    });
    document.body.innerHTML = ARTICLE;
    stubBrowserBits(document.querySelector('#other p'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens from the Library without pointing at the x/y guess', async () => {
    let restore: (id: string) => void = () => {};
    renderPage({
      repo: memoryRepo([noteOn('n1', elementAt('#renaissance'), 'the opening chapter')]),
      healthRepo: createAnchorHealthRepository(),
      onRestore: (fn) => (restore = fn),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    act(() => restore('n1'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(screen.getByText('the opening chapter')).toBeInTheDocument();
    expect(document.querySelector('.hm-restore-highlight')).toBeNull();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'View note' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /couldn't find/ })).not.toBeInTheDocument();
  });
});
