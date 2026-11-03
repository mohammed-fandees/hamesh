import type { ReactNode } from 'react';
import { CORE_STEPS, coreStepsDone, type GettingStartedStep } from '@/domain/getting-started';
import type { Strings } from './i18n';
import { COMMANDS, useShortcuts } from './hooks/useShortcuts';
import { CheckIcon, CloseIcon, GuideIcon } from './kit/icons';
import { Page, PageHeader } from './kit/Page';
import { Section } from './kit/Section';

/** A page the content script runs on, to try the first note without leaving Hamesh's world. */
const TRY_URL = 'https://hamesh.fandees.tech/';

interface StepProps {
  done: boolean;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

function Step({ done, title, children, action }: StepProps) {
  return (
    <li className="hm-step" data-done={done || undefined}>
      <span className="hm-step__mark" aria-hidden="true">
        {done && <CheckIcon size={11} />}
      </span>
      <div className="hm-step__text">
        <p className="hm-step__title">
          {title}
          {done && <span className="hm-visually-hidden"> ✓</span>}
        </p>
        <p className="hm-step__body">{children}</p>
      </div>
      {action && !done && <div className="hm-step__action">{action}</div>}
    </li>
  );
}

interface GettingStartedViewProps {
  strings: Strings;
  done: ReadonlySet<GettingStartedStep>;
  /** Only a build with Teams has this step to offer. */
  showTeamStep: boolean;
  onOpenTeams: () => void;
  onOpenLibrary: () => void;
}

/**
 * How Hamesh works, for someone who just installed it — and for anyone who wants
 * to look again, from the sidebar.
 *
 * Each step ticks itself when the reader has actually done it, so this page is
 * always "what to try next" and never a form to fill in. It updates as they go:
 * the note they leave in another tab ticks its step here.
 */
export function GettingStartedView({
  strings,
  done,
  showTeamStep,
  onOpenTeams,
  onOpenLibrary,
}: GettingStartedViewProps) {
  const shortcuts = useShortcuts();
  const key = (command: (typeof COMMANDS)[keyof typeof COMMANDS]) => (
    <kbd className="hm-kbd">{shortcuts[command] || strings.shortcutNotSet}</kbd>
  );
  const coreDone = coreStepsDone(done);

  return (
    <Page>
      <PageHeader
        title={strings.guideTitle}
        meta={strings.guideProgress(coreDone, CORE_STEPS.length)}
      />
      <p className="hm-guide__intro">{strings.guideIntro}</p>

      <Section title={strings.guideBasics}>
        <ol className="hm-steps">
          <Step done={done.has('pin')} title={strings.guidePinTitle}>
            {strings.guidePinBody}
          </Step>
          <Step
            done={done.has('note')}
            title={strings.guideNoteTitle}
            action={
              <a
                className="hm-btn hm-btn-primary"
                href={TRY_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                {strings.guideTry}
              </a>
            }
          >
            {strings.guideNoteBody} {key(COMMANDS.addNote)}
          </Step>
          <Step done={done.has('text')} title={strings.guideTextTitle}>
            {strings.guideTextBody} {key(COMMANDS.addTextNote)}
          </Step>
        </ol>
      </Section>

      <Section title={strings.guideMore}>
        <ol className="hm-steps">
          <Step done={done.has('video')} title={strings.guideVideoTitle}>
            {strings.guideVideoBody} {key(COMMANDS.addVideoNote)}
          </Step>
          <Step
            done={done.has('folder')}
            title={strings.guideFolderTitle}
            action={
              <button type="button" className="hm-btn hm-btn-ghost" onClick={onOpenLibrary}>
                {strings.guideOpenLibrary}
              </button>
            }
          >
            {strings.guideFolderBody}
          </Step>
          {showTeamStep && (
            <Step
              done={done.has('team')}
              title={strings.guideTeamTitle}
              action={
                <button type="button" className="hm-btn hm-btn-ghost" onClick={onOpenTeams}>
                  {strings.guideOpenTeams}
                </button>
              }
            >
              {strings.guideTeamBody}
            </Step>
          )}
        </ol>
      </Section>
    </Page>
  );
}

interface GuideCardProps {
  strings: Strings;
  done: number;
  onOpen: () => void;
  onClose: () => void;
}

/** The guide's foot in the Library's door, for as long as the basics aren't done. */
export function GuideCard({ strings, done, onOpen, onClose }: GuideCardProps) {
  return (
    <aside className="hm-guide-card hm-fade-in" aria-label={strings.gettingStarted}>
      <GuideIcon size={16} className="hm-guide-card__icon" />
      <p className="hm-guide-card__text">
        <strong>{strings.gettingStarted}</strong>{' '}
        <span>{strings.guideProgress(done, CORE_STEPS.length)}</span>
      </p>
      <button type="button" className="hm-btn hm-btn-ghost hm-btn--compact" onClick={onOpen}>
        {strings.guideContinue}
      </button>
      <button
        type="button"
        className="hm-icon-btn"
        aria-label={strings.guideClose}
        title={strings.guideClose}
        onClick={onClose}
      >
        <CloseIcon size={11} />
      </button>
    </aside>
  );
}
