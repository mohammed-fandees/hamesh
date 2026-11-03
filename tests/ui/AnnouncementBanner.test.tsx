// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Announcement } from '@/domain/announcements';
import { AnnouncementBanner } from '@/ui/teams/AnnouncementBanner';
import { getTeamsStrings } from '@/ui/teams/strings';

const strings = getTeamsStrings('en');
const item = (id: string, over: Partial<Announcement> = {}): Announcement => ({
  id,
  title: { en: `${id} in English`, ar: `${id} بالعربية` },
  body: null,
  action: null,
  audience: 'everyone',
  ...over,
});

afterEach(cleanup);

/** The page above removes what was closed, as the real one does through prefs. */
function Harness({ initial }: { initial: Announcement[] }) {
  const [items, setItems] = useState(initial);
  const drop = (id: string) => setItems((all) => all.filter((a) => a.id !== id));
  return (
    <AnnouncementBanner lang="en" items={items} onOpen={vi.fn()} onClose={drop} onDismiss={drop} />
  );
}

describe('an announcement', () => {
  it('says nothing at all when there is nothing to say', () => {
    const { container } = render(<Harness initial={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('speaks the reader’s language', () => {
    render(
      <AnnouncementBanner
        lang="ar"
        items={[item('a')]}
        onOpen={vi.fn()}
        onClose={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('a بالعربية')).toBeInTheDocument();
  });

  it('shows one at a time, with no pager for a single one', () => {
    render(<Harness initial={[item('a')]} />);
    expect(
      screen.queryByRole('button', { name: strings.announcementNext }),
    ).not.toBeInTheDocument();
  });

  it('walks several in one slot', () => {
    render(<Harness initial={[item('a'), item('b')]} />);
    expect(screen.getByText('a in English')).toBeInTheDocument();
    expect(screen.queryByText('b in English')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: strings.announcementNext }));
    expect(screen.getByText('b in English')).toBeInTheDocument();
    expect(screen.getByText(strings.announcementPosition(2, 2))).toBeInTheDocument();
  });

  it('brings up the next when one is closed, even the last in the list', () => {
    render(<Harness initial={[item('a'), item('b')]} />);
    fireEvent.click(screen.getByRole('button', { name: strings.announcementNext }));
    fireEvent.click(screen.getByRole('button', { name: strings.announcementClose }));
    expect(screen.getByText('a in English')).toBeInTheDocument();
  });

  it('tells closing for now apart from never again', () => {
    const onClose = vi.fn();
    const onDismiss = vi.fn();
    render(
      <AnnouncementBanner
        lang="en"
        items={[item('a')]}
        onOpen={vi.fn()}
        onClose={onClose}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: strings.announcementClose }));
    expect(onClose).toHaveBeenCalledWith('a');
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: strings.announcementDismiss }));
    expect(onDismiss).toHaveBeenCalledWith('a');
  });

  it('opens a place in Hamesh, or a link in a tab that can’t reach back', () => {
    const onOpen = vi.fn();
    render(
      <AnnouncementBanner
        lang="en"
        items={[
          item('a', {
            action: { label: { en: 'See Teams', ar: 'الفرق' }, to: { open: 'teams' } },
          }),
        ]}
        onOpen={onOpen}
        onClose={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'See Teams' }));
    expect(onOpen).toHaveBeenCalledWith('teams');
    cleanup();

    render(
      <AnnouncementBanner
        lang="en"
        items={[
          item('b', {
            action: {
              label: { en: 'Read more', ar: 'المزيد' },
              to: { url: 'https://hamesh.example/new' },
            },
          }),
        ]}
        onOpen={onOpen}
        onClose={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const link = screen.getByRole('link', { name: 'Read more' });
    expect(link).toHaveAttribute('href', 'https://hamesh.example/new');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders what it is given as text, never as markup', () => {
    const { container } = render(
      <Harness initial={[item('a', { title: { en: '<img src=x onerror=alert(1)>', ar: 'x' } })]} />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
  });
});
