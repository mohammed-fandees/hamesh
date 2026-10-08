import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckIcon, ChevronIcon } from './icons';
import { anchorBelow, fitPanel, type PanelPosition } from './select-placement';

export interface SelectOption {
  value: string;
  label: string;
  /** How far in a nested choice sits — a folder inside a folder. */
  depth?: number;
  /** Set apart from the options above it by a line — "New folder…". */
  separated?: boolean;
  tone?: 'accent';
  disabled?: boolean;
}

interface SelectProps {
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Names the control, and the list it opens. */
  label: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Choosing one of a few things, drawn the way the rest of Hamesh is: the
 * browser's own `<select>` list is white on a dark card, ignores our type and
 * tokens, and cannot show a folder inside a folder.
 *
 * A select-only combobox (ARIA 1.2): focus stays on the button while the arrow
 * keys move through the list, Home/End go to either end, typing jumps to a
 * match, Enter or Space chooses, Escape closes and keeps focus on the button.
 *
 * Portaled to the page's `.hm-scope` and placed from the button's own
 * rectangle — like `Menu` — so a card's `overflow: hidden` can never clip the
 * list on a web page, and every `--hm-*` token still reaches it. It follows its
 * button while the page scrolls, and opens upward when there is no room below.
 * Presses are read from `composedPath()`: inside the shadow root a document
 * listener sees every one as a press on the host.
 */
export function Select({ options, value, onChange, label, className, disabled }: SelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [portal, setPortal] = useState<Element | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });

  const selected = options.findIndex((o) => o.value === value);
  const optionId = (i: number) => `${id}-o${i}`;

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
    setActive(-1);
  }, []);

  // A list that is open when its control is disabled has nothing to answer to.
  if (disabled && open) close();

  const choose = useCallback(
    (i: number) => {
      const option = options[i];
      if (!option || option.disabled) return;
      close();
      triggerRef.current?.focus({ preventScroll: true });
      if (option.value !== value) onChange(option.value);
    },
    [options, value, onChange, close],
  );

  function openList() {
    setActive(Math.max(0, selected));
    setOpen(true);
  }

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!open || !trigger) return;
    setPosition(anchorBelow(trigger.getBoundingClientRect()));
    setPortal(trigger.closest('.hm-scope') ?? document.body);
  }, [open]);

  // Then clamped with the list's real size, before any paint.
  useLayoutEffect(() => {
    if (!open || !position || !panelRef.current || !triggerRef.current) return;
    const fitted = fitPanel(
      position,
      panelRef.current.getBoundingClientRect(),
      triggerRef.current.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
    );
    if (
      fitted.top !== position.top ||
      fitted.left !== position.left ||
      fitted.maxHeight !== position.maxHeight
    ) {
      setPosition(fitted);
    }
  }, [open, position]);

  // The option being pointed at stays in view.
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active, position === null]);

  useEffect(() => {
    if (!open) return;
    const within = (e: Event) => {
      const path = e.composedPath();
      return (
        (!!triggerRef.current && path.includes(triggerRef.current)) ||
        (!!panelRef.current && path.includes(panelRef.current))
      );
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!within(e)) close();
    };
    // Follows the button; closes once its row has left the screen.
    const onScroll = (e: Event) => {
      if (panelRef.current && e.composedPath().includes(panelRef.current)) return;
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) close();
      else setPosition(anchorBelow(trigger.getBoundingClientRect()));
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('scroll', onScroll, { capture: true });
    };
  }, [open, close]);

  function step(by: 1 | -1) {
    let next = active;
    for (let tries = 0; tries < options.length; tries++) {
      next = (next + by + options.length) % options.length;
      if (!options[next]?.disabled) break;
    }
    setActive(next);
  }

  function edge(first: boolean) {
    const order = options.map((_, i) => i);
    const found = (first ? order : order.reverse()).find((i) => !options[i]?.disabled);
    if (found !== undefined) setActive(found);
  }

  function typeahead(char: string) {
    const now = Date.now();
    const text = now - typed.current.at > 600 ? char : typed.current.text + char;
    typed.current = { text, at: now };
    const from = text.length === 1 ? active + 1 : active;
    for (let t = 0; t < options.length; t++) {
      const i = (from + t + options.length) % options.length;
      const option = options[i]!;
      if (!option.disabled && option.label.toLowerCase().startsWith(text.toLowerCase())) {
        setActive(i);
        return;
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const { key } = e;
    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (key === 'ArrowDown') step(1);
    else if (key === 'ArrowUp') step(-1);
    else if (key === 'Home') edge(true);
    else if (key === 'End') edge(false);
    else if (key === 'Enter' || key === ' ') choose(active);
    else if (key === 'Escape') close();
    else if (key === 'Tab') {
      close();
      return;
    } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeahead(key);
    else return;
    // Escape closes the list and nothing else — not the composer around it.
    e.preventDefault();
    e.stopPropagation();
  }

  const style: CSSProperties | undefined = position
    ? {
        position: 'fixed',
        top: position.top,
        left: position.left,
        minWidth: position.width,
        ...(position.maxHeight !== undefined ? { maxHeight: position.maxHeight } : {}),
      }
    : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        className={
          className ? `hm-input hm-select__trigger ${className}` : 'hm-input hm-select__trigger'
        }
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        // Space clicks on keyup in Firefox; the keydown already handled it.
        onKeyUp={(e) => {
          if (e.key === ' ') e.preventDefault();
        }}
      >
        <span className="hm-select__value">{options[selected]?.label ?? ''}</span>
        <ChevronIcon className="hm-select__chevron" />
      </button>
      {open &&
        position &&
        portal &&
        createPortal(
          <div
            ref={panelRef}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            className="hm-select__panel"
            style={style}
            // Focus stays on the button while the pointer works the list.
            onMouseDown={(e) => e.preventDefault()}
          >
            {options.map((option, i) => (
              <div
                key={option.value}
                id={optionId(i)}
                role="option"
                aria-selected={i === selected}
                aria-disabled={option.disabled || undefined}
                data-active={i === active}
                data-tone={option.tone}
                data-separated={option.separated || undefined}
                className="hm-select__option"
                style={option.depth ? ({ '--hm-depth': option.depth } as CSSProperties) : undefined}
                onMouseMove={() => !option.disabled && setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="hm-select__option-label">{option.label}</span>
                {i === selected && <CheckIcon className="hm-select__check" />}
              </div>
            ))}
          </div>,
          portal,
        )}
    </>
  );
}
