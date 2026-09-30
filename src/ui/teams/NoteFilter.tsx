import type { Note } from '@/domain/note';
import type { CachedTeam } from '@/teams/page-cache';
import type { Lang } from '../i18n';
import { getTeamsStrings } from './strings';

/**
 * Whose notes the Library is showing: everyone's, only mine, or one team's —
 * and, for a team, optionally just one of its folders (`id: null` is the notes
 * the team has filed nowhere). The folder's name travels with it because the
 * Library holds no team folders of its own: it only needs the name to say what
 * it is narrowed to.
 */
export type NoteOwner =
  'all' | 'mine' | { teamId: string; folder?: { id: string | null; name: string } };

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
  if (note.team?.id !== owner.teamId) return false;
  if (!owner.folder) return true;
  return owner.folder.id === null ? !note.team.folderId : note.team.folderId === owner.folder.id;
}

const keyOf = (owner: NoteOwner) => (typeof owner === 'string' ? owner : owner.teamId);

/**
 * Pills for narrowing the Library to one team's notes, or to the reader's own.
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
          <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M2 2 L8 8 M8 2 L2 8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
