// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { GettingStartedStep } from '@/domain/getting-started';
import { GettingStartedView, GuideCard } from '@/ui/GettingStartedView';
import { getStrings } from '@/ui/i18n';

vi.mock('@/ui/hooks/useShortcuts', () => ({
  COMMANDS: { addNote: 'add', addVideoNote: 'video', addTextNote: 'text' },
  useShortcuts: () => ({ add: 'Alt+H', video: 'Alt+V', text: null }),
}));

const strings = getStrings('en');
afterEach(cleanup);

const view = (done: GettingStartedStep[] = [], showTeamStep = true) =>
  render(
    <GettingStartedView
      strings={strings}
      done={new Set(done)}
      showTeamStep={showTeamStep}
      onOpenTeams={vi.fn()}
      onOpenLibrary={vi.fn()}
    />,
  );

describe('the guide', () => {
  it('counts only the basics', () => {
    view(['pin', 'video', 'folder']);
    expect(screen.getByText(strings.guideProgress(1, 3))).toBeInTheDocument();
  });

  it('shows the reader’s own shortcuts, and says when one is not set', () => {
    view();
    expect(screen.getByText('Alt+H')).toBeInTheDocument();
    expect(screen.getByText(strings.shortcutNotSet)).toBeInTheDocument();
  });

  it('stops offering what has been done', () => {
    view(['note']);
    expect(screen.queryByRole('link', { name: strings.guideTry })).not.toBeInTheDocument();
  });

  it('offers a real page to try it on, in a tab that can’t reach back', () => {
    view();
    const link = screen.getByRole('link', { name: strings.guideTry });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('leaves Teams out of a build without it', () => {
    view([], false);
    expect(screen.queryByText(strings.guideTeamTitle)).not.toBeInTheDocument();
  });
});

describe('its card in the Library', () => {
  it('goes to the guide, and can be put away', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    render(<GuideCard strings={strings} done={1} onOpen={onOpen} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: strings.guideContinue }));
    expect(onOpen).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: strings.guideClose }));
    expect(onClose).toHaveBeenCalled();
  });
});
