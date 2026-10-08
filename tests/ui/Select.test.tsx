// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Select, type SelectOption } from '@/ui/kit/Select';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const OPTIONS: SelectOption[] = [
  { value: '', label: 'No folder' },
  { value: 'work', label: 'Work' },
  { value: 'clients', label: 'Clients', depth: 1 },
  { value: 'old', label: 'Archive', disabled: true },
  { value: 'new', label: 'New folder…', separated: true, tone: 'accent' },
];

function Harness({
  onChange = () => {},
  disabled = false,
}: {
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  return (
    <>
      <button type="button">before</button>
      <Select
        label="Folder"
        options={OPTIONS}
        value={value}
        disabled={disabled}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    </>
  );
}

const combo = () => screen.getByRole('combobox', { name: 'Folder' });
const list = () => screen.queryByRole('listbox', { name: 'Folder' });
const press = (key: string) => fireEvent.keyDown(combo(), { key });

describe('Select — what a person sees and does', () => {
  it('shows the chosen option, and an open list that marks it', () => {
    render(<Harness />);
    expect(combo()).toHaveTextContent('No folder');
    expect(combo()).toHaveAttribute('aria-expanded', 'false');
    expect(list()).toBeNull();

    fireEvent.click(combo());
    expect(combo()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('option', { name: 'No folder' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('option', { name: 'Work' })).toHaveAttribute('aria-selected', 'false');
  });

  it('chooses with a press, closes, and puts focus back on the button', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(combo());
    fireEvent.click(screen.getByRole('option', { name: 'Work' }));
    expect(onChange).toHaveBeenCalledWith('work');
    expect(list()).toBeNull();
    expect(combo()).toHaveTextContent('Work');
    expect(combo()).toHaveFocus();
  });

  it('says nothing when the same option is chosen again', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(combo());
    fireEvent.click(screen.getByRole('option', { name: 'No folder' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sets a nested option one step in, and never lets a disabled one be chosen', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(combo());
    expect(
      screen.getByRole('option', { name: 'Clients' }).style.getPropertyValue('--hm-depth'),
    ).toBe('1');
    const archive = screen.getByRole('option', { name: 'Archive' });
    expect(archive).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(archive);
    expect(onChange).not.toHaveBeenCalled();
    expect(list()).not.toBeNull();
  });
});

describe('Select — by keyboard', () => {
  it('opens on the arrows, moves through the list skipping what is disabled, and chooses on Enter', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    combo().focus();
    press('ArrowDown');
    expect(list()).not.toBeNull();
    // The one being pointed at is named by the button; focus never leaves it.
    expect(combo()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'No folder' }).id,
    );
    press('ArrowDown');
    press('ArrowDown');
    expect(combo()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Clients' }).id,
    );
    press('ArrowDown'); // Archive is disabled
    expect(combo()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'New folder…' }).id,
    );
    press('Enter');
    expect(onChange).toHaveBeenCalledWith('new');
    expect(combo()).toHaveFocus();
  });

  it('goes to either end with Home and End, and jumps to a match by typing', () => {
    render(<Harness />);
    combo().focus();
    press('Enter');
    press('End');
    expect(combo()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'New folder…' }).id,
    );
    press('Home');
    expect(combo()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'No folder' }).id,
    );
    press('c');
    expect(combo()).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: 'Clients' }).id,
    );
  });

  it('closes on Escape without letting it reach whatever the control sits in', () => {
    const outer = vi.fn();
    render(
      <div onKeyDown={outer}>
        <Harness />
      </div>,
    );
    combo().focus();
    press('Enter');
    outer.mockClear();
    press('Escape');
    expect(list()).toBeNull();
    expect(combo()).toHaveFocus();
    expect(outer).not.toHaveBeenCalled();

    // Closed, Escape is not the select's to take.
    press('Escape');
    expect(outer).toHaveBeenCalled();
  });
});

describe('Select — closing', () => {
  it('closes on a press anywhere else, and not on a press inside its own list', () => {
    render(<Harness />);
    fireEvent.click(combo());
    fireEvent.pointerDown(screen.getByRole('option', { name: 'Work' }));
    expect(list()).not.toBeNull();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'before' }));
    expect(list()).toBeNull();
  });

  it('cannot be opened while disabled, and closes if it is disabled while open', () => {
    const { rerender } = render(<Harness />);
    fireEvent.click(combo());
    expect(list()).not.toBeNull();
    rerender(<Harness disabled />);
    expect(list()).toBeNull();
    fireEvent.click(combo());
    expect(list()).toBeNull();
  });
});

describe('Select — drawn inside a shadow root, as on a web page', () => {
  function mount() {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const scope = document.createElement('div');
    scope.className = 'hm-scope';
    shadow.append(scope);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />, { container: scope });
    return { scope: within(scope as unknown as HTMLElement), shadow, onChange };
  }

  it('lets its option take the click, instead of closing on the press that came first', () => {
    const { scope, onChange } = mount();
    fireEvent.click(scope.getByRole('combobox', { name: 'Folder' }));
    const option = scope.getByRole('option', { name: 'Work' });
    // A document listener sees this press as one on the shadow's host.
    fireEvent.pointerDown(option, { bubbles: true, composed: true });
    fireEvent.click(scope.getByRole('option', { name: 'Work' }));
    expect(onChange).toHaveBeenCalledWith('work');
  });

  it('draws its list in the page scope, where the card around it cannot clip it', () => {
    const { scope, shadow } = mount();
    fireEvent.click(scope.getByRole('combobox', { name: 'Folder' }));
    const panel = scope.getByRole('listbox', { name: 'Folder' });
    expect(panel.parentElement).toBe(shadow.querySelector('.hm-scope'));
    expect(panel).toHaveClass('hm-select__panel');
  });
});
