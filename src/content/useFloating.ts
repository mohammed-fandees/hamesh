import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export interface AnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Size {
  width: number;
  height: number;
}

const MARGIN = 12; // keep this far from the viewport edge
const GAP = 10; // between a card and what it is attached to

const HIDDEN_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: -9999,
  left: -9999,
  visibility: 'hidden',
};

const clamp = (value: number, max: number) => Math.max(MARGIN, Math.min(value, max - MARGIN));

/**
 * Below the anchor's top-start corner — the composer and the viewer, beside the
 * element or text they belong to. Hugs a short anchor (at most 24px down), and
 * flips above when it would run off the bottom.
 */
export function placeBelow(anchor: AnchorRect, card: Size, viewport: Size) {
  let top = anchor.top + Math.min(anchor.height, 24) + GAP;
  if (top + card.height + MARGIN > viewport.height && anchor.top - card.height - GAP > MARGIN) {
    top = anchor.top - card.height - GAP;
  }
  return {
    top: clamp(top, viewport.height - card.height),
    left: clamp(anchor.left, viewport.width - card.width),
  };
}

/**
 * Above the anchor — for a video, which a card must never cover. With no room
 * above (the video starts near the top), just inside its top edge rather than
 * off-screen.
 */
export function placeAbove(anchor: AnchorRect, card: Size, viewport: Size) {
  let top = anchor.top - card.height - GAP;
  if (top < MARGIN) top = anchor.top + GAP;
  return {
    top: clamp(top, viewport.height - card.height),
    left: clamp(anchor.left, viewport.width - card.width),
  };
}

export interface UseFloatingOptions {
  /** Where the card goes relative to its anchor. */
  placement?: 'below' | 'above';
  /** Focus the card's first focusable descendant once it's actually visible
   *  (see below). Off by default — cards with no input, or that open
   *  already-visible, don't need this. */
  autoFocus?: boolean;
}

/**
 * Positions a floating card over a web page — composer, viewer, quick note,
 * cluster list, text popup — against an anchor, in fixed coordinates, clamped
 * into the viewport, and placed again on every scroll (in any container:
 * capture) and resize so it follows its anchor.
 *
 * The card mounts hidden so its real size can be measured before it is placed.
 * That is also why a plain `autoFocus` inside one silently does nothing — React
 * fires it once, on that first, still hidden commit — so `autoFocus` here
 * focuses on the visibility transition instead, once.
 */
export function useFloating(getAnchorRect: () => AnchorRect | null, options?: UseFloatingOptions) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>(HIDDEN_STYLE);
  const above = options?.placement === 'above';

  const reposition = useCallback(() => {
    const card = cardRef.current;
    const anchor = getAnchorRect();
    if (!card || !anchor) return;
    const size = {
      width: card.offsetWidth || (above ? 260 : 300),
      height: card.offsetHeight || (above ? 100 : 160),
    };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const { top, left } = (above ? placeAbove : placeBelow)(anchor, size, viewport);
    setStyle({ position: 'fixed', top, left, visibility: 'visible' });
  }, [getAnchorRect, above]);

  useLayoutEffect(() => {
    reposition();
    window.addEventListener('scroll', reposition, { passive: true, capture: true });
    window.addEventListener('resize', reposition, { passive: true });
    return () => {
      window.removeEventListener('scroll', reposition, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', reposition);
    };
  }, [reposition]);

  const visible = style.visibility === 'visible';
  const focusedRef = useRef(false);
  useLayoutEffect(() => {
    if (!options?.autoFocus || !visible || focusedRef.current) return;
    focusedRef.current = true;
    cardRef.current?.querySelector<HTMLElement>('textarea, input, [tabindex]')?.focus();
  }, [visible, options?.autoFocus]);

  return { cardRef, style, reposition };
}
