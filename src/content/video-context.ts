import { getActiveAdapterMatch, type AdapterVideoMatch } from './video-adapters/registry';

let lastPointerTarget: Element | null = null;

function onPointerMove(e: PointerEvent): void {
  lastPointerTarget = e.target instanceof Element ? e.target : null;
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
    lastPointerTarget = null;
  };
}

/** Pure decision, separated from the live pointer-tracking state above so
 *  it's testable with plain fixture elements — no event wiring required.
 *  "Interacting with" means inside the matched adapter's whole player
 *  region (`getPlayerContainer`), not just the bare `<video>` box, so
 *  hovering a site's own controls/timeline still counts. */
export function resolveVideoUnderInteraction(
  hoveredElement: Element | null,
  focusedElement: Element | null,
  match: AdapterVideoMatch | null,
): HTMLVideoElement | null {
  if (!match) return null;
  const container = match.adapter.getPlayerContainer(match.video) ?? match.video;
  const hoverInside = !!hoveredElement && container.contains(hoveredElement);
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
  const video = resolveVideoUnderInteraction(lastPointerTarget, document.activeElement, match);
  return video ? match : null;
}

/** Same check as `getActiveVideoMatchUnderInteraction`, for callers that
 *  only need the video element itself. */
export function getActiveVideoUnderInteraction(): HTMLVideoElement | null {
  return getActiveVideoMatchUnderInteraction()?.video ?? null;
}
