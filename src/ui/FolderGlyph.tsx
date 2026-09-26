/** The folder outline used wherever a folder is named — the Notes Library's
 *  folder tree and the composer's folder selector — so both read as the
 *  same thing. */
export function FolderGlyph({ className }: { className?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true" className={className}>
      <path
        d="M1.5 3.5 A1 1 0 0 1 2.5 2.5 H5.5 L6.8 4 H11.5 A1 1 0 0 1 12.5 5 V10.5 A1 1 0 0 1 11.5 11.5 H2.5 A1 1 0 0 1 1.5 10.5 Z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  );
}
