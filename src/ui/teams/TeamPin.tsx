import type { CachedPerson } from '@/teams/people-cache';
import { Avatar } from '../kit/Avatar';
import css from './pin.css?inline';

interface TeamPinProps {
  /** Who shared the note, or undefined when this device does not know them. */
  person: CachedPerson | undefined;
  label: string;
  style?: React.CSSProperties;
  onOpen: () => void;
}

/**
 * A shared note on the page: its author's face as a pin, where a note of one's
 * own has the margin mark — so a page with a team's notes on it says at a
 * glance whose they are. The corner nearest the text is the point.
 *
 * The picture is the one the worker fetched and keeps on this device
 * (`teams/people-cache.ts`), never Google's address: the page it is drawn on
 * never asks for it. A page that will not show it gets the monogram.
 */
export function TeamPin({ person, label, style, onOpen }: TeamPinProps) {
  return (
    <button
      type="button"
      className="hm-marker hm-pin"
      style={style}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <Avatar name={person?.name ?? null} src={person?.photo} />
    </button>
  );
}

/** The pins' own rules, drawn once beside however many pins there are. */
export function TeamPinStyles() {
  return <style>{css}</style>;
}
