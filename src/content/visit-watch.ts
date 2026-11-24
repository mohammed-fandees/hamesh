import type { VisitOutcome } from '@/domain/anchor-health';

/** No DOM change for this long and the page counts as settled. */
export const QUIET_MS = 3_000;
/** No verdict before this: late-loading SPAs and lazy sections get their chance. */
export const LATE_MS = 10_000;
/** A page that never stops changing (a ticker, a rotating banner) still gets a verdict here. */
export const MAX_MS = 30_000;

export interface VisitWatchOptions {
  /** How each checked note did, right now. Called at each check, so it should resolve afresh. */
  evaluate(): ReadonlyMap<string, VisitOutcome>;
  /** The visit's one verdict per note. Not called when the watch is stopped first. */
  onVerdict(outcomes: ReadonlyMap<string, VisitOutcome>): void;
  /** Calls back on every page change; returns how to stop listening. */
  observe?: (onChange: () => void) => () => void;
  quietMs?: number;
  lateMs?: number;
  maxMs?: number;
}

function observeBody(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}

/**
 * One visit to a page, from the moment it starts to its verdict.
 *
 * A note is checked each time the page has been quiet for `quietMs`. The verdict comes once
 * `lateMs` have passed and at least one quiet check happened, or at `maxMs` whatever the page is
 * doing. A note found at any check counts as found for the whole visit; only a note missed at
 * every check is missed. Everything stops at the verdict, so a settled page costs nothing.
 *
 * Returns `stop`, for navigation and unmount: a visit cut short says nothing.
 */
export function watchVisit({
  evaluate,
  onVerdict,
  observe = observeBody,
  quietMs = QUIET_MS,
  lateMs = LATE_MS,
  maxMs = MAX_MS,
}: VisitWatchOptions): () => void {
  const startedAt = Date.now();
  const found = new Set<string>();
  let last: ReadonlyMap<string, VisitOutcome> = new Map();
  let quietChecked = false;
  let done = false;
  let quietTimer = 0;
  let lateTimer = 0;
  let maxTimer = 0;
  let unobserve: () => void = () => {};

  const stop = () => {
    done = true;
    clearTimeout(quietTimer);
    clearTimeout(lateTimer);
    clearTimeout(maxTimer);
    unobserve();
  };

  const check = () => {
    last = evaluate();
    for (const [id, outcome] of last) if (outcome === 'found') found.add(id);
  };

  const decide = () => {
    if (done) return;
    stop();
    const verdict = new Map<string, VisitOutcome>();
    for (const id of last.keys()) verdict.set(id, found.has(id) ? 'found' : 'missed');
    onVerdict(verdict);
  };

  const onQuiet = () => {
    if (done) return;
    check();
    quietChecked = true;
    if (Date.now() - startedAt >= lateMs) decide();
  };

  const armQuiet = () => {
    clearTimeout(quietTimer);
    quietTimer = window.setTimeout(onQuiet, quietMs);
  };

  unobserve = observe(armQuiet);
  armQuiet();
  lateTimer = window.setTimeout(() => {
    if (done || !quietChecked) return;
    check();
    decide();
  }, lateMs);
  maxTimer = window.setTimeout(() => {
    if (done) return;
    check();
    decide();
  }, maxMs);

  return stop;
}
