import { useCallback, useEffect, useState } from 'react';
import { SettingRow } from './SettingRow';
import { AccountIcon, PlanIcon, TeamIcon } from './SettingsIcons';
import type { Lang, Strings } from './i18n';
import type { TeamsClient } from '@/teams/client';
import type { TeamsReply } from '@/teams/messages';
import './teams/styles';

interface TeamsSectionProps {
  strings: Strings;
  lang: Lang;
  client: TeamsClient;
}

type Busy = 'turn-on' | 'sign-in' | 'sign-out' | 'turn-off' | null;

/**
 * Settings → Teams: turn Teams on, sign in, see the account as the server
 * reports it, sign out, turn Teams off.
 *
 * Everything shown here is what the server said a moment ago. The page holds
 * no plan, role or limit of its own and decides nothing from them; if the
 * server can't be reached, it says so rather than guessing.
 */
export function TeamsSection({ strings, lang, client }: TeamsSectionProps) {
  const [reply, setReply] = useState<TeamsReply | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const apply = useCallback(
    (next: TeamsReply) => {
      setReply(next);
      setNotice(next.error ? strings.teamsError(next.error) : null);
    },
    [strings],
  );

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      client
        .send('status')
        .then((next) => {
          if (!cancelled) setReply(next);
        })
        .catch(() => {
          if (!cancelled) setNotice(strings.teamsError('internal'));
        });
    };
    refresh();
    // Permissions can be removed from the browser's own extension settings;
    // look again whenever the user comes back to this page.
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
    };
  }, [client, strings]);

  async function run(kind: Exclude<Busy, null>, action: () => Promise<TeamsReply | null>) {
    setBusy(kind);
    setNotice(null);
    try {
      const next = await action();
      if (next) apply(next);
    } catch {
      setNotice(strings.teamsError('internal'));
    } finally {
      setBusy(null);
    }
  }

  function turnOn() {
    // The permission prompt must be requested synchronously from the click.
    const granted = client.requestPermissions();
    void run('turn-on', async () => {
      if (!(await granted)) {
        setNotice(strings.teamsPermissionDenied);
        return null;
      }
      return client.send('status');
    });
  }

  const turnOff = () =>
    run('turn-off', async () => {
      await client.send('signOut');
      await client.removePermissions();
      return client.send('status');
    });

  const status = reply?.status;
  if (status?.state === 'unavailable') return null;

  const formatDate = (ms: number) =>
    new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(ms));

  return (
    <>
      <h2 className="hm-settings__subheading">{strings.settingsTeams}</h2>
      <p className="hm-settings__intro">{strings.teamsIntro}</p>
      <div className="hm-settings__body">
        {!status && (
          <SettingRow
            label={strings.settingsTeams}
            icon={<TeamIcon />}
            value={strings.teamsChecking}
          />
        )}

        {status?.state === 'permission_needed' && (
          <>
            <SettingRow
              label={strings.settingsTeams}
              icon={<TeamIcon />}
              value={
                <button
                  type="button"
                  className="hm-btn hm-btn-primary"
                  onClick={turnOn}
                  disabled={busy !== null}
                >
                  {busy === 'turn-on' ? strings.backupWorking : strings.teamsTurnOn}
                </button>
              }
            />
            <p className="hm-setting-row__hint">{strings.teamsTurnOnHint}</p>
          </>
        )}

        {status?.state === 'signed_out' && (
          <>
            <SettingRow
              label={strings.teamsAccount}
              icon={<AccountIcon />}
              value={
                <button
                  type="button"
                  className="hm-btn hm-btn-primary"
                  onClick={() => run('sign-in', () => client.send('signIn'))}
                  disabled={busy !== null}
                >
                  {busy === 'sign-in' ? strings.backupWorking : strings.teamsSignIn}
                </button>
              }
            />
            <p className="hm-setting-row__hint">{strings.teamsSignInHint}</p>
          </>
        )}

        {status?.state === 'signed_in' && (
          <>
            <SettingRow
              label={strings.teamsAccount}
              icon={<AccountIcon />}
              value={
                <span className="hm-teams-account">
                  {status.me && <bdi>{status.me.user.email}</bdi>}
                  <button
                    type="button"
                    className="hm-btn hm-btn-ghost"
                    onClick={() => run('sign-out', () => client.send('signOut'))}
                    disabled={busy !== null}
                  >
                    {busy === 'sign-out' ? strings.backupWorking : strings.teamsSignOut}
                  </button>
                </span>
              }
            />
            {status.me && (
              <>
                <SettingRow
                  label={strings.teamsPlan}
                  icon={<PlanIcon />}
                  value={
                    status.me.entitlement.state === 'active' && status.me.entitlement.until
                      ? strings.teamsPlanActive(formatDate(status.me.entitlement.until))
                      : strings.teamsPlanNone
                  }
                />
                <SettingRow
                  label={strings.teamsYourTeams}
                  icon={<TeamIcon />}
                  value={strings.teamsMemberOf(status.me.teams.length)}
                />
              </>
            )}
          </>
        )}
      </div>

      {(status?.state === 'signed_in' || status?.state === 'signed_out') && (
        <button
          type="button"
          className="hm-link"
          style={{ marginTop: 'var(--hm-space-3)' }}
          onClick={turnOff}
          disabled={busy !== null}
        >
          {strings.teamsTurnOff}
        </button>
      )}

      {notice && (
        <p className="hm-status hm-status--warning" role="status">
          <span className="hm-dot" />
          {notice}
        </p>
      )}
    </>
  );
}
