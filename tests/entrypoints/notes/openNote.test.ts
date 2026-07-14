import { describe, it, expect, vi, beforeEach } from 'vitest';

const tabsCreate = vi.fn();
const tabsSendMessage = vi.fn();
const onMessageAdd = vi.fn();
const onMessageRemove = vi.fn();
const onRemovedAdd = vi.fn();
const onRemovedRemove = vi.fn();

vi.mock('wxt/browser', () => ({
  browser: {
    tabs: {
      create: (...args: unknown[]) => tabsCreate(...args),
      sendMessage: (...args: unknown[]) => tabsSendMessage(...args),
      onRemoved: {
        addListener: (...args: unknown[]) => onRemovedAdd(...args),
        removeListener: (...args: unknown[]) => onRemovedRemove(...args),
      },
    },
    runtime: {
      onMessage: {
        addListener: (...args: unknown[]) => onMessageAdd(...args),
        removeListener: (...args: unknown[]) => onMessageRemove(...args),
      },
    },
  },
}));

async function importOpenNote() {
  return import('@/entrypoints/notes/openNote');
}

describe('openNoteAndRestore', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    tabsCreate.mockReset().mockResolvedValue({ id: 7 });
    tabsSendMessage.mockReset().mockResolvedValue(undefined);
    onMessageAdd.mockReset();
    onMessageRemove.mockReset();
    onRemovedAdd.mockReset();
    onRemovedRemove.mockReset();
  });

  it('creates a tab with the note URL and registers a CONTENT_READY listener', async () => {
    const { openNoteAndRestore } = await importOpenNote();
    await openNoteAndRestore('https://example.com/page', 'note-1');

    expect(tabsCreate).toHaveBeenCalledWith({ url: 'https://example.com/page' });
    expect(onMessageAdd).toHaveBeenCalledTimes(1);
    expect(onRemovedAdd).toHaveBeenCalledTimes(1);
  });

  it('sends RESTORE_NOTE once CONTENT_READY arrives from the matching tab, and cleans up', async () => {
    const { openNoteAndRestore } = await importOpenNote();
    await openNoteAndRestore('https://example.com/page', 'note-1');

    const onMessage = onMessageAdd.mock.calls[0][0] as (
      message: unknown,
      sender: { tab?: { id: number } },
    ) => void;
    onMessage({ type: 'CONTENT_READY' }, { tab: { id: 7 } });

    expect(tabsSendMessage).toHaveBeenCalledWith(7, { type: 'RESTORE_NOTE', noteId: 'note-1' });
    expect(onMessageRemove).toHaveBeenCalledTimes(1);
    expect(onRemovedRemove).toHaveBeenCalledTimes(1);
  });

  it('ignores CONTENT_READY from an unrelated tab', async () => {
    const { openNoteAndRestore } = await importOpenNote();
    await openNoteAndRestore('https://example.com/page', 'note-1');

    const onMessage = onMessageAdd.mock.calls[0][0] as (
      message: unknown,
      sender: { tab?: { id: number } },
    ) => void;
    onMessage({ type: 'CONTENT_READY' }, { tab: { id: 999 } });

    expect(tabsSendMessage).not.toHaveBeenCalled();
    expect(onMessageRemove).not.toHaveBeenCalled();
  });

  it('ignores unrelated message types from the right tab', async () => {
    const { openNoteAndRestore } = await importOpenNote();
    await openNoteAndRestore('https://example.com/page', 'note-1');

    const onMessage = onMessageAdd.mock.calls[0][0] as (
      message: unknown,
      sender: { tab?: { id: number } },
    ) => void;
    onMessage({ type: 'GET_PAGE_STATE' }, { tab: { id: 7 } });

    expect(tabsSendMessage).not.toHaveBeenCalled();
  });

  it('cleans up listeners if the target tab is closed before CONTENT_READY (no send)', async () => {
    const { openNoteAndRestore } = await importOpenNote();
    await openNoteAndRestore('https://example.com/page', 'note-1');

    const onRemoved = onRemovedAdd.mock.calls[0][0] as (tabId: number) => void;
    onRemoved(7);

    expect(onMessageRemove).toHaveBeenCalledTimes(1);
    expect(onRemovedRemove).toHaveBeenCalledTimes(1);
    expect(tabsSendMessage).not.toHaveBeenCalled();
  });

  it('ignores removal of an unrelated tab', async () => {
    const { openNoteAndRestore } = await importOpenNote();
    await openNoteAndRestore('https://example.com/page', 'note-1');

    const onRemoved = onRemovedAdd.mock.calls[0][0] as (tabId: number) => void;
    onRemoved(123);

    expect(onMessageRemove).not.toHaveBeenCalled();
  });

  it('does nothing if the created tab has no id', async () => {
    tabsCreate.mockResolvedValue({});
    const { openNoteAndRestore } = await importOpenNote();
    await openNoteAndRestore('https://example.com/page', 'note-1');

    expect(onMessageAdd).not.toHaveBeenCalled();
    expect(onRemovedAdd).not.toHaveBeenCalled();
  });

  it('gives up and cleans up listeners after the safety-net timeout if CONTENT_READY never arrives', async () => {
    vi.useFakeTimers();
    const { openNoteAndRestore } = await importOpenNote();
    const promise = openNoteAndRestore('https://example.com/page', 'note-1');
    await promise;

    expect(onMessageRemove).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15000);

    expect(onMessageRemove).toHaveBeenCalledTimes(1);
    expect(onRemovedRemove).toHaveBeenCalledTimes(1);
    expect(tabsSendMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('isPlainLeftClick', () => {
  it('is true for an unmodified left click', async () => {
    const { isPlainLeftClick } = await importOpenNote();
    expect(
      isPlainLeftClick({
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true);
  });

  it('is false for ctrl/cmd/shift/alt-modified clicks', async () => {
    const { isPlainLeftClick } = await importOpenNote();
    expect(
      isPlainLeftClick({
        button: 0,
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      isPlainLeftClick({
        button: 0,
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      isPlainLeftClick({
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe(false);
  });

  it('is false for a middle-click', async () => {
    const { isPlainLeftClick } = await importOpenNote();
    expect(
      isPlainLeftClick({
        button: 1,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(false);
  });
});
