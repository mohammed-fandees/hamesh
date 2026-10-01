/**
 * What more than one adapter needs to know about plain `<video>` elements,
 * written once.
 */

/** The video an adapter considers active among `videos`: one that is
 *  playing, else the first in document order. Deliberately simple — the
 *  video shortcut always targets whichever video is active, never whichever
 *  the pointer happens to be over. */
export function pickActiveVideo(videos: readonly HTMLVideoElement[]): HTMLVideoElement | null {
  if (videos.length === 0) return null;
  return videos.find((v) => !v.paused && !v.ended && v.readyState > 2) ?? videos[0];
}

/** A stable-enough id for a video with no platform identity: its resolved
 *  source (the same video keeps it across reloads), else its position among
 *  the page's `<video>` elements — stable within a session, the same "best
 *  available signal" stance element anchors take. */
export function sourceOrOrdinalId(video: HTMLVideoElement): string {
  const src = video.currentSrc || video.getAttribute('src');
  if (src) return src;
  const index = Array.from(document.querySelectorAll('video')).indexOf(video);
  return `video-${index === -1 ? 0 : index}`;
}
