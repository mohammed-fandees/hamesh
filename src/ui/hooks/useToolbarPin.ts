import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';

/** Chrome's own answer to "is this on the toolbar?", where a browser gives one. */
interface ActionSettings {
  getUserSettings?: () => Promise<{ isOnToolbar?: boolean }>;
  onUserSettingsChanged?: {
    addListener: (fn: () => void) => void;
    removeListener: (fn: () => void) => void;
  };
}

/**
 * Whether Hamesh is pinned to the toolbar, or null where the browser won't say.
 *
 * The change event only exists from Chrome 130, so coming back to the page reads
 * it again as well: pinning happens in the browser's own menu, outside this page.
 */
export function useToolbarPin(): boolean | null {
  const [pinned, setPinned] = useState<boolean | null>(null);

  useEffect(() => {
    const action = (browser as unknown as { action?: ActionSettings }).action;
    if (!action?.getUserSettings) return;
    const read = () =>
      void action.getUserSettings?.().then(
        (settings) => setPinned(settings.isOnToolbar ?? null),
        () => {},
      );
    read();
    window.addEventListener('focus', read);
    action.onUserSettingsChanged?.addListener(read);
    return () => {
      window.removeEventListener('focus', read);
      action.onUserSettingsChanged?.removeListener(read);
    };
  }, []);

  return pinned;
}
