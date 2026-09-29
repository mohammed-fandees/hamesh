/**
 * The small glyphs that label each Settings row and each Appearance choice.
 *
 * All drawn on the same 14×14 grid with 1.3px strokes and `currentColor`, so
 * they sit on one optical weight beside a row label and inherit whatever ink
 * the row already uses. The three Appearance ones were previously local to
 * `SettingsView.tsx`; they live here now because the Notes Library's
 * Settings page shows the same choices and should show the same marks.
 */

interface IconProps {
  size?: number;
}

function Svg({ size = 14, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Appearance → Light: a sun. */
export function LightIcon({ size }: IconProps = {}) {
  return (
    <Svg size={size}>
      <circle cx="7" cy="7" r="2.4" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path
        d="M7 1.4 V2.6 M7 11.4 V12.6 M1.4 7 H2.6 M11.4 7 H12.6 M3.1 3.1 L4 4 M10 10 L10.9 10.9 M3.1 10.9 L4 10 M10 4 L10.9 3.1"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Appearance → Dark: a crescent. */
export function DarkIcon({ size }: IconProps = {}) {
  return (
    <Svg size={size}>
      <path d="M11.2 8.6A4.6 4.6 0 0 1 5.4 2.8a4.6 4.6 0 1 0 5.8 5.8Z" fill="currentColor" />
    </Svg>
  );
}

/** Appearance → Match website: a half-filled circle. */
export function MatchWebsiteIcon({ size }: IconProps = {}) {
  return (
    <Svg size={size}>
      <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path d="M7 1.8 A5.2 5.2 0 0 1 7 12.2 Z" fill="currentColor" />
    </Svg>
  );
}

/** Language: a globe with a meridian. */
export function LanguageIcon({ size }: IconProps = {}) {
  return (
    <Svg size={size}>
      <circle cx="7" cy="7" r="5.2" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path
        d="M1.8 7 H12.2 M7 1.8 C8.9 3.6 8.9 10.4 7 12.2 C5.1 10.4 5.1 3.6 7 1.8 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
      />
    </Svg>
  );
}

/** Appearance (the row itself): the same split circle "match website" uses,
 *  under a name that says what the row is rather than what the choice is. */
export const AppearanceIcon = MatchWebsiteIcon;

/** Contextual text notes: a line of text with the marked run underlined. */
export function TextNoteIcon({ size }: IconProps = {}) {
  return (
    <Svg size={size}>
      <path
        d="M2 3.2 H12 M2 6.2 H12 M2 9.2 H8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M2 11.6 H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

/** Export: a document leaving, arrow up and out. */
export function ExportIcon({ size }: IconProps = {}) {
  return (
    <Svg size={size}>
      <path
        d="M2.4 9.4 V11.6 H11.6 V9.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M7 9 V2.2 M4.4 4.6 L7 2 L9.6 4.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Import: the same tray, arrow coming back down into it. */
export function ImportIcon({ size }: IconProps = {}) {
  return (
    <Svg size={size}>
      <path
        d="M2.4 9.4 V11.6 H11.6 V9.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M7 2 V8.8 M4.4 6.2 L7 8.8 L9.6 6.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** The selection action: a run of selected text with a pointer on it. */
export function SelectionActionIcon({ size }: IconProps = {}) {
  return (
    <Svg size={size}>
      <path d="M2 3.4 H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4.6 5.8 L11.4 9.2 L8.6 9.9 L7.4 12.4 Z" fill="currentColor" />
    </Svg>
  );
}

/** Teams: two heads, side by side. */
export function TeamIcon({ size }: IconProps = {}) {
  return (
    <Svg size={size}>
      <circle cx="5" cy="5" r="1.9" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <circle cx="9.6" cy="5.6" r="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path
        d="M1.6 11.6 C1.9 9.4 3.3 8.4 5 8.4 C6.7 8.4 8.1 9.4 8.4 11.6 M9 8.6 C10.8 8.6 12 9.5 12.4 11.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Teams → Account: one head. */
export function AccountIcon({ size }: IconProps = {}) {
  return (
    <Svg size={size}>
      <circle cx="7" cy="4.8" r="2.2" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path
        d="M2.6 12 C3 9.6 4.8 8.4 7 8.4 C9.2 8.4 11 9.6 11.4 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Teams → Plan: a calendar page. */
export function PlanIcon({ size }: IconProps = {}) {
  return (
    <Svg size={size}>
      <rect
        x="2"
        y="2.8"
        width="10"
        height="9.2"
        rx="1.4"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
      />
      <path
        d="M2 5.8 H12 M4.8 1.6 V3.8 M9.2 1.6 V3.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </Svg>
  );
}
