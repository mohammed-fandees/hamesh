import type { VideoPlayerAdapter } from './types';

/** Registrable-ish host check — covers the watch page, mobile web, and
 *  youtu.be short links. Not using `page-key.ts`'s domain helpers here on
 *  purpose: this is "is this a YouTube page at all," not page identity. */
function isYouTubeHost(): boolean {
  const host = location.hostname.toLowerCase().replace(/^www\./, '');
  return host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be';
}

function getPlayerContainerEl(): Element | null {
  return document.querySelector('#movie_player') ?? document.querySelector('.html5-video-player');
}

function getProgressBarContainer(): Element | null {
  return document.querySelector('.ytp-progress-bar-container');
}

/** YouTube's player DOM always nests the `<video>` under the player
 *  container; `.html5-main-video` is the class YouTube itself uses to mark
 *  it, with a bare `video` query as a fallback for markup drift. */
function getVideoElement(): HTMLVideoElement | null {
  const container = getPlayerContainerEl();
  const video =
    container?.querySelector('video.html5-main-video') ?? container?.querySelector('video');
  return (video as HTMLVideoElement | null) ?? null;
}

/** The `v` query param covers the standard watch page; `youtu.be/<id>` short
 *  links put it in the path instead; `/shorts/<id>` and `/embed/<id>` are
 *  the other URL shapes that carry a real video id but no `v` param. */
function parseVideoIdFromUrl(): string | null {
  let url: URL;
  try {
    url = new URL(location.href);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return id || null;
  }

  const v = url.searchParams.get('v');
  if (v) return v;

  const shorts = url.pathname.match(/^\/shorts\/([^/]+)/);
  if (shorts) return shorts[1];

  const embed = url.pathname.match(/^\/embed\/([^/]+)/);
  if (embed) return embed[1];

  return null;
}

export const youtubeAdapter: VideoPlayerAdapter = {
  id: 'youtube',

  matches(): boolean {
    return isYouTubeHost() && !!getProgressBarContainer() && !!getVideoElement();
  },

  getActiveVideo(): HTMLVideoElement | null {
    return getVideoElement();
  },

  getPlayerContainer(): Element | null {
    return getPlayerContainerEl();
  },

  getVideoId(): string | null {
    return parseVideoIdFromUrl();
  },

  capabilities: { nativeTimeline: true },

  getTimelineRect(): DOMRect | null {
    return getProgressBarContainer()?.getBoundingClientRect() ?? null;
  },
};
