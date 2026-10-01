/**
 * On or off — for a setting that is one or the other ("Notes on selected
 * text"). A real `role="switch"` button: Space and Enter flip it, and a screen
 * reader hears its name and whether it is on. The name is the setting row's
 * label, passed in, since the switch sits apart from it at the row's end.
 */
export function Switch({
  checked,
  label,
  onChange,
  disabled,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="hm-switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="hm-switch__thumb" aria-hidden="true" />
    </button>
  );
}
