import type { TeamsClient } from '@/teams/client';
import type { TeamsReply, TeamsStatus } from '@/teams/messages';
import { failureOf, Failure, useWork } from '../hooks/useWork';
import { InlineError } from '../kit/Feedback';
import { CheckIcon } from '../kit/icons';
import { Section } from '../kit/Section';
import type { TeamsStrings } from './strings';

interface TeamsStartProps {
  strings: TeamsStrings;
  client: TeamsClient;
  status: TeamsStatus;
  /** Once a step is done, so the page reads the account again. */
  onChanged: () => void;
}

/**
 * Getting into Teams, in place: what it is for, then the steps, each with the
 * control that does it. Sending someone to Settings to find a switch and back
 * again was the point most people gave up.
 */
export function TeamsStart({ strings, client, status, onChanged }: TeamsStartProps) {
  const work = useWork((error) => failureOf(error, strings.error('internal')));
  const permitted = status.state !== 'permission_needed';

  function turnOn() {
    // The permission prompt must be requested synchronously from the click.
    const granted = client.requestPermissions();
    void work
      .run('step', async () => {
        if (!(await granted)) throw new Failure(strings.permissionDenied);
      })
      .then(onChanged);
  }

  function signIn() {
    void work
      .run('step', async () => {
        const reply: TeamsReply = await client.send('signIn');
        if (reply.error) throw new Failure(strings.error(reply.error));
      })
      .then(onChanged);
  }

  const busy = work.working('step');
  const failure = work.failed('step');

  return (
    <Section title={strings.startTitle} intro={strings.startIntro}>
      <ol className="hm-steps">
        <li className="hm-step" data-done={permitted || undefined}>
          <span className="hm-step__mark" aria-hidden="true">
            {permitted && <CheckIcon size={11} />}
          </span>
          <div className="hm-step__text">
            <p className="hm-step__title">{strings.turnOn}</p>
            <p className="hm-step__body">{strings.turnOnHint}</p>
          </div>
          {!permitted && (
            <div className="hm-step__action">
              <button
                type="button"
                className="hm-btn hm-btn-primary"
                disabled={busy}
                aria-busy={busy}
                onClick={turnOn}
              >
                {strings.turnOn}
              </button>
            </div>
          )}
        </li>
        <li className="hm-step">
          <span className="hm-step__mark" aria-hidden="true" />
          <div className="hm-step__text">
            <p className="hm-step__title">{strings.signIn}</p>
            <p className="hm-step__body">{strings.signInHint}</p>
          </div>
          {permitted && (
            <div className="hm-step__action">
              <button
                type="button"
                className="hm-btn hm-btn-primary"
                disabled={busy}
                aria-busy={busy}
                onClick={signIn}
              >
                {strings.signIn}
              </button>
            </div>
          )}
        </li>
        <li className="hm-step">
          <span className="hm-step__mark" aria-hidden="true" />
          <div className="hm-step__text">
            <p className="hm-step__title">{strings.startStepTeam}</p>
            <p className="hm-step__body">{strings.startStepTeamBody}</p>
          </div>
        </li>
      </ol>
      {failure && <InlineError>{failure}</InlineError>}
    </Section>
  );
}
