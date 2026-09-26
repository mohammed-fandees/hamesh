/**
 * Holds a video still while a note is being written on it, and lets it go
 * again afterwards — so the moment being noted doesn't run on without the
 * writer.
 *
 * Works on the `<video>` element itself rather than through any site's
 * player API, because every adapter (YouTube, the generic HTML5 one, custom
 * timelines) resolves to a real `HTMLVideoElement`, and every player built
 * on one — YouTube's included — keeps its own controls in sync with the
 * element's `pause`/`play` events. No per-site code, so a new adapter gets
 * this for free.
 *
 * The release only ever undoes what the hold did:
 *
 * - A video that wasn't playing is never touched — releasing never starts
 *   one that was already paused ("never unexpectedly autoplay").
 * - If the user starts playback themselves while writing, control is
 *   theirs from then on: the release leaves the video however they left it.
 * - If the element now shows a different video (an SPA like YouTube reuses
 *   one `<video>` across navigations) or has left the page, there's nothing
 *   to resume.
 */
export function holdPlayback(video: HTMLVideoElement): () => void {
  if (video.paused || video.ended) return () => {};

  const source = video.currentSrc;
  let resume = true;
  // Media events are dispatched asynchronously, so a `play` from *before*
  // this hold — typically the previous hold's own resume, when a note is
  // reopened within moments of closing — can still arrive after the pause
  // below. It arrives to a paused video, though; a user actually starting
  // playback arrives to a playing one. Only the latter hands control back.
  const onUserPlay = () => {
    if (!video.paused) resume = false;
  };

  video.pause();
  video.addEventListener('play', onUserPlay);

  return () => {
    video.removeEventListener('play', onUserPlay);
    if (!resume || !video.isConnected || !video.paused || video.currentSrc !== source) return;
    // `play()` returns a promise that rejects if the browser refuses (e.g.
    // an autoplay policy); failing to resume must never surface as an error.
    const played = video.play() as Promise<void> | undefined;
    played?.catch(() => {});
  };
}
