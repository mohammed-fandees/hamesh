import type { VideoPlayerAdapter } from './types';
import { youtubeAdapter } from './youtube';
import { html5GenericAdapter } from './html5-generic';

/** Priority-ordered, first `matches()` wins — same shape as
 *  `resolveAnchor`'s signal priority chain. `html5GenericAdapter` always
 *  matches when any `<video>` exists, so it must stay last: it's the
 *  fallback for every page a more specific adapter doesn't own. Adding a
 *  new site is adding an adapter here, nothing else. */
const adapters: VideoPlayerAdapter[] = [youtubeAdapter, html5GenericAdapter];

export function getVideoAdapters(): VideoPlayerAdapter[] {
  return adapters;
}

export function getMatchingAdapter(): VideoPlayerAdapter | null {
  return adapters.find((adapter) => adapter.matches()) ?? null;
}

export interface AdapterVideoMatch {
  adapter: VideoPlayerAdapter;
  video: HTMLVideoElement;
}

/** The page's matching adapter plus the video it currently considers
 *  active, or `null` if no adapter matches or the matching adapter has no
 *  active video right now (e.g. between YouTube SPA navigations). */
export function getActiveAdapterMatch(): AdapterVideoMatch | null {
  const adapter = getMatchingAdapter();
  if (!adapter) return null;
  const video = adapter.getActiveVideo();
  if (!video) return null;
  return { adapter, video };
}
