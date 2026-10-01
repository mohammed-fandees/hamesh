import type { NoteOwner } from '@/domain/note-owner';
import type { CachedTeam } from '@/teams/page-cache';
import type { Lang } from '../i18n';
import { CloseIcon } from '../kit/icons';
import { getTeamsStrings } from './strings';

interface NoteFilterProps {
  lang: Lang;
  teams: readonly CachedTeam[];
  value: NoteOwner;
  onChange: (value: NoteOwner) => void;
}

const keyOf = (owner: NoteOwner) => (typeof owner === 'string' ? owner : owner.teamId);

/**
 * Filter chips for narrowing the Library to one team's notes, or to the
 * reader's own. The chosen one inverts — ink on paper — as the chosen segment
 * of a segmented control does beside it.
 *
 * Only shown when this account is in a team — with no teams there is nothing to
 * tell apart, and the row would be three buttons that all do the same thing.
 * Toggle buttons rather than a segmented control: the list is as long as the
 * number of teams, which the segmented control's fixed row does not suit.
 *
 * A team's pill can also be narrowed to one folder, which the Teams page sets
 * when a folder is opened from there. That shows as a chip beside the pills,
 * with the one control that undoes it: the pill itself stays on, so the reader
 * always sees which team the folder belongs to.
 */
export function NoteFilter({ lang, teams, value, onChange }: NoteFilterProps) {
  const strings = getTeamsStrings(lang);
  if (teams.length === 0) return null;

  const options: { owner: NoteOwner; label: string }[] = [
    { owner: 'all', label: strings.filterEverything },
    { owner: 'mine', label: strings.filterMine },
    ...teams.map((team) => ({ owner: { teamId: team.id }, label: team.name })),
  ];
  const folder = typeof value === 'string' ? undefined : value.folder;

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
      {folder && typeof value !== 'string' && (
        <button
          type="button"
          className="hm-owner-filter__scope"
          aria-label={strings.clearFolderFilter(folder.name)}
          onClick={() => onChange({ teamId: value.teamId })}
        >
          <bdi>{folder.name}</bdi>
          <CloseIcon size={9} />
        </button>
      )}
    </div>
  );
}
