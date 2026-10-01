import type { ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Shown instead of the text; the label is still the option's name. */
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
 * One choice out of a few, side by side in a pill — By site / By folder, a team
 * out of the reader's teams, English / Arabic, Match website / Light / Dark.
 *
 * Backed by native radio inputs, so a group is one Tab stop and the arrow keys
 * move the choice, for free. The chosen segment inverts — ink on paper, the
 * same way the Library's filter chips mark theirs — rather than tinting, so the
 * accent stays the mark's.
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
        <label
          key={opt.value}
          className="hm-segmented__option"
          aria-label={opt.label}
          data-icon={opt.icon ? true : undefined}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          {opt.icon ?? <bdi>{opt.label}</bdi>}
        </label>
      ))}
    </div>
  );
}
