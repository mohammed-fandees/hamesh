import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

/** The commands Hamesh declares, by what they do. */
export const COMMANDS = {
  addNote: 'activate-hamesh',
  addVideoNote: 'activate-hamesh-video',
  addTextNote: 'activate-hamesh-text',
} as const;

export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS];

/**
 * Each command's current key binding, or `null` when the reader has none.
 *
 * Read live, never written down: the reader can rebind them in Chrome's own
 * shortcuts page at any time, and that page is the only place they can be
 * changed — Chrome gives an extension `getAll` and nothing to set them with.
 */
export function useShortcuts(): Partial<Record<CommandName, string | null>> {
  const [bindings, setBindings] = useState<Partial<Record<CommandName, string | null>>>({});
  useEffect(() => {
    let cancelled = false;
    browser.commands
      ?.getAll()
      .then((list) => {
        if (cancelled) return;
        const next: Partial<Record<CommandName, string | null>> = {};
        for (const command of list) {
          if (command.name) next[command.name as CommandName] = command.shortcut || null;
        }
        setBindings(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return bindings;
}
