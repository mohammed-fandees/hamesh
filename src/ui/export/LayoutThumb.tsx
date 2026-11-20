import type { ExportLayout } from '@/domain/export/layout';

/**
 * A small drawing of each layout, our own: lines for text, the accent for what the layout is
 * about. Drawn left to right and mirrored in Arabic, so the accent sits where reading starts.
 */
export function LayoutThumb({ layout, size }: { layout: ExportLayout; size: 'sm' | 'lg' }) {
  const [w, h] = size === 'sm' ? [28, 20] : [84, 40];
  return (
    <svg
      className="hm-mirror"
      width={w}
      height={h}
      viewBox="0 0 84 40"
      fill="none"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {layout === 'notes' && (
        <>
          <path className="hm-thumb__accent" d="M6.5 3v14" strokeWidth={3} />
          <path className="hm-thumb__ink" d="M14 6H54M14 13H42M4 25H78M4 32H62" strokeWidth={2.4} />
        </>
      )}
      {layout === 'glossary' && (
        <>
          <path
            className="hm-thumb__rule"
            d="M4 3h76M4 14h76M4 25h76M4 36h76M42 3v33"
            strokeWidth={1.2}
          />
          <path className="hm-thumb__accent" d="M8 8.5H28M8 19.5H22M8 30.5H26" strokeWidth={2.4} />
          <path className="hm-thumb__ink" d="M48 8.5H72M48 19.5H66M48 30.5H70" strokeWidth={2.4} />
        </>
      )}
      {layout === 'timeline' && (
        <>
          <path className="hm-thumb__rule" d="M8 3v34" strokeWidth={2} />
          <circle className="hm-thumb__dot" cx={8} cy={7} r={3.5} />
          <circle className="hm-thumb__dot" cx={8} cy={20} r={3.5} />
          <circle className="hm-thumb__dot" cx={8} cy={33} r={3.5} />
          <path className="hm-thumb__ink" d="M18 7H64M18 20H52M18 33H60" strokeWidth={2.4} />
        </>
      )}
      {layout === 'checklist' && (
        <>
          <rect
            className="hm-thumb__accent"
            x={4}
            y={2}
            width={9}
            height={9}
            rx={2}
            strokeWidth={1.8}
          />
          <rect
            className="hm-thumb__accent"
            x={4}
            y={15.5}
            width={9}
            height={9}
            rx={2}
            strokeWidth={1.8}
          />
          <rect
            className="hm-thumb__accent"
            x={4}
            y={29}
            width={9}
            height={9}
            rx={2}
            strokeWidth={1.8}
          />
          <path className="hm-thumb__ink" d="M20 6.5H64M20 20H54M20 33.5H60" strokeWidth={2.4} />
        </>
      )}
    </svg>
  );
}
