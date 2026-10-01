import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, MoreIcon } from './icons';

interface PanelPosition {
  top: number;
  /** Exactly one of `left`/`right` is set — whichever edge the trigger's own
   *  inline-end edge resolves to, LTR or RTL. */
  left?: number;
  right?: number;
}

/** Below the trigger, aligned to its inline-end edge. Reads the trigger's own
 *  resolved direction, not `document.dir`: `dir` lives on the page's
 *  `.hm-scope` wrapper, never on `<html>`. */
function anchorTo(trigger: HTMLElement): PanelPosition {
  const rect = trigger.getBoundingClientRect();
  return getComputedStyle(trigger).direction === 'rtl'
    ? { top: rect.bottom + 4, left: rect.left }
    : { top: rect.bottom + 4, right: window.innerWidth - rect.right };
}

/** Nudges a position back on-screen once the panel's real size is known:
 *  above the trigger when there is no room below, and clamped — not flipped —
 *  sideways, so it stays aligned with the row it belongs to. */
function clampToViewport(position: PanelPosition, panel: HTMLElement, trigger: HTMLElement) {
  const size = panel.getBoundingClientRect();
  const from = trigger.getBoundingClientRect();
  const margin = 4;
  let { top, left, right } = position;
  if (from.bottom + margin + size.height > window.innerHeight) {
    top = Math.max(margin, from.top - size.height - margin);
  }
  if (left !== undefined) {
    left = Math.max(margin, Math.min(left, window.innerWidth - margin - size.width));
  }
  if (right !== undefined) {
    right = Math.max(margin, Math.min(right, window.innerWidth - size.width - margin));
  }
  return { top, left, right };
}

const ITEMS = '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)';

interface MenuProps {
  /** Names the trigger, and the panel it opens. */
  label: string;
  /** The panel's content, handed a way to close the menu. */
  children: (close: () => void) => ReactNode;
  /**
   * True while the panel shows a form or a question rather than a list of
   * items — a name to type, a note to edit, "delete this?" — which is not
   * `menu` content and is announced as a dialog instead.
   */
  form?: boolean;
  /** Changes whenever the panel's content changes shape, so it is placed again. */
  layoutKey?: string;
  onClose?: () => void;
  className?: string;
}

/**
 * The "⋮" on a row, and what it opens — every row action in Hamesh lives in one
 * of these: a note's (pin, edit, move, share, delete) and a folder's (new
 * folder inside, rename, delete).
 *
 * Portaled to the page's `.hm-scope` and placed from the trigger's own
 * rectangle, so an `overflow: hidden` ancestor — the collapsing groups and
 * folders — can never clip it, while every `--hm-*` token (declared on
 * `.hm-scope`, never `:root`) still reaches it. It follows its row while the
 * page scrolls and closes once the row has left the screen.
 *
 * Keyboard, as a menu should be: the first item takes focus, the arrows move
 * between items, Home and End go to either end, and Escape closes it and puts
 * focus back on the "⋮". A form or a question inside handles its own Escape
 * first, so Escape always backs out one level at a time.
 */
