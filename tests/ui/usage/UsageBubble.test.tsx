// @vitest-environment jsdom
import { store, resetStorage } from '../../teams/fake-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemo } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createPreferencesRepository } from '@/storage/preferences-repository';
import { usePreferences } from '@/ui/hooks/usePreferences';
import { getTeamsStrings } from '@/ui/teams/strings';
import { UsageBubble } from '@/ui/usage/UsageBubble';

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getManifest: () => ({ version: '2.3.1' }),
      sendMessage: vi.fn(async () => undefined),
    },
    permissions: {
      request: vi.fn(async () => true),
      contains: vi.fn(async () => true),
      remove: vi.fn(async () => true),
    },
  },
}));

const en = getTeamsStrings('en');
const ar = getTeamsStrings('ar');
const PREFS = 'local:hamesh:preferences';
const sharing = () =>
  (store.get(PREFS) as { usage?: { sharing?: string } } | undefined)?.usage?.sharing;

function Bubble({ lang = 'en' as 'en' | 'ar', onOpenSettings = vi.fn() }) {
  const repo = useMemo(() => createPreferencesRepository(), []);
  return (
    <UsageBubble lang={lang} preferences={usePreferences(repo)} onOpenSettings={onOpenSettings} />
  );
}

beforeEach(() => {
  resetStorage();
  vi.stubEnv('WXT_TEAMS_API_ORIGIN', 'https://api.example.test');
  vi.stubEnv('FIREFOX', '');
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('the usage-sharing bubble in the Library', () => {
  it('waits, folded, in the corner for a reader who never answered', async () => {
    render(<Bubble />);
    const button = await screen.findByRole('button', { name: en.usageBubble });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens into the question, and shares from the click', async () => {
    render(<Bubble />);
    fireEvent.click(await screen.findByRole('button', { name: en.usageBubble }));
    const card = screen.getByRole('dialog', { name: en.usageAskTitle });
    fireEvent.click(within(card).getByRole('button', { name: en.usageAskYes }));
    await waitFor(() => expect(sharing()).toBe('on'));
    expect(await within(card).findByText(en.usageThanks)).toBeInTheDocument();
  });

  it('never shows again after "Don’t show this again", the same answer as No thanks', async () => {
    const first = render(<Bubble />);
    fireEvent.click(await screen.findByRole('button', { name: en.usageBubble }));
    fireEvent.click(screen.getByRole('button', { name: en.usageNeverShow }));
    await waitFor(() => expect(sharing()).toBe('off'));
    first.unmount();

    render(<Bubble />);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('button', { name: en.usageBubble })).not.toBeInTheDocument();
  });

  it('folds away on "Hide for now" and Escape, without answering', async () => {
    render(<Bubble />);
    const button = await screen.findByRole('button', { name: en.usageBubble });
    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: en.usageBubbleHide }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: en.usageBubble })).toBeInTheDocument();
    expect(sharing()).toBeUndefined();
  });

  it('is not shown to a reader who already shares, or said no before', async () => {
    for (const answer of ['on', 'off']) {
      store.set(PREFS, { usage: { sharing: answer } });
      const view = render(<Bubble />);
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByRole('button', { name: en.usageBubble })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it('speaks Arabic', async () => {
    render(<Bubble lang="ar" />);
    fireEvent.click(await screen.findByRole('button', { name: ar.usageBubble }));
    expect(screen.getByRole('button', { name: ar.usageNeverShow })).toBeInTheDocument();
  });
});
