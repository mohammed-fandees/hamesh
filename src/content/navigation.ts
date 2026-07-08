/**
 * Detects effective-page changes for SPA awareness.
 *
 * A content script runs in an isolated world, so monkey-patching
 * `history.pushState` here would NOT catch navigations the page itself
 * triggers (its `history` lives in a separate JS context). The reliable
 * cross-world signal is the live `location.href`: we watch `popstate`/
 * `hashchange` for immediacy and poll on a light interval to catch
 * `pushState`/`replaceState` route changes from any world.
 */
type NavigationCallback = () => void;

const callbacks = new Set<NavigationCallback>();
let lastHref = '';
let started = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

function check(): void {
  if (typeof location === 'undefined' || location.href === lastHref) return;
  lastHref = location.href;
  for (const cb of callbacks) {
    try {
      cb();
    } catch {
      /* a listener throwing must not break navigation detection */
    }
  }
}

export function onNavigationChange(callback: NavigationCallback): () => void {
  callbacks.add(callback);

  if (!started) {
    started = true;
    lastHref = location.href;
    window.addEventListener('popstate', check);
    window.addEventListener('hashchange', check);
    // Poll for pushState/replaceState route changes (any world). String compare
    // at 0.5s is negligible and avoids fragile cross-world history patching.
    intervalId = setInterval(check, 500);
  }

  return () => {
    callbacks.delete(callback);
  };
}

export function cleanup(): void {
  window.removeEventListener('popstate', check);
  window.removeEventListener('hashchange', check);
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  callbacks.clear();
  started = false;
  lastHref = '';
}