export function Menu({ label, children, form = false, layoutKey, onClose, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [portal, setPortal] = useState<Element | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /** Set when the menu closes by the keyboard or by a choice — not by a click
   *  elsewhere, which has put the focus where the reader wanted it. */
  const [refocus, setRefocus] = useState(false);

  const close = useCallback(
    (returnFocus = true) => {
      setOpen(false);
      setPosition(null);
      setRefocus(returnFocus);
      onClose?.();
    },
    [onClose],
  );

  // Focus goes back to the "⋮" once the panel it was in has gone.
  useEffect(() => {
    if (open || !refocus) return;
    triggerRef.current?.focus({ preventScroll: true });
  }, [open, refocus]);

  // Placed from the trigger once open, and again whenever the content changes
  // shape (an edit box is taller than a list of items).
  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!open || !trigger) return;
    setPosition(anchorTo(trigger));
    setPortal(trigger.closest('.hm-scope') ?? document.body);
  }, [open, layoutKey]);

  // Then clamped with the panel's real size. Converges in one extra layout
  // pass — clamping an in-bounds position changes nothing — before any paint.
  useLayoutEffect(() => {
    if (!open || !position || !panelRef.current || !triggerRef.current) return;
    const clamped = clampToViewport(position, panelRef.current, triggerRef.current);
    if (
      clamped.top !== position.top ||
      clamped.left !== position.left ||
      clamped.right !== position.right
    ) {
      setPosition(clamped);
    }
  }, [open, position]);

  // The first item takes focus when a list opens; a form focuses its own field.
  useEffect(() => {
    if (!open || !position || form) return;
    panelRef.current?.querySelector<HTMLElement>(ITEMS)?.focus({ preventScroll: true });
    // Once per opening, not per re-placement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, position === null, form]);

  useEffect(() => {
    if (!open) return;
    // Read from the event's path, not its target: on a web page the menu lives
    // in Hamesh's shadow root, and a listener on the document sees every press
    // inside it as a press on the shadow's host — which would close the menu
    // before the item that was pressed could take the click.
    const within = (e: Event) => {
      const path = e.composedPath();
      return (
        (!!triggerRef.current && path.includes(triggerRef.current)) ||
        (!!panelRef.current && path.includes(panelRef.current))
      );
    };
    const onPointerDown = (e: PointerEvent) => {
      if (within(e)) return;
      close(false);
    };
    // Capture, so scrolling inside the panel (an edit box) is seen and ignored.
    // Follows the trigger rather than closing on any scroll: focusing the
    // trigger can itself scroll an `overflow: hidden` ancestor, and closing on
    // that made the menu vanish the moment it opened.
    const onScroll = (e: Event) => {
      if (panelRef.current && e.composedPath().includes(panelRef.current)) return;
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gone =
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth;
      if (gone) close(false);
      else setPosition(anchorTo(trigger));
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [open, close]);

  function onPanelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (form) return;
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    if (items.length === 0) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = {
      ArrowDown: (at + 1) % items.length,
      ArrowUp: (at - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    items[next].focus();
  }

  const style: CSSProperties | undefined = position
    ? { position: 'fixed', top: position.top, left: position.left, right: position.right }
    : undefined;

  return (
    <span className={className ? `hm-menu ${className}` : 'hm-menu'}>
      <button
        ref={triggerRef}
        type="button"
        className="hm-icon-btn hm-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            close();
          } else {
            setRefocus(false);
            setOpen(true);
          }
        }}
      >
        <MoreIcon />
      </button>
      {open &&
        position &&
        portal &&
        createPortal(
          <div
            ref={panelRef}
            className="hm-menu__panel"
            role={form ? 'dialog' : 'menu'}
            aria-label={label}
            style={style}
            onKeyDown={onPanelKeyDown}
          >
            {children(() => close())}
          </div>,
          portal,
        )}
    </span>
  );
}

interface MenuItemProps {
  children: ReactNode;
  onSelect: () => void;
  icon?: ReactNode;
  tone?: 'danger' | 'accent';
  disabled?: boolean;
  /** For a choice among several: the current one is checked. */
  checked?: boolean;
  /** How far in a nested choice sits — a folder inside a folder. */
  depth?: number;
}

export function MenuItem({
  children,
  onSelect,
  icon,
  tone,
  disabled,
  checked,
  depth,
}: MenuItemProps) {
  const choice = checked !== undefined;
  return (
    <button
      type="button"
      role={choice ? 'menuitemradio' : 'menuitem'}
      aria-checked={choice ? checked : undefined}
      className={tone ? `hm-menu__item hm-menu__item--${tone}` : 'hm-menu__item'}
      style={depth ? ({ '--hm-depth': depth } as CSSProperties) : undefined}
      disabled={disabled}
      onClick={onSelect}
    >
      {icon}
      <span className="hm-menu__item-label">{children}</span>
      {checked && <CheckIcon className="hm-menu__check" />}
    </button>
  );
}

export function MenuDivider() {
  return <div className="hm-menu__divider" role="separator" />;
}

/** A quiet heading over a run of items, or a line of explanation among them. */
export function MenuLabel({ children, alert }: { children: ReactNode; alert?: boolean }) {
  return (
    <div className="hm-menu__label" role={alert ? 'alert' : undefined}>
      {children}
    </div>
  );
}
