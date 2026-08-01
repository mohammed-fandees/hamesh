/** The subset of `KeyboardEvent` this needs — kept narrow (rather than the
 *  full DOM type) so this stays a plain, dependency-free domain function. Any
 *  real `KeyboardEvent` satisfies this structurally. */
export interface ShortcutKeyEvent {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

/**
 * Checks whether a keyboard event matches a Chrome `commands` shortcut string
 * (e.g. "Alt+H", "Ctrl+Shift+K", as returned by `chrome.commands.getAll()`).
 * Matches on `event.code` (physical key position) rather than `event.key`,
 * same as Chrome's own accelerator matching — this stays correct regardless
 * of the active keyboard layout.
 */
export function matchesShortcut(event: ShortcutKeyEvent, shortcut: string): boolean {
  if (!shortcut) return false;
  const parts = shortcut.split('+').map((part) => part.trim());
  const key = parts[parts.length - 1];
  if (!key) return false;
  const modifiers = new Set(parts.slice(0, -1).map((part) => part.toLowerCase()));

  const needsCtrl = modifiers.has('ctrl') || modifiers.has('macctrl');
  const needsAlt = modifiers.has('alt');
  const needsShift = modifiers.has('shift');
  const needsMeta = modifiers.has('command') || modifiers.has('cmd');

  const code = /^[A-Za-z]$/.test(key)
    ? `Key${key.toUpperCase()}`
    : /^[0-9]$/.test(key)
      ? `Digit${key}`
      : key;

  return (
    event.code === code &&
    event.ctrlKey === needsCtrl &&
    event.altKey === needsAlt &&
    event.shiftKey === needsShift &&
    event.metaKey === needsMeta
  );
}
