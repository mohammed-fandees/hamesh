import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export interface AnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MARGIN = 12; // keep this far from the viewport edge

/**
 * Positions a floating card (composer / viewer) next to an anchor using fixed
 * coordinates. Prefers below-start of the anchor, flips above when it would
 * overflow the bottom, and clamps into the viewport. Re-measures on scroll and
 * resize so the card tracks its anchor.
 */
export function useFloating(getAnchorRect: () => AnchorRect | null) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: -9999,
    left: -9999,
    visibility: 'hidden',
  });

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

  useLayoutEffect(() => {
    reposition();
    window.addEventListener('scroll', reposition, { passive: true, capture: true });
    window.addEventListener('resize', reposition, { passive: true });
    return () => {
      window.removeEventListener('scroll', reposition, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', reposition);
    };
  }, [reposition]);

  return { cardRef, style, reposition };
}
