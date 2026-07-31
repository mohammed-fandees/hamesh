import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export interface AnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MARGIN = 12; // keep this far from the viewport edge

const HIDDEN_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: -9999,
  left: -9999,
  visibility: 'hidden',
};

/** Shared scroll/resize re-measure wiring for both placement strategies
 *  below — the only thing that differs between them is the `reposition`
 *  math itself. */
function useRepositionOnScroll(reposition: () => void): void {
  useLayoutEffect(() => {
    reposition();
    window.addEventListener('scroll', reposition, { passive: true, capture: true });
    window.addEventListener('resize', reposition, { passive: true });
    return () => {
      window.removeEventListener('scroll', reposition, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', reposition);
    };
  }, [reposition]);
}

/**
 * Positions a floating card (composer / viewer) next to an anchor using fixed
 * coordinates. Prefers below-start of the anchor, flips above when it would
 * overflow the bottom, and clamps into the viewport. Re-measures on scroll and
 * resize so the card tracks its anchor.
 */
export function useFloating(getAnchorRect: () => AnchorRect | null) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>(HIDDEN_STYLE);

  const reposition = useCallback(() => {
    const card = cardRef.current;
    const anchor = getAnchorRect();
    if (!card || !anchor) return;

    const cw = card.offsetWidth || 300;
    const ch = card.offsetHeight || 160;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Preferred: just below the anchor's top-start corner.
    let top = anchor.top + Math.min(anchor.height, 24) + 10;
    let left = anchor.left;

    // Flip above if it would overflow the bottom edge.
    if (top + ch + MARGIN > vh && anchor.top - ch - 10 > MARGIN) {
      top = anchor.top - ch - 10;
    }

    left = Math.max(MARGIN, Math.min(left, vw - cw - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - ch - MARGIN));

    setStyle({ position: 'fixed', top, left, visibility: 'visible' });
  }, [getAnchorRect]);

  useRepositionOnScroll(reposition);

  return { cardRef, style, reposition };
}

/**
 * Positions a floating card *above* an anchor — used for the video quick-note
 * popup, which must never cover the video it's attached to. Prefers just
 * above the anchor's top edge; when there's no room above (the anchor
 * starts near the top of the viewport), falls back to just inside the
 * anchor's top edge rather than clipping off-screen. Same scroll/resize
 * tracking and viewport clamping as `useFloating`.
 */
export function useFloatingAbove(getAnchorRect: () => AnchorRect | null) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>(HIDDEN_STYLE);

  const reposition = useCallback(() => {
    const card = cardRef.current;
    const anchor = getAnchorRect();
    if (!card || !anchor) return;

    const cw = card.offsetWidth || 260;
    const ch = card.offsetHeight || 100;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = anchor.top - ch - 10;
    if (top < MARGIN) top = anchor.top + 10;

    let left = anchor.left;
    left = Math.max(MARGIN, Math.min(left, vw - cw - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - ch - MARGIN));

    setStyle({ position: 'fixed', top, left, visibility: 'visible' });
  }, [getAnchorRect]);

  useRepositionOnScroll(reposition);

  return { cardRef, style, reposition };
}
