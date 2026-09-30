import type { Note } from '@/domain/note';
import type { CachedTeam } from '@/teams/page-cache';
import type { Lang } from '../i18n';
import { getTeamsStrings } from './strings';

/** Whose notes the Library is showing: everyone's, only mine, or one team's. */
export type NoteOwner = 'all' | 'mine' | { teamId: string };

interface NoteFilterProps {
  lang: Lang;
  teams: readonly CachedTeam[];
  value: NoteOwner;
  onChange: (value: NoteOwner) => void;
}

/** Whether `note` belongs in the list `owner` asked for. */
export function matchesOwner(note: Note, owner: NoteOwner): boolean {
  if (owner === 'all') return true;
  if (owner === 'mine') return !note.team;
  return note.team?.id === owner.teamId;
}

const keyOf = (owner: NoteOwner) => (typeof owner === 'string' ? owner : owner.teamId);

/**
 * Pills for narrowing the Library to one team's notes, or to the reader's own.
 *
 * Only shown when this account is in a team — with no teams there is nothing to
 * tell apart, and the row would be three buttons that all do the same thing.
 * Toggle buttons rather than a segmented control: the list is as long as the
 * number of teams, which the segmented control's fixed row does not suit.
 */
export function NoteFilter({ lang, teams, value, onChange }: NoteFilterProps) {
  const strings = getTeamsStrings(lang);
  if (teams.length === 0) return null;

  const options: { owner: NoteOwner; label: string }[] = [
    { owner: 'all', label: strings.filterEverything },
    { owner: 'mine', label: strings.filterMine },
    ...teams.map((team) => ({ owner: { teamId: team.id }, label: team.name })),
  ];

  return (
    <div className="hm-owner-filter" role="group" aria-label={strings.filterEverything}>
      {options.map((option) => {
        const key = keyOf(option.owner);
        const pressed = keyOf(value) === key;
        return (
          <button
            key={key}
            type="button"
            className="hm-owner-filter__pill"
            aria-pressed={pressed}
            onClick={() => onChange(option.owner)}
          >
            {typeof option.owner !== 'string' && (
              <span className="hm-owner-filter__dot" aria-hidden="true" />
            )}
            <bdi>{option.label}</bdi>
          </button>
        );
      })}
    </div>
  );
}
