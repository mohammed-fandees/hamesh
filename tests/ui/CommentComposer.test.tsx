// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CommentComposer } from '@/ui/teams/CommentComposer';
import { getTeamsStrings } from '@/ui/teams/strings';

const strings = getTeamsStrings('en');
const ME = '01J0000000000000000000000Z';
const SARA = '01J0000000000000000000000S';

const members = [
  { userId: ME, displayName: 'Me', role: 'owner' as const, joinedAt: 1 },
  { userId: SARA, displayName: 'Sara', role: 'member' as const, joinedAt: 2 },
];

function view(onSubmit = vi.fn()) {
  render(
    <CommentComposer
      strings={strings}
      members={members}
      placeholder={strings.commentPlaceholder}
      submitLabel={strings.postComment}
      onSubmit={onSubmit}
    />,
  );
  return {
    onSubmit,
    textarea: screen.getByLabelText(strings.commentPlaceholder) as HTMLTextAreaElement,
  };
}

/** Types into the textarea and puts the caret at the end, as a person would. */
function type(textarea: HTMLTextAreaElement, text: string) {
  fireEvent.change(textarea, { target: { value: text, selectionStart: text.length } });
}

afterEach(cleanup);

describe('writing a comment', () => {
  it('offers this team’s members, and nobody else, once an @ is typed', () => {
    const { textarea } = view();
    type(textarea, 'thanks @sa');

    const picker = screen.getByRole('listbox');
    expect(picker).toHaveTextContent('Sara');
    expect(picker).not.toHaveTextContent('Me');
  });

  it('puts the person’s id in the body, never their name', () => {
    const { textarea, onSubmit } = view();
    type(textarea, 'thanks @sa');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'Sara' }));

    expect(textarea).toHaveValue(`thanks <@${SARA}> `);
    fireEvent.click(screen.getByRole('button', { name: strings.postComment }));
    expect(onSubmit).toHaveBeenCalledWith(`thanks <@${SARA}>`, [SARA]);
  });

  it('derives what it declares from what it says, so the two cannot disagree', () => {
    const { textarea, onSubmit } = view();
    type(textarea, `hi <@${SARA}> and <@${SARA}> again`);
    fireEvent.click(screen.getByRole('button', { name: strings.postComment }));

    expect(onSubmit).toHaveBeenCalledWith(`hi <@${SARA}> and <@${SARA}> again`, [SARA]);
  });

  it('says so when nobody in the team matches', () => {
    const { textarea } = view();
    type(textarea, '@zzz');
    expect(screen.getByRole('listbox')).toHaveTextContent(strings.mentionNobody);
  });

  it('does not open for an @ inside a word, such as an email address', () => {
    const { textarea } = view();
    type(textarea, 'write to sara@example');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('picks with the keyboard, and closes on Escape without sending', () => {
    const { textarea, onSubmit } = view();
    type(textarea, '@');
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(textarea.value).toContain('<@');

    type(textarea, '@s');
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends on Enter, and takes a newline on Shift+Enter', () => {
    const { textarea, onSubmit } = view();
    type(textarea, 'short and done');
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledWith('short and done', []);
  });

  it('sends nothing for an empty comment', () => {
    const { textarea, onSubmit } = view();
    type(textarea, '   ');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: strings.postComment })).toBeDisabled();
  });

  it('starts from an existing comment when one is being edited', () => {
    const onSubmit = vi.fn();
    render(
      <CommentComposer
        strings={strings}
        members={members}
        placeholder={strings.commentPlaceholder}
        submitLabel={strings.save}
        initialBody="as first written"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(strings.commentPlaceholder)).toHaveValue('as first written');
    expect(screen.getByRole('button', { name: strings.cancel })).toBeInTheDocument();
  });
});
