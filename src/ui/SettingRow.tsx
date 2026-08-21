import type { ReactNode } from 'react';

interface SettingRowProps {
  label: string;
  value: ReactNode;
  /** A small glyph before the label, so a row can be found by shape rather
   *  than by reading every label (see `SettingsIcons.tsx`). Decorative —
   *  the label is still the row's accessible name. */
  icon?: ReactNode;
}

/**
 * A single settings entry: an optional icon, a label, and the setting's
 * current value or control.
 */
export function SettingRow({ label, value, icon }: SettingRowProps) {
  return (
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
  );
}
