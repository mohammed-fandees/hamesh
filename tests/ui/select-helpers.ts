import { fireEvent, screen, within } from '@testing-library/react';

/**
 * Working a `Select` the way a person does: open the list, press an option.
 * The list is portaled out of the control, so it is found by its own role.
 */
export function chooseOption(combobox: HTMLElement, name: string | RegExp) {
  if (combobox.getAttribute('aria-expanded') !== 'true') fireEvent.click(combobox);
  const list = screen.getByRole('listbox', { name: combobox.getAttribute('aria-label') ?? '' });
  fireEvent.click(within(list).getByRole('option', { name }));
}

/** What a `Select` currently shows as chosen. */
export const shown = (combobox: HTMLElement) => combobox.textContent;

/** The names of every option, in order, once the list is open. */
export function optionNames(combobox: HTMLElement): string[] {
  if (combobox.getAttribute('aria-expanded') !== 'true') fireEvent.click(combobox);
  const list = screen.getByRole('listbox', { name: combobox.getAttribute('aria-label') ?? '' });
  return within(list)
    .getAllByRole('option')
    .map((o) => o.textContent ?? '');
}
