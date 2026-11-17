import { useCallback, useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { todaysReport, type UsageLedger, type UsageReport } from '@/domain/usage';
import { clearLedger, readLedger, watchLedger } from '@/usage/ledger';
import { releaseSharingPermission, requestSharingPermission } from '@/usage/permission';
import type { PreferencesState } from '../hooks/usePreferences';
import type { Lang } from '../i18n';

/**
 * The reader's answer about usage counts, and the three ways to give it.
 * Every surface that asks (Settings, What's New, Getting started) goes through
 * here, so saying yes always asks Firefox too, and turning it off always
 * forgets what was kept.
 */
export function useUsageSharing(preferences: PreferencesState) {
  const { setUsage } = preferences;
  const sharing = preferences.prefs?.usage.sharing ?? 'unasked';
  const [busy, setBusy] = useState(false);

  /** Call from the click itself: Firefox only asks for a click's own handler. */
  const share = useCallback(() => {
    const granted = requestSharingPermission();
    setBusy(true);
    void granted
      .then((ok) => (ok ? setUsage({ sharing: 'on' }) : false))
      .finally(() => setBusy(false));
  }, [setUsage]);

  const decline = useCallback(() => void setUsage({ sharing: 'off' }), [setUsage]);

  const stop = useCallback(() => {
    setBusy(true);
    void (async () => {
      await setUsage({ sharing: 'off' });
      await clearLedger();
      await releaseSharingPermission();
    })().finally(() => setBusy(false));
  }, [setUsage]);

  return { sharing, busy, share, decline, stop };
}

/** Today's report from this device, as it would be sent, kept up to date. */
export function useTodaysReport(lang: Lang): UsageReport | null {
  // The ledger and the moment it was read together, so the day it is shown for
  // is fixed when it is read rather than whenever the page draws.
  const [read, setRead] = useState<{ ledger: UsageLedger; at: number } | null>(null);
  useEffect(() => {
    let live = true;
    void readLedger(Date.now()).then((ledger) => {
      if (live) setRead({ ledger, at: Date.now() });
    });
    const unwatch = watchLedger((ledger) => setRead({ ledger, at: Date.now() }));
    return () => {
      live = false;
      unwatch();
    };
  }, []);
  return useMemo(
    () =>
      read &&
      todaysReport(read.ledger, read.at, {
        version: browser.runtime.getManifest().version,
        browser: import.meta.env.FIREFOX ? 'firefox' : 'chrome',
        lang,
      }),
    [read, lang],
  );
}

/**
 * A report written out the way it travels, a count to a line, so the reader can
 * check every name in it. `compact` keeps a short example on two lines.
 */
export function formatReport(report: UsageReport, compact = false): string {
  const q = JSON.stringify;
  const counts = Object.entries(report.counts);
  if (compact) {
    const list = counts.map(([k, v]) => `${q(k)}: ${v}`).join(', ');
    return `{ "day": ${q(report.day)}, "version": ${q(report.version)}, "browser": ${q(report.browser)}, "lang": ${q(report.lang)},\n  "counts": { ${list} } }`;
  }
  const head = `{ "day": ${q(report.day)}, "version": ${q(report.version)},\n  "browser": ${q(report.browser)}, "lang": ${q(report.lang)},\n`;
  if (counts.length === 0) return `${head}  "counts": {} }`;
  const lines = counts.map(([k, v]) => `    ${q(k)}: ${v}`).join(',\n');
  return `${head}  "counts": {\n${lines}\n  } }`;
}
