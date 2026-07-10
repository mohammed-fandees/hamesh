import type { ReactNode } from 'react';

interface SettingRowProps {
  label: string;
  value: ReactNode;
}

/**
 * A single settings entry: a label and its current value or control.
 */
export function SettingRow({ label, value }: SettingRowProps) {
  return (
    <div className="hm-setting-row">
      <span className="hm-setting-row__label">{label}</span>
      <span className="hm-setting-row__value">{value}</span>
    </div>
  );
}
