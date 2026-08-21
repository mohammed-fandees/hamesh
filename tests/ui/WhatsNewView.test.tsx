// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WhatsNewView } from '@/ui/WhatsNewView';
import { RELEASE_NOTES, getLatestReleaseVersion } from '@/domain/release-notes';
import { getStrings } from '@/ui/i18n';

const newest = RELEASE_NOTES[0];
const oldest = RELEASE_NOTES[RELEASE_NOTES.length - 1];

function renderView(
  props: Partial<React.ComponentProps<typeof WhatsNewView>> = {},
): ReturnType<typeof render> {
  return render(
    <WhatsNewView
      strings={getStrings('en')}
      lang="en"
      currentVersion={getLatestReleaseVersion()}
      lastSeenVersion={null}
      {...props}
    />,
  );
}

describe('WhatsNewView', () => {
  beforeEach(() => {
    cleanup();
  });

  it('lists every release, newest first', () => {
    renderView();
    const versions = [...document.querySelectorAll('.hm-whats-new__version')].map(
      (el) => el.textContent,
    );
    expect(versions).toEqual(RELEASE_NOTES.map((r) => r.version));
  });

  it('shows each release’s title and items in English', () => {
    renderView();
    expect(screen.getByText(newest.title.en)).toBeInTheDocument();
    expect(screen.getByText(newest.items[0].en)).toBeInTheDocument();
    expect(screen.getByText(oldest.items[0].en)).toBeInTheDocument();
  });

  it('shows the very same releases in Arabic when the interface is Arabic', () => {
    renderView({ strings: getStrings('ar'), lang: 'ar' });
    expect(screen.getByText(newest.title.ar)).toBeInTheDocument();
    expect(screen.getByText(newest.items[0].ar)).toBeInTheDocument();
    expect(screen.getByText('ما الجديد')).toBeInTheDocument();
    // …and none of the English text leaks through.
    expect(screen.queryByText(newest.items[0].en)).toBeNull();
  });

  it('marks the version actually installed, not simply the newest listed', () => {
    renderView({ currentVersion: oldest.version });
    const badge = document.querySelector('.hm-whats-new__badge--installed');
    expect(badge).not.toBeNull();
    const release = badge!.closest('.hm-whats-new__release')!;
    expect(release.querySelector('.hm-whats-new__version')?.textContent).toBe(oldest.version);
  });

  it('marks everything newer than the last one read as new', () => {
    renderView({ currentVersion: newest.version, lastSeenVersion: '1.1.0' });
    const newBadges = [...document.querySelectorAll('.hm-whats-new__badge')].filter(
      (el) => !el.classList.contains('hm-whats-new__badge--installed'),
    );
    // Everything released after 1.1.0 except the newest, which carries the
    // "Installed" badge instead of doubling up. Derived rather than
    // hard-coded so a release doesn't have to come back and edit a count.
    const expected = RELEASE_NOTES.filter(
      (r) => r.version !== newest.version && r.version > '1.1.0',
    ).length;
    expect(newBadges.map((el) => el.textContent)).toEqual(Array(expected).fill('New'));
  });

  it('marks nothing new once the newest release has been read', () => {
    renderView({ currentVersion: newest.version, lastSeenVersion: newest.version });
    const newBadges = [...document.querySelectorAll('.hm-whats-new__badge')].filter(
      (el) => !el.classList.contains('hm-whats-new__badge--installed'),
    );
    expect(newBadges).toHaveLength(0);
  });

  it('renders each release date as a machine-readable time element', () => {
    renderView();
    const time = document.querySelector('time');
    expect(time).toHaveAttribute('datetime', newest.date);
  });
});
