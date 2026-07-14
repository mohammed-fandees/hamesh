import type { ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Optional icon shown instead of the text label — the label still
   *  supplies the accessible name via the wrapping <label>. */
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  name: string;
  groupLabel: string;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

/**
 * A segmented control backed by native radio inputs — real radio semantics
 * (grouped Tab stop, arrow-key switching) come for free, styled to match
 * Hamesh rather than the browser's default radio appearance. Used for
 * Settings' Language/Appearance choices and the Notes Library's sort order.
 */
export function SegmentedControl<T extends string>({
  value,
  name,
  groupLabel,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="hm-segmented" role="radiogroup" aria-label={groupLabel}>
      {options.map((opt) => (
        <label key={opt.value} className="hm-segmented__option" aria-label={opt.label}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.icon ?? <span>{opt.label}</span>}
        </label>
      ))}
    </div>
  );
}
