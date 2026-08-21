import { useCallback, useRef, useState } from 'react';
import { SettingRow } from './SettingRow';
import { ExportIcon, ImportIcon } from './SettingsIcons';
import type { Strings } from './i18n';

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

type Status = { tone: 'success' | 'warning'; message: string } | null;

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
  const [busy, setBusy] = useState<'export' | 'import' | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const messageForFailure = useCallback(
    (reason: Extract<BackupImportOutcome, { ok: false }>['reason']): string => {
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
    },
    [strings],
  );

  const handleExport = useCallback(async () => {
    setBusy('export');
    setStatus(null);
    try {
      const result = await handlers.onExport();
      setStatus({
        tone: 'success',
        message: strings.backupExported(result.notes, result.folders),
      });
    } catch {
      setStatus({ tone: 'warning', message: strings.backupErrorFailed });
    } finally {
      setBusy(null);
    }
  }, [handlers, strings]);

  const handleFile = useCallback(
    async (file: File) => {
      setBusy('import');
      setStatus(null);
      try {
        const outcome = await handlers.onImport(await file.text());
        if (!outcome.ok) {
          setStatus({ tone: 'warning', message: messageForFailure(outcome.reason) });
        } else if (outcome.notes === 0 && outcome.folders === 0) {
          // A truthful outcome, not a failure — say so plainly rather than
          // reporting "restored 0 notes", which reads like something broke.
          setStatus({ tone: 'success', message: strings.backupImportedNothingNew });
        } else {
          setStatus({
            tone: 'success',
            message: strings.backupImported(outcome.notes, outcome.folders),
          });
        }
      } catch {
        setStatus({ tone: 'warning', message: strings.backupErrorFailed });
      } finally {
        setBusy(null);
      }
    },
    [handlers, messageForFailure, strings],
  );

  return (
    <>
      <h2 className="hm-settings__subheading">{strings.settingsBackup}</h2>
      <div className="hm-settings__body">
        <SettingRow
          label={strings.backupExport}
          icon={<ExportIcon />}
          value={
            <button
              type="button"
              className="hm-btn hm-btn-ghost"
              onClick={handleExport}
              disabled={busy !== null}
            >
              {busy === 'export' ? strings.backupWorking : strings.backupExport}
            </button>
          }
        />
        <p className="hm-setting-row__hint">{strings.backupExportHint}</p>

        <SettingRow
          label={strings.backupImport}
          icon={<ImportIcon />}
          value={
            <button
              type="button"
              className="hm-btn hm-btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy !== null}
            >
              {busy === 'import' ? strings.backupWorking : strings.backupImport}
            </button>
          }
        />
        <p className="hm-setting-row__hint">{strings.backupImportHint}</p>
      </div>

      {status && (
        <p
          className={
            status.tone === 'success'
              ? 'hm-status hm-status--success'
              : 'hm-status hm-status--warning'
          }
          role="status"
        >
          <span className="hm-dot" />
          {status.message}
        </p>
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
    </>
  );
}
