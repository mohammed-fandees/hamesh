import type { ReactNode } from 'react';

/**
 * Every glyph Hamesh draws, except its own mark (`MarginMark`).
 *
 * One family: `currentColor`, round caps, strokes around 1.3 on a 14-unit grid,
 * so any two of them sit on the same optical weight beside a label and take the
 * ink of whatever holds them. All are decorative — the control or the text
 * beside a glyph carries the name — so each is `aria-hidden`.
 *
 * A glyph that points along the line of reading (a "forward" chevron, "back")
 * mirrors itself under `dir="rtl"` through the `hm-mirror` class, rather than
 * each caller flipping it by hand.
 */
export interface IconProps {
  size?: number;
  className?: string;
}

function Glyph({
  size = 14,
  viewBox = 14,
  className,
  children,
}: IconProps & { viewBox?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const withClass = (className: string | undefined, own: string) =>
  className ? `${own} ${className}` : own;

// ---- Direction and navigation --------------------------------------------

/**
 * A chevron. `down` opens a group (and turns over when it is open — the
 * holder rotates it); `forward` points where reading goes, and `back` where it
 * came from — both mirror in RTL.
 */
export function ChevronIcon({
  direction = 'down',
  size = 10,
  className,
}: IconProps & { direction?: 'down' | 'forward' | 'back' }) {
  const path = {
    down: 'M3.5 5.5 L7 9 L10.5 5.5',
    forward: 'M5.5 3.5 L9 7 L5.5 10.5',
    back: 'M8.5 3.5 L5 7 L8.5 10.5',
  }[direction];
  return (
    <Glyph
      size={size}
      className={direction === 'down' ? className : withClass(className, 'hm-mirror')}
    >
      <path d={path} strokeWidth="1.5" />
    </Glyph>
  );
}

// ---- Actions ---------------------------------------------------------------

/** "More" — the trigger of a row's actions menu. */
export function MoreIcon({ size = 14, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <circle cx="7" cy="2.6" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="7" cy="7" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="7" cy="11.4" r="1.15" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function PlusIcon({ size = 12, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <path d="M7 2.5 V11.5 M2.5 7 H11.5" strokeWidth="1.4" />
    </Glyph>
  );
}

export function PencilIcon({ size = 12, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <path d="M2.4 11.6 L2.9 9.3 L9.4 2.8 A1.2 1.2 0 0 1 11.2 4.6 L4.7 11.1 Z" strokeWidth="1.2" />
    </Glyph>
  );
}

export function TrashIcon({ size = 12, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <path
        d="M2.8 4 H11.2 M5.3 4 V2.9 A0.6 0.6 0 0 1 5.9 2.3 H8.1 A0.6 0.6 0 0 1 8.7 2.9 V4 M4 4 L4.6 11.6 A0.6 0.6 0 0 0 5.2 12.2 H8.8 A0.6 0.6 0 0 0 9.4 11.6 L10 4"
        strokeWidth="1.2"
      />
    </Glyph>
  );
}

/** A tick — the current choice in a list, or something done. */
export function CheckIcon({ size = 11, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <path d="M2.9 7.6 L5.8 10.4 L11.1 4.1" strokeWidth="1.6" />
    </Glyph>
  );
}

/** A cross — closes a card, clears a filter, backs out of a form. */
export function CloseIcon({ size = 12, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <path d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5" strokeWidth="1.6" />
    </Glyph>
  );
}

// ---- Things a note is, or has ---------------------------------------------

/** A folder outline — wherever a folder is named. */
export function FolderIcon({ size = 13, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <path
        d="M1.5 3.5 A1 1 0 0 1 2.5 2.5 H5.5 L6.8 4 H11.5 A1 1 0 0 1 12.5 5 V10.5 A1 1 0 0 1 11.5 11.5 H2.5 A1 1 0 0 1 1.5 10.5 Z"
        strokeWidth="1.1"
      />
    </Glyph>
  );
}

/** A pin — filled when the note is pinned. */
export function PinIcon({ filled, size = 13, className }: IconProps & { filled: boolean }) {
  return (
    <Glyph size={size} className={className}>
      <circle cx="7" cy="4.5" r="3" fill={filled ? 'currentColor' : 'none'} />
      <path d="M7 7.5 L7 13" />
    </Glyph>
  );
}

/** A star — filled when the folder beside it is a default. */
export function StarIcon({ filled, size = 13, className }: IconProps & { filled: boolean }) {
  return (
    <Glyph size={size} className={className}>
      <path
        d="M7 1.6 L8.6 5.05 L12.35 5.45 L9.55 8 L10.33 11.7 L7 9.8 L3.67 11.7 L4.45 8 L1.65 5.45 L5.4 5.05 Z"
        strokeWidth="1.2"
        fill={filled ? 'currentColor' : 'none'}
      />
    </Glyph>
  );
}

/** A play triangle — a video note's moment. */
export function PlayIcon({ size = 10, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <path d="M4 2.5 L11 7 L4 11.5 Z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** A line of text with the marked run underlined — a note on selected text. */
export function TextNoteIcon({ size, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <path d="M2 3.2 H12 M2 6.2 H12 M2 9.2 H8" strokeWidth="1.2" />
      <path d="M2 11.6 H8" strokeWidth="1.8" />
    </Glyph>
  );
}

/** A run of selected text with a pointer on it — the chip after selecting. */
export function SelectionActionIcon({ size, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <path d="M2 3.4 H12" strokeWidth="2" />
      <path d="M4.6 5.8 L11.4 9.2 L8.6 9.9 L7.4 12.4 Z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

// ---- Where Hamesh's pages are ----------------------------------------------

/** The Notes Library: a bookmark. */
export function LibraryIcon({ size = 15, className }: IconProps) {
  return (
    <Glyph size={size} viewBox={15} className={className}>
      <path d="M3 2.5 H12 V12.5 L7.5 10 L3 12.5 Z" />
    </Glyph>
  );
}

/** Settings: two sliders. The rails stop short of each knob, so the glyph reads
 *  on any background without painting one in. */
export function SettingsIcon({ size = 15, className }: IconProps) {
  return (
    <Glyph size={size} viewBox={16} className={className}>
      <path d="M2 5 H8.2 M11.8 5 H14 M2 11 H4.2 M7.8 11 H14" strokeWidth="1.4" />
      <circle cx="10" cy="5" r="1.8" strokeWidth="1.4" />
      <circle cx="6" cy="11" r="1.8" strokeWidth="1.4" />
    </Glyph>
  );
}

/** Mentions: an "@", drawn so it keeps its neighbours' stroke. */
export function MentionsIcon({ size = 15, className }: IconProps) {
  return (
    <Glyph size={size} viewBox={15} className={className}>
      <circle cx="7.5" cy="7.5" r="2.6" />
      <path d="M10.1 5.2 V8.4 C10.1 9.4 10.8 10 11.6 10 C12.6 10 13.3 9.1 13.3 7.6 C13.3 4.1 11 1.7 7.6 1.7 C4.3 1.7 1.7 4.3 1.7 7.6 C1.7 10.9 4.3 13.3 7.6 13.3 C8.8 13.3 9.8 13 10.6 12.5" />
    </Glyph>
  );
}

/** What's New: a parcel — something new, without borrowing the mark, which
 *  means "a note" everywhere else. */
export function WhatsNewIcon({ size = 15, className }: IconProps) {
  return (
    <Glyph size={size} viewBox={15} className={className}>
      <path d="M2.5 6.5 H12.5 V12.5 H2.5 Z M1.5 4 H13.5 V6.5 H1.5 Z M7.5 4 V12.5" />
      <path
        d="M7.5 4 C7.5 4 5 4 4.4 3.4 C3.9 2.9 4.2 2 5 2 C6.2 2 7.5 4 7.5 4 Z M7.5 4 C7.5 4 10 4 10.6 3.4 C11.1 2.9 10.8 2 10 2 C8.8 2 7.5 4 7.5 4 Z"
        strokeWidth="1.2"
      />
    </Glyph>
  );
}

// ---- Settings rows ---------------------------------------------------------

/** Appearance → Light: a sun. */
export function LightIcon({ size, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <circle cx="7" cy="7" r="2.4" />
      <path
        d="M7 1.4 V2.6 M7 11.4 V12.6 M1.4 7 H2.6 M11.4 7 H12.6 M3.1 3.1 L4 4 M10 10 L10.9 10.9 M3.1 10.9 L4 10 M10 4 L10.9 3.1"
        strokeWidth="1.1"
      />
    </Glyph>
  );
}

/** Appearance → Dark: a crescent. */
export function DarkIcon({ size, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <path
        d="M11.2 8.6A4.6 4.6 0 0 1 5.4 2.8a4.6 4.6 0 1 0 5.8 5.8Z"
        fill="currentColor"
        stroke="none"
      />
    </Glyph>
  );
}

/** Appearance → Match website, and the Appearance row itself: a half-filled circle. */
export function MatchWebsiteIcon({ size, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <circle cx="7" cy="7" r="5.2" />
      <path d="M7 1.8 A5.2 5.2 0 0 1 7 12.2 Z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Language: a globe with a meridian. */
export function LanguageIcon({ size, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <circle cx="7" cy="7" r="5.2" />
      <path
        d="M1.8 7 H12.2 M7 1.8 C8.9 3.6 8.9 10.4 7 12.2 C5.1 10.4 5.1 3.6 7 1.8 Z"
        strokeWidth="1.1"
      />
    </Glyph>
  );
}

/** Export: a document leaving, arrow up and out of a tray. */
export function ExportIcon({ size, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <path d="M2.4 9.4 V11.6 H11.6 V9.4" />
      <path d="M7 9 V2.2 M4.4 4.6 L7 2 L9.6 4.6" />
    </Glyph>
  );
}

/** Import: the same tray, arrow coming back down into it. */
export function ImportIcon({ size, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <path d="M2.4 9.4 V11.6 H11.6 V9.4" />
      <path d="M7 2 V8.8 M4.4 6.2 L7 8.8 L9.6 6.2" />
    </Glyph>
  );
}

/** Teams: two heads, side by side. */
export function TeamIcon({ size, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <circle cx="5" cy="5" r="1.9" />
      <circle cx="9.6" cy="5.6" r="1.5" />
      <path d="M1.6 11.6 C1.9 9.4 3.3 8.4 5 8.4 C6.7 8.4 8.1 9.4 8.4 11.6 M9 8.6 C10.8 8.6 12 9.5 12.4 11.6" />
    </Glyph>
  );
}

/** Teams → Account: one head. */
export function AccountIcon({ size, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <circle cx="7" cy="4.8" r="2.2" />
      <path d="M2.6 12 C3 9.6 4.8 8.4 7 8.4 C9.2 8.4 11 9.6 11.4 12" />
    </Glyph>
  );
}

/** Teams → Plan: a calendar page. */
export function PlanIcon({ size, className }: IconProps) {
  return (
    <Glyph size={size} className={className}>
      <rect x="2" y="2.8" width="10" height="9.2" rx="1.4" />
      <path d="M2 5.8 H12 M4.8 1.6 V3.8 M9.2 1.6 V3.8" />
    </Glyph>
  );
}
