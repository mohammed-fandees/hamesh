// @vitest-environment jsdom
import { store, resetStorage } from '../teams/fake-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMemo } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { utcDay } from '@/domain/usage';
import { createPreferencesRepository } from '@/storage/preferences-repository';
import { usePreferences } from '@/ui/hooks/usePreferences';
import { getTeamsStrings } from '@/ui/teams/strings';
import { UsageAsk } from '@/ui/usage/UsageAsk';
import { UsageSettings } from '@/ui/usage/UsageSettings';

const permissions = {
  request: vi.fn(async () => true),
  contains: vi.fn(async () => true),
  remove: vi.fn(async () => true),
};

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      getManifest: () => ({ version: '2.2.0' }),
      sendMessage: vi.fn(async () => undefined),
    },
    permissions: {
      request: (...a: unknown[]) => permissions.request(...(a as [])),
      contains: (...a: unknown[]) => permissions.contains(...(a as [])),
      remove: (...a: unknown[]) => permissions.remove(...(a as [])),
    },
  },
}));

const en = getTeamsStrings('en');
const ar = getTeamsStrings('ar');
const PREFS = 'local:hamesh:preferences';
const LEDGER = 'local:hamesh:usage';

function Settings({ lang = 'en' as const }: { lang?: 'en' | 'ar' }) {
  const repo = useMemo(() => createPreferencesRepository(), []);
  return <UsageSettings lang={lang} preferences={usePreferences(repo)} />;
}

function Ask({
  where,
  onOpenSettings = vi.fn(),
}: {
  where: 'whats-new' | 'guide';
  onOpenSettings?: () => void;
}) {
  const repo = useMemo(() => createPreferencesRepository(), []);
  return (
    <UsageAsk
      lang="en"
      preferences={usePreferences(repo)}
      where={where}
      onOpenSettings={onOpenSettings}
    />
  );
}

const sharing = () =>
  (store.get(PREFS) as { usage?: { sharing?: string } } | undefined)?.usage?.sharing;

beforeEach(() => {
  resetStorage();
  vi.stubEnv('WXT_TEAMS_API_ORIGIN', 'https://api.example.test');
  vi.stubEnv('FIREFOX', '');
  permissions.request.mockResolvedValue(true);
  permissions.request.mockClear();
  permissions.remove.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('Settings → Help improve Hamesh', () => {
  it('is off until the reader turns it on', async () => {
    render(<Settings />);
    const toggle = await screen.findByRole('switch', { name: en.usageSwitch });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(en.usageHint)).toBeInTheDocument();
  });

  it("shows today's report from this device's own counts", async () => {
    store.set(PREFS, { usage: { sharing: 'on' } });
    store.set(LEDGER, {
      day: utcDay(Date.now()),
      counts: { 'note.created.text': 3, 'library.opened': 5 },
      pending: null,
    });
    render(<Settings />);
    fireEvent.click(await screen.findByText(en.usageSeeShared));
    expect(screen.getByText(en.usageSharedIntro)).toBeInTheDocument();
    const report = await screen.findByText(/"note\.created\.text": 3/);
    expect(report.textContent).toContain('"version": "2.2.0"');
    expect(report.textContent).toContain('"library.opened": 5');
    expect(report).toHaveAttribute('dir', 'ltr');
    expect(screen.getByRole('link', { name: en.usagePrivacyLink })).toHaveAttribute(
      'href',
      'https://hamesh.fandees.tech/privacy.html',
    );
  });

  it('turns on', async () => {
    render(<Settings />);
    fireEvent.click(await screen.findByRole('switch', { name: en.usageSwitch }));
    await waitFor(() => expect(sharing()).toBe('on'));
    expect(screen.getByRole('switch', { name: en.usageSwitch })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('turned off, deletes the counts kept here and says so', async () => {
    store.set(PREFS, { usage: { sharing: 'on' } });
    store.set(LEDGER, { day: utcDay(Date.now()), counts: { 'open.popup': 2 }, pending: null });
    render(<Settings />);
    const toggle = await screen.findByRole('switch', { name: en.usageSwitch });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    fireEvent.click(toggle);
    expect(await screen.findByRole('status')).toHaveTextContent(en.usageTurnedOff);
    await waitFor(() => expect(store.has(LEDGER)).toBe(false));
    expect(sharing()).toBe('off');
  });

  it('speaks Arabic', async () => {
    render(<Settings lang="ar" />);
    expect(await screen.findByRole('switch', { name: ar.usageSwitch })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: ar.usageTitle })).toBeInTheDocument();
  });

  it('on Firefox, turns on only if Firefox allows it, and gives it back when off', async () => {
    vi.stubEnv('FIREFOX', 'true');
    permissions.request.mockResolvedValueOnce(false);
    render(<Settings />);
    const toggle = await screen.findByRole('switch', { name: en.usageSwitch });
    fireEvent.click(toggle);
    await waitFor(() => expect(permissions.request).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toggle).not.toBeDisabled());
    expect(sharing()).not.toBe('on');
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(toggle);
    await waitFor(() => expect(sharing()).toBe('on'));
    fireEvent.click(toggle);
    await waitFor(() => expect(permissions.remove).toHaveBeenCalledTimes(1));
  });
});

describe('the card that asks', () => {
  it('offers two answers of the same weight, and an example of what goes', async () => {
    render(<Ask where="whats-new" />);
    const card = (await screen.findByRole('heading', { name: en.usageAskTitle })).closest(
      'section',
    )!;
    const yes = within(card).getByRole('button', { name: en.usageAskYes });
    const no = within(card).getByRole('button', { name: en.usageAskNo });
    expect(yes.className).toBe(no.className);
    expect(within(card).queryByText(en.usageOptional)).not.toBeInTheDocument();
    fireEvent.click(within(card).getByText(en.usageAskSee));
    expect(within(card).getByText(/"note\.created\.text": 3/)).toBeInTheDocument();
  });

  it('thanks the reader who agrees, and stays until the page next opens', async () => {
    render(<Ask where="whats-new" />);
    fireEvent.click(await screen.findByRole('button', { name: en.usageAskYes }));
    expect(await screen.findByRole('status')).toHaveTextContent(en.usageThanks);
    expect(sharing()).toBe('on');
    expect(screen.queryByRole('button', { name: en.usageAskYes })).not.toBeInTheDocument();
  });

  it('takes "No thanks" as an answer, and points to Settings', async () => {
    const onOpenSettings = vi.fn();
    render(<Ask where="whats-new" onOpenSettings={onOpenSettings} />);
    fireEvent.click(await screen.findByRole('button', { name: en.usageAskNo }));
    expect(await screen.findByRole('status')).toHaveTextContent(en.usageDeclined);
    await waitFor(() => expect(sharing()).toBe('off'));
    fireEvent.click(screen.getByRole('button', { name: en.usageAfterNo.link }));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('is marked optional in the guide', async () => {
    render(<Ask where="guide" />);
    expect(await screen.findByText(en.usageOptional)).toBeInTheDocument();
  });

  it('never asks a reader who has answered', async () => {
    store.set(PREFS, { usage: { sharing: 'off' } });
    const { container } = render(<Ask where="whats-new" />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });
});
