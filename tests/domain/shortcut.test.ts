import { describe, it, expect } from 'vitest';
import { matchesShortcut, type ShortcutKeyEvent } from '@/domain/shortcut';

function keyEvent(overrides: Partial<ShortcutKeyEvent> & { code: string }): ShortcutKeyEvent {
  return { ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...overrides };
}

describe('matchesShortcut', () => {
  it('matches a simple Alt+letter combo by physical key code', () => {
    const event = keyEvent({ code: 'KeyH', altKey: true });
    expect(matchesShortcut(event, 'Alt+H')).toBe(true);
  });

  it('does not match when the required modifier is missing', () => {
    const event = keyEvent({ code: 'KeyH', altKey: false });
    expect(matchesShortcut(event, 'Alt+H')).toBe(false);
  });

  it('does not match when an extra modifier is held (e.g. AltGr synthesizing Ctrl+Alt)', () => {
    const event = keyEvent({ code: 'KeyH', altKey: true, ctrlKey: true });
    expect(matchesShortcut(event, 'Alt+H')).toBe(false);
  });

  it('does not match a different physical key', () => {
    const event = keyEvent({ code: 'KeyV', altKey: true });
    expect(matchesShortcut(event, 'Alt+H')).toBe(false);
  });

  it('supports multi-modifier combos', () => {
    const event = keyEvent({ code: 'KeyK', ctrlKey: true, shiftKey: true });
    expect(matchesShortcut(event, 'Ctrl+Shift+K')).toBe(true);
  });

  it('maps digit keys to their Digit code', () => {
    const event = keyEvent({ code: 'Digit1', altKey: true });
    expect(matchesShortcut(event, 'Alt+1')).toBe(true);
  });

  it('returns false for an empty shortcut', () => {
    const event = keyEvent({ code: 'KeyH', altKey: true });
    expect(matchesShortcut(event, '')).toBe(false);
  });
});
