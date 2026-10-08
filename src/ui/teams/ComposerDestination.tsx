import { useId } from 'react';
import { flattenFolderTree } from '@/domain/folder-grouping';
import type { Destination } from '@/teams/page-channel';
import { FolderSelect } from '../FolderSelect';
import { Select } from '../kit/Select';
import type { Lang } from '../i18n';
import { getTeamsStrings } from './strings';
import css from './page.css?inline';

/** Where a note goes: this device, or one team's folder (or none of them). */
export type NoteDestination = { teamId: string; folderId: string | null } | null;

interface ComposerDestinationProps {
  lang: Lang;
  /** The teams a note can go to — never empty; without teams there is no choice. */
  destinations: Destination[];
  value: NoteDestination;
  onChange: (next: NoteDestination) => void;
}

/**
 * "Where it goes", in the composer on the page: this device, or a team.
 *
 * Choosing a team asks which one, and which of its folders; the composer then
 * saves to the team instead of this device, and says so on its button.
 */
export function ComposerDestination({
  lang,
  destinations,
  value,
  onChange,
}: ComposerDestinationProps) {
  const strings = getTeamsStrings(lang);
  const name = useId();
  const team = value ? destinations.find((d) => d.id === value.teamId) : undefined;

  return (
    <fieldset className="hm-dest">
      <style>{css}</style>
      <legend className="hm-overline hm-dest__legend">{strings.destination}</legend>
      <div className="hm-dest__choices">
        <label className="hm-dest__choice">
          <input
            type="radio"
            name={name}
            checked={value === null}
            onChange={() => onChange(null)}
          />
          <span className="hm-dest__text">
            <span className="hm-dest__name">{strings.destDevice}</span>
            <span className="hm-dest__hint">{strings.destDeviceHint}</span>
          </span>
        </label>
        <label className="hm-dest__choice">
          <input
            type="radio"
            name={name}
            checked={value !== null}
            onChange={() => onChange({ teamId: destinations[0]!.id, folderId: null })}
          />
          <span className="hm-dest__text">
            <span className="hm-dest__name">{strings.destTeam}</span>
            <span className="hm-dest__hint">{strings.destTeamHint}</span>
          </span>
        </label>
      </div>

      {value && (
        <>
          <div className="hm-dest__row">
            <span className="hm-dest__label" aria-hidden="true">
              {strings.destTeamLabel}
            </span>
            <Select
              label={strings.destTeamLabel}
              value={value.teamId}
              options={destinations.map((d) => ({ value: d.id, label: d.name }))}
              onChange={(teamId) => onChange({ teamId, folderId: null })}
            />
          </div>
          <div className="hm-dest__row">
            <span className="hm-dest__label" aria-hidden="true">
              {strings.moveToFolder}
            </span>
            <FolderSelect
              folders={flattenFolderTree(team?.folders ?? [])}
              value={value.folderId}
              onChange={(folderId) => onChange({ ...value, folderId })}
              label={strings.moveToFolder}
              noneLabel={strings.noFolderOption}
            />
          </div>
          <p className="hm-dest__notice">{strings.destUploadHint}</p>
        </>
      )}
    </fieldset>
  );
}
