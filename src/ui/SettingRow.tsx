interface SettingRowProps {
  label: string;
  value: string;
}

/**
 * A single settings entry: a label and its current value, read-only for now.
 * Phase 2/3 swap the value slot for an interactive control without touching
 * the surrounding layout.
 */
export function SettingRow({ label, value }: SettingRowProps) {
  return (
    <div className="hm-setting-row">
      <span className="hm-setting-row__label">{label}</span>
      <span className="hm-setting-row__value">{value}</span>
    </div>
  );
}
