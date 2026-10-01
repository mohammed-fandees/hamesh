// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ShareConsent } from '@/ui/teams/ShareConsent';
import { getTeamsStrings } from '@/ui/teams/strings';

const strings = getTeamsStrings('en');

beforeAll(() => {
  // jsdom has <dialog> but not its modal behaviour; opening is all these need.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
});
afterEach(cleanup);

describe('consent before a note leaves this device for a team', () => {
  it('says what goes up, who sees it, where it is kept and how to take it back', () => {
    render(<ShareConsent lang="en" teamName="Alpha" onAnswer={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: strings.consentTitle('Alpha') })).toBeInTheDocument();
    for (const fact of [
      strings.consentWhat,
      strings.consentWho('Alpha'),
      strings.consentWhere,
      strings.consentUndo,
    ]) {
      expect(screen.getByText(fact)).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: strings.consentPrivacy })).toHaveAttribute(
      'href',
      'https://hamesh.fandees.tech/privacy.html',
    );
  });

  it('gives focus to the cautious answer', () => {
    render(<ShareConsent lang="en" teamName="Alpha" onAnswer={vi.fn()} />);
    expect(screen.getByRole('button', { name: strings.cancel })).toHaveFocus();
  });

  it('answers yes, and whether to stop asking', () => {
    const onAnswer = vi.fn();
    render(<ShareConsent lang="en" teamName="Alpha" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('checkbox', { name: strings.consentDontAsk }));
    fireEvent.click(screen.getByRole('button', { name: strings.consentShare }));
    expect(onAnswer).toHaveBeenCalledWith(true, true);
  });

  it('answers no on Cancel, and on Escape', () => {
    const onAnswer = vi.fn();
    render(<ShareConsent lang="en" teamName="Alpha" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: strings.cancel }));
    expect(onAnswer).toHaveBeenLastCalledWith(false, false);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onAnswer).toHaveBeenCalledTimes(2);
  });
});
