import { getActiveAdapterMatch, type AdapterVideoMatch } from './video-adapters/registry';

export interface PointerPosition {
  x: number;
  y: number;
}

let lastPointerPos: PointerPosition | null = null;

function onPointerMove(e: PointerEvent): void {
  lastPointerPos = { x: e.clientX, y: e.clientY };
}

/**
 * Starts tracking pointer position for `getActiveVideoUnderInteraction`.
 * Call once per content-script mount; returns an unsubscribe. Capture-phase
 * and passive, matching the selection-mode hover tracking already used
 * elsewhere in this content script.
 */
export function trackVideoContext(): () => void {
  window.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
  return () => {
    window.removeEventListener('pointermove', onPointerMove, {
      capture: true,
    } as EventListenerOptions);
    lastPointerPos = null;
  };
}

function isPointInRect(pos: PointerPosition, rect: DOMRect): boolean {
  return pos.x >= rect.left && pos.x <= rect.right && pos.y >= rect.top && pos.y <= rect.bottom;
}

/** Pure decision, separated from the live pointer-tracking state above so
 *  it's testable with plain fixture rects — no event wiring required.
 *
 *  "Interacting with" means: the pointer's last known position falls
 *  within the matched adapter's player region's *bounding box*
 *  (coordinate-based), or the focused element is a descendant of that
 *  region (DOM containment — focus is inherently element-based, not a
 *  screen coordinate, so this half stays a `.contains()` check).
 *
 *  Deliberately not a `.contains(hoveredElement)` check for hover, unlike
 *  an earlier version of this function: almost every real video player —
 *  custom or a plain `<video>` — layers a play-button overlay, ad chrome,
 *  or its own controls bar *on top of* the player container as CSS-
 *  positioned siblings, not DOM descendants, of whatever element an
 *  adapter identifies as "the player." Hit-testing at the pointer's
 *  position nearly always resolves to one of those overlay elements, not
 *  a descendant of the container — so a strict ancestry check made this
 *  detector fail to recognize "hovering the video" on real sites, working
 *  correctly only for a bare, chrome-less `<video>` with nothing drawn
 *  over it (exactly the gap between this project's simplified e2e fixture
 *  and a real page). A bounding-box check doesn't care about DOM
 *  structure or stacking order — only "is the pointer visually over this
 *  region" — which is what "hovering the video" actually means to a user. */
export function resolveVideoUnderInteraction(
  pointerPos: PointerPosition | null,
  focusedElement: Element | null,
  match: AdapterVideoMatch | null,
): HTMLVideoElement | null {
  if (!match) return null;
  const container = match.adapter.getPlayerContainer(match.video) ?? match.video;
  const rect = container.getBoundingClientRect();
  const hoverInside =
    !!pointerPos && rect.width > 0 && rect.height > 0 && isPointInRect(pointerPos, rect);
  const focusInside = !!focusedElement && container.contains(focusedElement);
  return hoverInside || focusInside ? match.video : null;
}

/**
 * Alt+H's context check: is the user currently hovering or focused on the
 * page's active video (per whichever adapter matches this page)? A
 * pragmatic heuristic — last pointer position + `document.activeElement` —
 * not a perfect "what is the user watching" detector, the same honesty
 * tradeoff `detectHostTheme` documents for its own DOM heuristic. Returns
 * `null` (→ fall back to element selection) whenever no adapter matches, no
 * video is currently active, or the user isn't interacting with it. Also
 * carries the matched adapter — needed by callers that go on to build a
 * `VideoAnchor` (`buildVideoAnchor` takes an adapter, not just a video).
 */
export function getActiveVideoMatchUnderInteraction(): AdapterVideoMatch | null {
  const match = getActiveAdapterMatch();
  const video = resolveVideoUnderInteraction(lastPointerPos, document.activeElement, match);
  return video ? match : null;
}

/** Same check as `getActiveVideoMatchUnderInteraction`, for callers that
 *  only need the video element itself. */
export function getActiveVideoUnderInteraction(): HTMLVideoElement | null {
  return getActiveVideoMatchUnderInteraction()?.video ?? null;
}
