/** Where a `Select`'s list sits, in viewport pixels. */
export interface PanelPosition {
  top: number;
  left: number;
  width: number;
  /** Set only when the list had to be shortened to fit the room there is. */
  maxHeight?: number;
}

interface Box {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

const MARGIN = 4;

/** Below the button, as wide as it. */
export function anchorBelow(button: Box): PanelPosition {
  return { top: button.bottom + MARGIN, left: button.left, width: button.width };
}

/**
 * Fits the list on screen once its real size is known.
 *
 * Below the button when it fits there; otherwise above it when it fits there;
 * and when it fits neither way — a short window, a button near an edge — on the
 * side with more room, shortened to that room and scrolling inside. The list
 * never runs off the screen, and never sits over its own button. Sideways it is
 * only clamped, so it stays under the button it belongs to.
 */
export function fitPanel(
  position: PanelPosition,
  panel: { width: number; height: number },
  button: Box,
  viewport: { width: number; height: number },
): PanelPosition {
  const below = viewport.height - button.bottom - MARGIN * 2;
  const above = button.top - MARGIN * 2;
  let { top } = position;
  let maxHeight = position.maxHeight;

  if (panel.height > below) {
    if (panel.height <= above || above >= below) {
      const height = Math.min(panel.height, above);
      top = button.top - height - MARGIN;
      if (panel.height > above) maxHeight = above;
    } else {
      maxHeight = below;
    }
  }

  const left = Math.max(MARGIN, Math.min(position.left, viewport.width - MARGIN - panel.width));
  return maxHeight === undefined
    ? { top, left, width: position.width }
    : { top, left, width: position.width, maxHeight };
}
