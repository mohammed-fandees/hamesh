// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Announcement } from '@/domain/announcements';
import { countUse } from '@/usage/count';
import { AnnouncementBanner } from '@/ui/teams/AnnouncementBanner';
import { getTeamsStrings } from '@/ui/teams/strings';

const sendMessage = vi.fn(async (_message: unknown) => undefined);
vi.mock('wxt/browser', () => ({
  browser: { runtime: { sendMessage: (m: unknown) => sendMessage(m) } },
}));

const ID = '01K9ZZ0000000000000000TEAM';
const item: Announcement = {
  id: ID,
  title: { en: 'Teams', ar: 'الفرق' },
  body: null,
  action: { label: { en: 'See', ar: 'شاهد' }, to: { open: 'teams' } },
  audience: 'everyone',
};
const events = () => sendMessage.mock.calls.map(([m]) => (m as { event: string }).event);

beforeEach(() => {
  sendMessage.mockClear();
  vi.stubEnv('WXT_TEAMS_API_ORIGIN', 'https://api.example.test');
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('countUse', () => {
  it('tells the background what happened, and nothing else', () => {
    countUse('library.opened');
    expect(sendMessage).toHaveBeenCalledWith({ type: 'USAGE_COUNT', event: 'library.opened' });
  });

  it('does nothing in a build with no server to send to', () => {
    vi.stubEnv('WXT_TEAMS_API_ORIGIN', '');
    countUse('library.opened');
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('never throws when the background cannot be reached', () => {
    sendMessage.mockRejectedValueOnce(new Error('Receiving end does not exist'));
    expect(() => countUse('open.popup')).not.toThrow();
  });
});

describe('an announcement, counted', () => {
  const strings = getTeamsStrings('en');

  it('counts being shown, opened and closed, by its id', () => {
    render(
      <AnnouncementBanner
        lang="en"
        items={[item]}
        onOpen={vi.fn()}
        onClose={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(events()).toEqual([`announcement.shown.${ID}`]);
    fireEvent.click(screen.getByRole('button', { name: 'See' }));
    fireEvent.click(screen.getByRole('button', { name: strings.announcementClose }));
    fireEvent.click(screen.getByRole('button', { name: strings.announcementDismiss }));
    expect(events()).toEqual([
      `announcement.shown.${ID}`,
      `announcement.opened.${ID}`,
      `announcement.closed.${ID}`,
      `announcement.closed.${ID}`,
    ]);
  });
});
