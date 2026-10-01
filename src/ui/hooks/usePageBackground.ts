import { useLayoutEffect, type RefObject } from 'react';
import type { Theme } from '@/domain/preferences';

/**
 * Paints the document behind one of Hamesh's own pages in the page's own ground.
 *
 * The tokens live on the page's `.hm-scope` wrapper, never on `<html>` or
 * `<body>`, which are its ancestors and so never see them — a `var(--hm-paper)`
 * there always fell back to the light value, and a dark page sat on a white
 * document wherever the wrapper did not reach (overscroll, a slide's first
 * paint). This reads the token off the wrapper, once per theme, and hands it
 * to the document — no colour is written twice.
 */
export function usePageBackground(
  scope: RefObject<HTMLElement | null>,
  token: '--hm-paper' | '--hm-surface',
  theme: Theme,
): void {
  useLayoutEffect(() => {
    const element = scope.current;
    if (!element) return;
    const ground = getComputedStyle(element).getPropertyValue(token).trim();
    if (!ground) return;
    document.documentElement.style.background = ground;
    document.documentElement.style.colorScheme = theme;
  }, [scope, token, theme]);
}
