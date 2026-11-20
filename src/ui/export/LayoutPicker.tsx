import { useRef, type KeyboardEvent } from 'react';
import { EXPORT_LAYOUTS, type ExportLayout } from '@/domain/export/layout';
import type { ExportUiStrings } from '../i18n';
import { LayoutThumb } from './LayoutThumb';

interface LayoutPickerProps {
  value: ExportLayout;
  suggested: ExportLayout;
  strings: ExportUiStrings;
  label: string;
  onChange: (layout: ExportLayout) => void;
  /** Each option carries its description (the popover), or only the chosen one is described below
   *  the grid (one page, where room is short). */
  describe: 'each' | 'chosen';
}

/**
 * The four layouts as one radio group: a drawn thumbnail, a name, the "Suggested" badge on the
 * one Hamesh picked. Arrow keys move and choose, as a radio group does; Tab leaves it.
 */
export function LayoutPicker({
  value,
  suggested,
  strings,
  label,
  onChange,
  describe,
}: LayoutPickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const rtl = event.currentTarget.closest('[dir]')?.getAttribute('dir') === 'rtl';
    const forward = event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
    const back = event.key === 'ArrowUp' || event.key === (rtl ? 'ArrowRight' : 'ArrowLeft');
    if (!forward && !back) return;
    event.preventDefault();
    const at = EXPORT_LAYOUTS.indexOf(value);
    const next = (at + (forward ? 1 : EXPORT_LAYOUTS.length - 1)) % EXPORT_LAYOUTS.length;
    onChange(EXPORT_LAYOUTS[next]);
    refs.current[next]?.focus();
  }

  return (
    <>
      <div role="radiogroup" aria-label={label} className="hm-layout-options" onKeyDown={onKeyDown}>
        {EXPORT_LAYOUTS.map((layout, i) => {
          const checked = layout === value;
          return (
            <button
              key={layout}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className="hm-layout-option"
              onClick={() => onChange(layout)}
            >
              <span className="hm-layout-option__head">
                <span className="hm-layout-option__name">{strings.layoutName[layout]}</span>
                {layout === suggested && (
                  <span className="hm-layout-option__badge">{strings.suggested}</span>
                )}
              </span>
              <span className="hm-layout-option__art">
                <LayoutThumb layout={layout} size="lg" />
              </span>
              {describe === 'each' && (
                <span className="hm-layout-option__desc">{strings.layoutDescription[layout]}</span>
              )}
            </button>
          );
        })}
      </div>
      {describe === 'chosen' && (
        <p className="hm-export__hint">{strings.layoutDescription[value]}</p>
      )}
    </>
  );
}
