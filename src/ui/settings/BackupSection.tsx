import { useRef, useState } from 'react';
import { Failure, failureOf, useWork } from '../hooks/useWork';
import { SettingRow } from '../kit/SettingRow';
import { Panel } from '../kit/Section';
import { StatusLine } from '../kit/Feedback';
import { ExportIcon, ImportIcon } from '../kit/icons';
import type { Strings } from '../i18n';

/** What the caller does with a file, kept as plain callbacks so this
 *  component owns no storage and no note logic — only the file dialogs, the
 *  busy state, and how a result is worded. */
export interface BackupHandlers {
  onExport: () => Promise<{ notes: number; folders: number }>;
  onImport: (text: string) => Promise<BackupImportOutcome>;
}

export type BackupImportOutcome =
  | { ok: true; notes: number; folders: number }
  | {
      ok: false;
      reason: 'invalid-json' | 'not-a-backup' | 'unsupported-version' | 'no-content' | 'failed';
    };

interface BackupSectionProps {
  strings: Strings;
  handlers: BackupHandlers;
}

/**
 * Backup — export every note and folder to a file, and put them back.
 *
 * Two plain buttons rather than a wizard: this is the part of Settings
 * someone visits when they're changing machines or feeling nervous about
 * losing their notes, and it should be over in one click. The import side
 * deliberately promises, in the row's own hint, that nothing is deleted —
 * see `domain/backup.ts` for the merge rule that makes that true.
 */
export function BackupSection({ strings, handlers }: BackupSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const work = useWork((error) => failureOf(error, strings.backupErrorFailed));
  /** What the last finished export or import did — said once it is done. */
  const [done, setDone] = useState<string | null>(null);

  const messageForFailure = (reason: Extract<BackupImportOutcome, { ok: false }>['reason']) => {
    switch (reason) {
      case 'invalid-json':
        return strings.backupErrorInvalidJson;
      case 'not-a-backup':
        return strings.backupErrorNotABackup;
      case 'unsupported-version':
        return strings.backupErrorUnsupported;
      case 'no-content':
        return strings.backupErrorEmpty;
      default:
        return strings.backupErrorFailed;
    }
  };

  async function handleExport() {
    setDone(null);
    work.clear('import');
    const result = await work.run('export', handlers.onExport);
    if (result) setDone(strings.backupExported(result.notes, result.folders));
  }

  async function handleFile(file: File) {
    setDone(null);
    work.clear('export');
    const outcome = await work.run('import', async () => {
      const result = await handlers.onImport(await file.text());
      if (!result.ok) throw new Failure(messageForFailure(result.reason));
      return result;
    });
    if (!outcome) return;
    // "Nothing new" is a truthful outcome, not a failure — said plainly rather
    // than as "restored 0 notes", which reads like something broke.
    setDone(
      outcome.notes === 0 && outcome.folders === 0
        ? strings.backupImportedNothingNew
        : strings.backupImported(outcome.notes, outcome.folders),
    );
  }

  const busy = work.working('export') || work.working('import');
  const failed = work.failed('export') ?? work.failed('import');

  return (
    <Panel title={strings.settingsBackup}>
      <div className="hm-settings__body">
        <SettingRow
          label={strings.backupExport}
          icon={<ExportIcon />}
          value={
            <button
              type="button"
              className="hm-btn hm-btn-ghost"
              onClick={() => void handleExport()}
              disabled={busy}
              aria-busy={work.working('export')}
            >
              {strings.backupExport}
            </button>
          }
          hint={strings.backupExportHint}
        />

        <SettingRow
          label={strings.backupImport}
          icon={<ImportIcon />}
          value={
            <button
              type="button"
              className="hm-btn hm-btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              aria-busy={work.working('import')}
            >
              {strings.backupImport}
            </button>
          }
          hint={strings.backupImportHint}
        />
      </div>

      {failed ? (
        <StatusLine tone="warning">{failed}</StatusLine>
      ) : (
        done && <StatusLine tone="success">{done}</StatusLine>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hm-visually-hidden"
        // Deliberately not the same name as the Import button above it:
        // browsers expose a file input as a button too, and two buttons
        // called "Import" in a row is a maze for anyone listening rather
        // than looking.
        aria-label={strings.backupChooseFile}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset first, so picking the same file twice in a row still
          // fires a change event (the browser suppresses it otherwise).
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />
    </Panel>
  );
}
