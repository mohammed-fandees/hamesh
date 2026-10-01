// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { InlineConfirm } from '@/ui/kit/InlineConfirm';
import { getStrings } from '@/ui/i18n';

const strings = getStrings('en');

function view(overrides: { working?: boolean } = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <InlineConfirm
      cancelLabel={strings.keepIt}
      question="Delete this for everyone in Alpha?"
      confirmLabel="Delete"
      working={overrides.working}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

afterEach(cleanup);

describe('asking before something irreversible', () => {
  it('asks in the page, and does nothing until it is answered', () => {
    const { onConfirm, onCancel } = view();
    expect(screen.getByText('Delete this for everyone in Alpha?')).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('puts the focus on the cautious answer, so a stray Enter keeps things', () => {
    view();
    expect(screen.getByRole('button', { name: strings.keepIt })).toHaveFocus();
  });

  it('backs out on Escape', () => {
    const { onCancel, onConfirm } = view();
    fireEvent.keyDown(screen.getByRole('group'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('goes through with it only when the destructive answer is pressed', () => {
    const { onConfirm } = view();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('keeps its own label while it is working, says so, and takes no second answer', () => {
    const { onConfirm, onCancel } = view({ working: true });
    // Not swapped for a generic "Working…": the button is still what it was.
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm).toHaveAttribute('aria-busy', 'true');
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    fireEvent.click(screen.getByRole('button', { name: strings.keepIt }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('names the whole question for anyone who cannot see the row it is on', () => {
    view();
    expect(screen.getByRole('group')).toHaveAccessibleName('Delete this for everyone in Alpha?');
  });
});
