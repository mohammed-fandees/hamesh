import type { ReactNode } from 'react';

interface SettingRowProps {
  label: string;
  /** The setting's current value, or the control that changes it. */
  value: ReactNode;
  /** A small glyph before the label, so a row can be found by shape rather
   *  than by reading every label. Decorative — the label is the name. */
  icon?: ReactNode;
  /** A line under the row, for a setting whose consequences aren't obvious
   *  from its label (what an export holds; that an import deletes nothing). */
  hint?: ReactNode;
}

/**
 * A single setting: an optional icon, a label, and its value or control at the
 * far end — with, when it needs one, a line of explanation under it that takes
 * the row's hairline, so the separator falls under the pair.
 */
export function SettingRow({ label, value, icon, hint }: SettingRowProps) {
  return (
    <>
      <div className="hm-setting-row">
        <span className="hm-setting-row__label">
          {icon && (
            <span className="hm-setting-row__icon" aria-hidden="true">
              {icon}
            </span>
          )}
          {label}
        </span>
        <span className="hm-setting-row__value">{value}</span>
      </div>
      {hint && <p className="hm-setting-row__hint">{hint}</p>}
    </>
  );
}
